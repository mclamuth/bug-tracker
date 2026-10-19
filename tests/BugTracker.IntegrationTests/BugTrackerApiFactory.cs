using BugTracker.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BugTracker.IntegrationTests;

/// <summary>
/// Hosts the real API in memory with development sign-in.
/// <para>
/// By default the database is in-memory SQLite, so the tests run anywhere in seconds. When the
/// BUGTRACKER_TEST_SQLSERVER environment variable holds a SQL Server connection string (CI sets it),
/// each test class instead gets its own SQL Server database, built by the real migrations and dropped
/// afterwards, so SQL Server–specific behaviour (ticket-number sequence, rowversion) is tested too.
/// </para>
/// </summary>
public sealed class BugTrackerApiFactory : WebApplicationFactory<Program>
{
    public const string SqlServerVariable = "BUGTRACKER_TEST_SQLSERVER";

    private readonly string? _sqlServer = BuildSqlServerConnectionString();
    private readonly SqliteConnection _sqlite = new("DataSource=:memory:");
    private readonly string _files = Path.Combine(Path.GetTempPath(), "bugtracker-tests", Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:BugTracker", _sqlServer ?? "Server=unused");
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.UseSetting("Auth:Mode", "Development");
        builder.UseSetting("Storage:Mode", "Local");
        builder.UseSetting("Storage:LocalPath", _files);

        builder.ConfigureServices(services =>
        {
            if (_sqlServer is null)
            {
                services.RemoveAll<DbContextOptions<BugTrackerDbContext>>();
                services.RemoveAll<IDbContextOptionsConfiguration<BugTrackerDbContext>>();
                _sqlite.Open();
                services.AddDbContext<BugTrackerDbContext>(options => options.UseSqlite(_sqlite));
            }

            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>();
            if (_sqlServer is null)
            {
                db.Database.EnsureCreated();
            }
            else
            {
                db.Database.Migrate();
            }
        });
    }

    public HttpClient CreateClientAs(int userId)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-Dev-User-Id", userId.ToString(System.Globalization.CultureInfo.InvariantCulture));
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && _sqlServer is not null)
        {
            using var scope = Services.CreateScope();
            scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>().Database.EnsureDeleted();
        }

        base.Dispose(disposing);
        if (disposing)
        {
            _sqlite.Dispose();
            if (Directory.Exists(_files))
            {
                Directory.Delete(_files, recursive: true);
            }
        }
    }

    private static string? BuildSqlServerConnectionString()
    {
        var baseConnection = Environment.GetEnvironmentVariable(SqlServerVariable);
        if (string.IsNullOrWhiteSpace(baseConnection))
        {
            return null;
        }

        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(baseConnection)
        {
            InitialCatalog = $"BugTrackerTest_{Guid.NewGuid():N}",
        };
        return builder.ConnectionString;
    }
}
