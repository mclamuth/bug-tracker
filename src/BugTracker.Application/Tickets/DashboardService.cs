using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application.Tickets;

/// <summary>The numbers on the My Work cards. Each matches a ticket-list view the card links to.</summary>
public sealed record DashboardCountsDto(
    int AssignedToMe,
    int MyReopened,
    int CriticalOpen,
    int OpenedThisWeek,
    int ReadyForTest,
    int ReportedByMe,
    int Reopened,
    int NeedsTriage,
    int Unassigned,
    int OpenWithDeveloper,
    int ActiveDevelopment);

/// <summary>One developer's active work, for the supervisor's Team workload panel.</summary>
public sealed record WorkloadDto(PersonDto Developer, int Assigned, int InProgress, int Reopened);

/// <summary>
/// A recent event for the "Recently updated" panel. Kind is created, status, assignee or comment; for status
/// and assignee changes the old and new values are the names shown in the ticket history.
/// </summary>
public sealed record ActivityDto(string Kind, PersonDto By, DateTime At, int TicketNumber, string TicketTitle, string? OldValue, string? NewValue);

/// <summary>Everything the My Work page shows, for whichever role the person is viewing as.</summary>
public sealed record DashboardDto(
    DashboardCountsDto Counts,
    IReadOnlyList<TicketListItemDto> MyActive,
    IReadOnlyList<TicketListItemDto> ReadyForTest,
    IReadOnlyList<TicketListItemDto> ReportedByMe,
    IReadOnlyList<TicketListItemDto> NeedsTriage,
    IReadOnlyList<WorkloadDto> Workload,
    IReadOnlyList<ActivityDto> RecentActivity);

/// <summary>
/// Builds the My Work page in one call. The whole team's data is small (a handful of people, hundreds of
/// tickets), so every role's sections come back together and the page shows the ones that apply.
/// </summary>
public sealed class DashboardService(IAppDbContext db, ICurrentUser current, IClock clock, TicketService tickets)
{
    private static readonly int[] ActiveStatuses = [StatusIds.Assigned, StatusIds.InProgress, StatusIds.Reopened];
    private static readonly string[] ActivityFields = ["Created", "Status", "Assignee"];

    public async Task<DashboardDto> GetAsync(CancellationToken ct)
    {
        var me = current.UserId;
        var closed = await db.Statuses.Where(s => s.IsClosed).Select(s => s.Id).ToListAsync(ct);
        var all = db.Tickets.AsNoTracking();
        var open = all.Where(t => !closed.Contains(t.StatusId));
        var weekAgo = clock.UtcNow.AddDays(-7);

        var counts = new DashboardCountsDto(
            AssignedToMe: await open.CountAsync(t => t.AssignedToId == me, ct),
            MyReopened: await open.CountAsync(t => t.AssignedToId == me && t.StatusId == StatusIds.Reopened, ct),
            CriticalOpen: await open.CountAsync(t => t.Severity == Severity.Critical, ct),
            OpenedThisWeek: await all.CountAsync(t => t.CreatedAt >= weekAgo, ct),
            ReadyForTest: await all.CountAsync(t => t.StatusId == StatusIds.ReadyForTest, ct),
            ReportedByMe: await open.CountAsync(t => t.ReportedById == me, ct),
            Reopened: await all.CountAsync(t => t.StatusId == StatusIds.Reopened, ct),
            NeedsTriage: await all.CountAsync(t => t.StatusId == StatusIds.New, ct),
            Unassigned: await open.CountAsync(t => t.AssignedToId == null, ct),
            OpenWithDeveloper: await open.CountAsync(t => t.AssignedToId != null, ct),
            ActiveDevelopment: await all.CountAsync(t => t.AssignedToId != null && ActiveStatuses.Contains(t.StatusId), ct));

        // Reopened first (it came back from testing), then In Progress, then Assigned.
        var mine = await ListAsync(new TicketQuery { View = "assigned-to-me", PageSize = TicketService.MaxPageSize }, ct);
        var myActive = mine.Where(t => ActiveStatuses.Contains(t.StatusId))
            .OrderBy(t => Array.IndexOf([StatusIds.Reopened, StatusIds.InProgress, StatusIds.Assigned], t.StatusId))
            .ThenByDescending(t => t.UpdatedAt)
            .ToList();

        return new DashboardDto(
            counts,
            myActive,
            await ListAsync(new TicketQuery { View = "open", StatusId = StatusIds.ReadyForTest, Sort = "updated", PageSize = 50 }, ct),
            await ListAsync(new TicketQuery { View = "reported-by-me", Sort = "updated", PageSize = 10 }, ct),
            // Oldest first: the longest-waiting ticket is triaged first.
            await ListAsync(new TicketQuery { View = "open", StatusId = StatusIds.New, Sort = "created", Direction = "asc", PageSize = 50 }, ct),
            await WorkloadAsync(ct),
            await RecentActivityAsync(ct));
    }

    private async Task<IReadOnlyList<TicketListItemDto>> ListAsync(TicketQuery query, CancellationToken ct)
    {
        var result = await tickets.ListAsync(query, ct);
        return result.IsSuccess ? result.Value!.Items : [];
    }

    private async Task<IReadOnlyList<WorkloadDto>> WorkloadAsync(CancellationToken ct)
    {
        var developers = await db.Users.AsNoTracking()
            .Where(u => u.IsDeveloper && u.IsActive)
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync(ct);
        var counts = await db.Tickets.AsNoTracking()
            .Where(t => t.AssignedToId != null && ActiveStatuses.Contains(t.StatusId))
            .GroupBy(t => new { t.AssignedToId, t.StatusId })
            .Select(g => new { g.Key.AssignedToId, g.Key.StatusId, Count = g.Count() })
            .ToListAsync(ct);

        int Count(int developerId, int statusId) =>
            counts.FirstOrDefault(c => c.AssignedToId == developerId && c.StatusId == statusId)?.Count ?? 0;

        return developers
            .Select(d => new WorkloadDto(
                TicketService.Person(d.Id, d.DisplayName),
                Count(d.Id, StatusIds.Assigned),
                Count(d.Id, StatusIds.InProgress),
                Count(d.Id, StatusIds.Reopened)))
            .OrderByDescending(w => w.Assigned + w.InProgress + w.Reopened)
            .ThenBy(w => w.Developer.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>The latest reports, status changes, assignments and comments across all tickets.</summary>
    private async Task<IReadOnlyList<ActivityDto>> RecentActivityAsync(CancellationToken ct)
    {
        const int take = 8;
        var changes = await db.TicketHistory.AsNoTracking()
            .Where(h => ActivityFields.Contains(h.FieldName))
            .OrderByDescending(h => h.ChangedAt).ThenByDescending(h => h.Id)
            .Take(take)
            .Select(h => new
            {
                h.FieldName,
                ById = h.ChangedById,
                ByName = h.ChangedBy!.DisplayName,
                At = h.ChangedAt,
                h.Ticket!.TicketNumber,
                h.Ticket.Title,
                h.OldValue,
                h.NewValue,
            })
            .ToListAsync(ct);
        var comments = await db.Comments.AsNoTracking()
            .OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)
            .Take(take)
            .Select(c => new { ById = c.AuthorId, ByName = c.Author!.DisplayName, At = c.CreatedAt, c.Ticket!.TicketNumber, c.Ticket.Title })
            .ToListAsync(ct);

        return changes
            .Select(h => new ActivityDto(h.FieldName.ToLowerInvariant(), TicketService.Person(h.ById, h.ByName), h.At, h.TicketNumber, h.Title, h.OldValue, h.NewValue))
            .Concat(comments.Select(c => new ActivityDto("comment", TicketService.Person(c.ById, c.ByName), c.At, c.TicketNumber, c.Title, null, null)))
            .OrderByDescending(a => a.At)
            .Take(take)
            .ToList();
    }
}
