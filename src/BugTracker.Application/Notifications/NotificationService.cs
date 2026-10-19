using System.Net;
using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BugTracker.Application.Notifications;

/// <summary>Settings shared across the app. Bound from the "App" configuration section.</summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    /// <summary>Where people open the app, used for links in emails.</summary>
    public string BaseUrl { get; set; } = "http://localhost:5173";
}

/// <summary>
/// Queues notification emails in the EmailOutbox table. The rows are saved in the same
/// SaveChanges as the change that caused them, so an email is never lost or sent for a change
/// that didn't happen. Nobody is emailed about their own action.
/// </summary>
public sealed class NotificationService(IAppDbContext db, IClock clock, IOptions<AppOptions> options)
{
    /// <summary>New ticket: every supervisor (for triage), plus the assignee if one was chosen.</summary>
    public async Task TicketCreatedAsync(Ticket ticket, int actorId, CancellationToken ct)
    {
        var supervisors = await db.Users.Where(u => u.IsSupervisor && u.IsActive).ToListAsync(ct);
        foreach (var supervisor in supervisors)
        {
            Queue(NotificationKind.NewTicket, ticket, supervisor, actorId,
                $"[{ticket.DisplayNumber}] New {TypeWord(ticket)} needs triage: {ticket.Title}",
                $"A new {TypeWord(ticket)} was submitted and needs triage.");
        }

        if (ticket.AssignedToId is { } assigneeId)
        {
            await AssignedAsync(ticket, assigneeId, actorId, ct);
        }
    }

    public async Task AssignedAsync(Ticket ticket, int assigneeId, int actorId, CancellationToken ct)
    {
        var assignee = await db.Users.FindAsync([assigneeId], ct);
        if (assignee is not null)
        {
            Queue(NotificationKind.Assigned, ticket, assignee, actorId,
                $"[{ticket.DisplayNumber}] Assigned to you: {ticket.Title}",
                $"You have been assigned a {TypeWord(ticket)}.");
        }
    }

    public async Task MentionedAsync(Ticket ticket, Comment comment, IEnumerable<int> userIds, int actorId, CancellationToken ct)
    {
        var ids = userIds.ToList();
        if (ids.Count == 0)
        {
            return;
        }

        var actor = await db.Users.FindAsync([actorId], ct);
        var people = await db.Users.Where(u => ids.Contains(u.Id) && u.IsActive).ToListAsync(ct);
        foreach (var person in people)
        {
            Queue(NotificationKind.Mentioned, ticket, person, actorId,
                $"[{ticket.DisplayNumber}] {actor?.DisplayName ?? "Someone"} mentioned you",
                $"{actor?.DisplayName ?? "Someone"} mentioned you on {ticket.DisplayNumber}:",
                quote: comment.Body);
        }
    }

    /// <summary>A fix is ready: tell the person who reported it so they can test.</summary>
    public async Task ReadyForTestAsync(Ticket ticket, int actorId, CancellationToken ct)
    {
        var reporter = await db.Users.FindAsync([ticket.ReportedById], ct);
        if (reporter is not null)
        {
            Queue(NotificationKind.ReadyForTest, ticket, reporter, actorId,
                $"[{ticket.DisplayNumber}] Ready for test: {ticket.Title}",
                "A ticket you reported is ready for you to test.");
        }
    }

    public async Task ReopenedAsync(Ticket ticket, string? reason, int actorId, CancellationToken ct)
    {
        if (ticket.AssignedToId is not { } assigneeId)
        {
            return;
        }

        var assignee = await db.Users.FindAsync([assigneeId], ct);
        if (assignee is not null)
        {
            Queue(NotificationKind.Reopened, ticket, assignee, actorId,
                $"[{ticket.DisplayNumber}] Reopened: {ticket.Title}",
                "A ticket assigned to you was reopened.",
                quote: reason);
        }
    }

    private void Queue(NotificationKind kind, Ticket ticket, User recipient, int actorId, string subject, string lead, string? quote = null)
    {
        if (recipient.Id == actorId || !recipient.IsActive || string.IsNullOrWhiteSpace(recipient.Email))
        {
            return;
        }

        var link = $"{options.Value.BaseUrl.TrimEnd('/')}/tickets/{ticket.TicketNumber}";
        var html = $"""
            <p>{Encode(lead)}</p>
            {(quote is null ? "" : $"<blockquote>{Encode(quote)}</blockquote>")}
            <p><strong>{Encode(ticket.DisplayNumber)}: {Encode(ticket.Title)}</strong></p>
            <p><a href="{Encode(link)}">View ticket</a></p>
            """;

        db.EmailOutbox.Add(new EmailOutbox
        {
            Ticket = ticket,
            Kind = kind,
            ToAddress = recipient.Email,
            Subject = subject.Length > 300 ? subject[..300] : subject,
            HtmlBody = html,
            CreatedAt = clock.UtcNow,
        });
    }

    private static string TypeWord(Ticket ticket) => ticket.Type == TicketType.Defect ? "defect" : "enhancement";

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
