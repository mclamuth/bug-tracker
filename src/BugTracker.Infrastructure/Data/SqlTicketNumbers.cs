using BugTracker.Application;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Infrastructure.Data;

/// <summary>
/// Takes the next number from the TicketNumbers sequence on SQL Server. Other databases (the SQLite
/// used in tests) fall back to the highest number plus one.
/// </summary>
public sealed class SqlTicketNumbers(BugTrackerDbContext db) : ITicketNumbers
{
    public async Task<int> NextAsync(CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
        {
            return await db.Database
                .SqlQueryRaw<int>($"SELECT NEXT VALUE FOR [{BugTrackerDbContext.TicketNumberSequence}] AS [Value]")
                .SingleAsync(ct);
        }

        var max = await db.Tickets.MaxAsync(t => (int?)t.TicketNumber, ct);
        return Math.Max(max ?? 0, BugTrackerDbContext.FirstTicketNumber - 1) + 1;
    }
}
