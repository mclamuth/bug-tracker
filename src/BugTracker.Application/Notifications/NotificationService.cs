using BugTracker.Application.Tickets;
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
/// Queues notification emails in the EmailOutbox table, already rendered from the email template. The rows
/// are saved in the same SaveChanges as the change that caused them, so an email is never lost or sent for a
/// change that didn't happen; the outbox sender delivers them afterwards. Nobody is emailed about their own action.
/// </summary>
public sealed class NotificationService(IAppDbContext db, IClock clock, IOptions<AppOptions> options)
{
    private const int ExcerptLength = 300;

    /// <summary>New ticket: every supervisor (for triage), plus the assignee if one was chosen.</summary>
    public async Task TicketCreatedAsync(Ticket ticket, int actorId, CancellationToken ct)
    {
        var actor = await NameAsync(actorId, ct);
        var assignee = ticket.AssignedToId is { } id ? await NameAsync(id, ct) : null;
        var supervisors = await db.Users.Where(u => u.IsSupervisor && u.IsActive).ToListAsync(ct);
        foreach (var supervisor in supervisors)
        {
            await QueueAsync(NotificationKind.NewTicket, ticket, supervisor, actorId,
                assignee is null
                    ? $"[{ticket.DisplayNumber}] New {TypeWord(ticket)} needs triage: {ticket.Title}"
                    : $"[{ticket.DisplayNumber}] New {TypeWord(ticket)}: {ticket.Title}",
                heading: assignee is null ? "A new ticket needs triage" : "A new ticket was submitted",
                lead: assignee is null
                    ? $"{actor} submitted a new unassigned {TypeWord(ticket)}."
                    : $"{actor} submitted a new {TypeWord(ticket)} and assigned it to {assignee}.",
                button: assignee is null ? "Triage ticket" : "View ticket",
                quote: null, excerpt: true, ct);
        }

        if (ticket.AssignedToId is { } assigneeId && await db.Users.FindAsync([assigneeId], ct) is { } developer)
        {
            await QueueAsync(NotificationKind.Assigned, ticket, developer, actorId,
                $"[{ticket.DisplayNumber}] Assigned to you: {ticket.Title}",
                heading: "You’ve been assigned a ticket",
                lead: $"{actor} reported {Article(ticket)} {TypeWord(ticket)} and assigned it to you.",
                button: "View ticket", quote: null, excerpt: true, ct);
        }
    }

    /// <summary>A developer was given the ticket, with the note left for them, if any.</summary>
    public async Task AssignedAsync(Ticket ticket, int assigneeId, int actorId, string? note, CancellationToken ct)
    {
        var assignee = await db.Users.FindAsync([assigneeId], ct);
        if (assignee is null) return;

        await QueueAsync(NotificationKind.Assigned, ticket, assignee, actorId,
            $"[{ticket.DisplayNumber}] Assigned to you: {ticket.Title}",
            heading: "You’ve been assigned a ticket",
            lead: $"{await NameAsync(actorId, ct)} assigned you {Article(ticket)} {TypeWord(ticket)}.",
            button: "View ticket", quote: note, excerpt: true, ct);
    }

    public async Task MentionedAsync(Ticket ticket, Comment comment, IEnumerable<int> userIds, int actorId, CancellationToken ct)
    {
        var ids = userIds.ToList();
        if (ids.Count == 0) return;

        var actor = await NameAsync(actorId, ct);
        var people = await db.Users.Where(u => ids.Contains(u.Id) && u.IsActive).ToListAsync(ct);
        foreach (var person in people)
        {
            await QueueAsync(NotificationKind.Mentioned, ticket, person, actorId,
                $"[{ticket.DisplayNumber}] {actor} mentioned you",
                heading: "You were mentioned in a comment",
                lead: $"{actor} mentioned you on {ticket.DisplayNumber}.",
                button: "View comment", quote: comment.Body, excerpt: false, ct);
        }
    }

    /// <summary>A fix is ready: tell the person who reported it so they can test, with the developer's note.</summary>
    public async Task ReadyForTestAsync(Ticket ticket, string? note, int actorId, CancellationToken ct)
    {
        var reporter = await db.Users.FindAsync([ticket.ReportedById], ct);
        if (reporter is null) return;

        await QueueAsync(NotificationKind.ReadyForTest, ticket, reporter, actorId,
            $"[{ticket.DisplayNumber}] Ready for test: {ticket.Title}",
            heading: "Ready for you to test",
            lead: $"{await NameAsync(actorId, ct)} finished work on {Article(ticket)} {TypeWord(ticket)} you reported. "
                + "Please test it, then mark it verified or reopen it.",
            button: "Test ticket", quote: note, excerpt: false, ct);
    }

    /// <summary>Back to the developer, with the reason it was reopened.</summary>
    public async Task ReopenedAsync(Ticket ticket, string? reason, int actorId, CancellationToken ct)
    {
        if (ticket.AssignedToId is not { } assigneeId) return;
        var assignee = await db.Users.FindAsync([assigneeId], ct);
        if (assignee is null) return;

        await QueueAsync(NotificationKind.Reopened, ticket, assignee, actorId,
            $"[{ticket.DisplayNumber}] Reopened: {ticket.Title}",
            heading: "A ticket was reopened",
            lead: $"{await NameAsync(actorId, ct)} reopened {Article(ticket)} {TypeWord(ticket)} assigned to you.",
            button: "View ticket", quote: reason, excerpt: false, ct);
    }

    private async Task QueueAsync(
        NotificationKind kind, Ticket ticket, User recipient, int actorId, string subject,
        string heading, string lead, string button, string? quote, bool excerpt, CancellationToken ct)
    {
        if (recipient.Id == actorId || !recipient.IsActive || string.IsNullOrWhiteSpace(recipient.Email))
        {
            return;
        }

        var content = new EmailContent
        {
            Heading = heading,
            Lead = lead,
            Quote = quote,
            TicketNumber = ticket.DisplayNumber,
            TicketTitle = ticket.Title,
            Summary = await SummaryAsync(ticket, ct),
            Excerpt = excerpt ? EmailTemplate.Shorten(ticket.Description, ExcerptLength) : null,
            ButtonText = button,
            Link = $"{options.Value.BaseUrl.TrimEnd('/')}/tickets/{ticket.TicketNumber}",
        };

        db.EmailOutbox.Add(new EmailOutbox
        {
            Ticket = ticket,
            Kind = kind,
            ToAddress = recipient.Email,
            Subject = EmailTemplate.Shorten(subject, 300),
            HtmlBody = EmailTemplate.Render(content),
            CreatedAt = clock.UtcNow,
        });
    }

    /// <summary>The ticket card's grid, as in the design. Enhancements have no severity, so it's left out.</summary>
    private async Task<IReadOnlyList<(string, string)>> SummaryAsync(Ticket ticket, CancellationToken ct)
    {
        var app = ticket.Application ?? await db.Applications.FindAsync([ticket.ApplicationId], ct);
        var status = ticket.Status ?? await db.Statuses.FindAsync([ticket.StatusId], ct);
        var summary = new List<(string, string)>
        {
            ("Application", app?.Name ?? ""),
            ("Type", ticket.Type == TicketType.Defect ? "Defect" : "Enhancement"),
        };
        if (ticket.Severity is { } severity) summary.Add(("Severity", severity.ToString()));
        summary.Add(("Priority", Labels.For(ticket.Priority)));
        summary.Add(("Status", status?.Name ?? ""));
        summary.Add(("Reported by", await NameAsync(ticket.ReportedById, ct)));
        if (!string.IsNullOrWhiteSpace(ticket.EndUserName)) summary.Add(("Called in by", ticket.EndUserName));
        return summary;
    }

    private async Task<string> NameAsync(int userId, CancellationToken ct) =>
        (await db.Users.FindAsync([userId], ct))?.DisplayName ?? "Someone";

    private static string TypeWord(Ticket ticket) => ticket.Type == TicketType.Defect ? "defect" : "enhancement";

    private static string Article(Ticket ticket) => ticket.Type == TicketType.Defect ? "a" : "an";
}
