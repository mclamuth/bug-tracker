using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BugTracker.Infrastructure.Data;

/// <summary>
/// Used only by the dotnet-ef tool to create and script migrations. The connection string is never
/// opened when adding a migration; for "database update" pass --connection.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<BugTrackerDbContext>
{
    public BugTrackerDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<BugTrackerDbContext>()
            .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=BugTracker;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        return new BugTrackerDbContext(options);
    }
}
