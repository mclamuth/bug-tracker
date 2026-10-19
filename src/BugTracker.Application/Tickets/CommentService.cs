using BugTracker.Application.Notifications;
using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application.Tickets;

/// <summary>Comments on tickets, newest first, with @mentions that email the person mentioned.</summary>
public sealed class CommentService(IAppDbContext db, ICurrentUser current, IClock clock, NotificationService notify)
{
    public const int MaxBodyLength = 10_000;

    public async Task<AppResult<IReadOnlyList<CommentDto>>> ListAsync(int number, CancellationToken ct)
    {
        var ticketId = await db.Tickets.Where(t => t.TicketNumber == number).Select(t => (int?)t.Id).FirstOrDefaultAsync(ct);
        if (ticketId is null) return AppError.NotFound($"Ticket BT-{number}");
        return AppResult<IReadOnlyList<CommentDto>>.Ok(await ListForTicketAsync(ticketId.Value, ct));
    }

    internal async Task<IReadOnlyList<CommentDto>> ListForTicketAsync(int ticketId, CancellationToken ct)
    {
        var rows = await db.Comments.AsNoTracking()
            .Where(c => c.TicketId == ticketId)
            .Include(c => c.Author)
            .Include(c => c.Mentions).ThenInclude(m => m.MentionedUser)
            .OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<AppResult<CommentDto>> AddAsync(int number, CommentRequest req, CancellationToken ct)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == number, ct);
        if (ticket is null) return AppError.NotFound($"Ticket BT-{number}");

        var body = req.Body?.Trim();
        if (Validate(body) is { } error) return error;

        var comment = await AddToTicketAsync(ticket, body!, ct);
        await db.SaveChangesAsync(ct);
        return await GetDtoAsync(comment.Id, ct);
    }

    /// <summary>Adds a comment as part of a larger change (e.g. a status change); the caller saves.</summary>
    internal async Task<Comment> AddToTicketAsync(Ticket ticket, string body, CancellationToken ct)
    {
        var me = current.UserId;
        var now = clock.UtcNow;
        var comment = new Comment { Ticket = ticket, AuthorId = me, Body = body, CreatedAt = now };

        var mentioned = await FindMentionsAsync(body, ct);
        foreach (var userId in mentioned)
        {
            comment.Mentions.Add(new CommentMention { MentionedUserId = userId });
        }

        db.Comments.Add(comment);
        ticket.UpdatedAt = now;
        await notify.MentionedAsync(ticket, comment, mentioned, me, ct);
        return comment;
    }

    public async Task<AppResult<CommentDto>> UpdateAsync(int commentId, CommentRequest req, CancellationToken ct)
    {
        var me = current.UserId;
        var comment = await db.Comments.Include(c => c.Mentions).Include(c => c.Ticket).FirstOrDefaultAsync(c => c.Id == commentId, ct);
        if (comment is null) return AppError.NotFound("Comment");
        if (comment.AuthorId != me) return AppError.Forbidden("Only the person who wrote a comment can edit it.");

        var body = req.Body?.Trim();
        if (Validate(body) is { } error) return error;
        if (body == comment.Body) return await GetDtoAsync(commentId, ct);

        var now = clock.UtcNow;
        comment.Body = body!;
        comment.EditedAt = now;
        comment.Ticket!.UpdatedAt = now;

        // Keep mentions in step with the text; only people newly mentioned get an email.
        var mentioned = await FindMentionsAsync(body!, ct);
        var existing = comment.Mentions.Select(m => m.MentionedUserId).ToHashSet();
        comment.Mentions.RemoveAll(m => !mentioned.Contains(m.MentionedUserId));
        var added = mentioned.Where(id => !existing.Contains(id)).ToList();
        foreach (var userId in added)
        {
            comment.Mentions.Add(new CommentMention { MentionedUserId = userId });
        }
        await notify.MentionedAsync(comment.Ticket, comment, added, me, ct);

        await db.SaveChangesAsync(ct);
        return await GetDtoAsync(commentId, ct);
    }

    public async Task<AppResult<bool>> DeleteAsync(int commentId, CancellationToken ct)
    {
        var comment = await db.Comments.Include(c => c.Ticket).FirstOrDefaultAsync(c => c.Id == commentId, ct);
        if (comment is null) return AppError.NotFound("Comment");
        if (comment.AuthorId != current.UserId) return AppError.Forbidden("Only the person who wrote a comment can delete it.");

        // Files attached to the comment stay on the ticket.
        var files = await db.Attachments.Where(a => a.CommentId == commentId).ToListAsync(ct);
        files.ForEach(a => a.CommentId = null);

        db.Comments.Remove(comment);
        comment.Ticket!.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<IReadOnlySet<int>> FindMentionsAsync(string body, CancellationToken ct)
    {
        if (!body.Contains('@', StringComparison.Ordinal)) return new HashSet<int>();
        var people = await db.Users.AsNoTracking().Where(u => u.IsActive).ToListAsync(ct);
        return MentionParser.FindMentionedUserIds(body, people);
    }

    private static AppError? Validate(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return AppError.Invalid("body", "Write a comment first.");
        if (body.Length > MaxBodyLength) return AppError.Invalid("body", $"Keep comments under {MaxBodyLength} characters.");
        return null;
    }

    private async Task<CommentDto> GetDtoAsync(int commentId, CancellationToken ct)
    {
        var comment = await db.Comments.AsNoTracking()
            .Include(c => c.Author)
            .Include(c => c.Mentions).ThenInclude(m => m.MentionedUser)
            .FirstAsync(c => c.Id == commentId, ct);
        return ToDto(comment);
    }

    private static CommentDto ToDto(Comment c) => new(
        c.Id,
        TicketService.Person(c.AuthorId, c.Author!.DisplayName),
        c.Body,
        c.Mentions
            .Where(m => m.MentionedUser is not null)
            .Select(m => TicketService.Person(m.MentionedUserId, m.MentionedUser!.DisplayName))
            .OrderBy(p => p.DisplayName)
            .ToList(),
        c.CreatedAt,
        c.EditedAt);
}
