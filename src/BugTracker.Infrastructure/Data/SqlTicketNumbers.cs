using BugTracker.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

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
            // A plain command, not SqlQueryRaw: EF wraps raw queries it composes over in a derived table,
            // and SQL Server doesn't allow NEXT VALUE FOR there.
            var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await db.Database.OpenConnectionAsync(ct);
            }

            await using var command = connection.CreateCommand();
            command.CommandText = $"SELECT NEXT VALUE FOR [{BugTrackerDbContext.TicketNumberSequence}]";
            command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
            return Convert.ToInt32(await command.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture);
        }

        var max = await db.Tickets.MaxAsync(t => (int?)t.TicketNumber, ct);
        return Math.Max(max ?? 0, BugTrackerDbContext.FirstTicketNumber - 1) + 1;
    }
}
