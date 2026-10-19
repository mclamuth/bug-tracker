using System.Globalization;
using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application.Tickets;

/// <summary>
/// Records field-by-field history: take a snapshot before a change, then compare after it and add
/// one TicketHistory row per field that changed, with readable values ("P2 High", "Max Caber").
/// </summary>
public sealed class TicketHistoryWriter(IAppDbContext db, IClock clock)
{
    private const int MaxValueLength = 2000;

    public static IReadOnlyDictionary<string, object?> Snapshot(Ticket t) => new Dictionary<string, object?>
    {
        ["Type"] = t.Type,
        ["Application"] = t.ApplicationId,
        ["Title"] = t.Title,
        ["Description"] = t.Description,
        ["Called in by"] = t.EndUserName,
        ["Steps to reproduce"] = t.StepsToReproduce,
        ["Expected result"] = t.ExpectedResult,
        ["Actual result"] = t.ActualResult,
        ["Environment"] = t.Environment,
        ["Severity"] = t.Severity,
        ["Priority"] = t.Priority,
        ["Resolution"] = t.Resolution,
        ["Duplicate of"] = t.DuplicateOfTicketId,
        ["Due date"] = t.DueDate,
        // Last, so in a newest-first feed the status and assignee changes appear above the details.
        ["Assignee"] = t.AssignedToId,
        ["Status"] = t.StatusId,
    };

    /// <summary>Adds a history row for each field that differs from <paramref name="before"/>. Returns how many.</summary>
    public async Task<int> RecordChangesAsync(Ticket ticket, IReadOnlyDictionary<string, object?> before, int actorId, CancellationToken ct)
    {
        var after = Snapshot(ticket);
        var changed = after.Where(kv => !Equals(before[kv.Key], kv.Value)).Select(kv => kv.Key).ToList();
        foreach (var field in changed)
        {
            Add(ticket, actorId, field,
                await DescribeAsync(field, before[field], ct),
                await DescribeAsync(field, after[field], ct));
        }
        return changed.Count;
    }

    public void Add(Ticket ticket, int actorId, string field, string? oldValue, string? newValue) =>
        db.TicketHistory.Add(new TicketHistory
        {
            Ticket = ticket,
            ChangedById = actorId,
            ChangedAt = clock.UtcNow,
            FieldName = field,
            OldValue = Trim(oldValue),
            NewValue = Trim(newValue),
        });

    private async Task<string?> DescribeAsync(string field, object? value, CancellationToken ct)
    {
        if (value is null)
        {
            return null;
        }

        return field switch
        {
            "Application" => (await db.Applications.FindAsync([value], ct))?.Name,
            "Assignee" => (await db.Users.FindAsync([value], ct))?.DisplayName,
            "Status" => (await db.Statuses.FindAsync([value], ct))?.Name,
            "Duplicate of" => await db.Tickets.Where(t => t.Id == (int)value).Select(t => "BT-" + t.TicketNumber).FirstOrDefaultAsync(ct),
            "Due date" => ((DateOnly)value).ToString("MMMM d, yyyy", CultureInfo.InvariantCulture),
            _ when value is Enum e => Labels.For(e),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture),
        };
    }

    private static string? Trim(string? value) =>
        value is null || value.Length <= MaxValueLength ? value : value[..(MaxValueLength - 1)] + "…";
}

/// <summary>Readable labels for the fixed value sets.</summary>
public static class Labels
{
    public static string For(Enum value) => value switch
    {
        Priority p => DisplayNames.Priorities.First(o => o.Value == p.ToString()).Label,
        Resolution r => DisplayNames.Resolutions.First(o => o.Value == r.ToString()).Label,
        _ => value.ToString(),
    };
}
