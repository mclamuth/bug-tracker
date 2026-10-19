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
    // A named in-memory database: each request gets its own connection (so parallel requests work, as the
    // detail page's do), and this one stays open to keep the database alive for the factory's lifetime.
    private readonly string _sqliteConnectionString = $"Data Source=bugtracker-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
    private SqliteConnection? _sqlite;
    private bool _dropped;
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
                _sqlite ??= new SqliteConnection(_sqliteConnectionString);
                _sqlite.Open();
                services.AddDbContext<BugTrackerDbContext>(options => options.UseSqlite(_sqliteConnectionString));
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

    public override async ValueTask DisposeAsync()
    {
        await DropSqlServerDatabaseAsync();
        await base.DisposeAsync();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            DropSqlServerDatabaseAsync().AsTask().GetAwaiter().GetResult();
        }

        base.Dispose(disposing);
        if (disposing)
        {
            _sqlite?.Dispose();
            if (Directory.Exists(_files))
            {
                Directory.Delete(_files, recursive: true);
            }
        }
    }

    /// <summary>Drops this factory's SQL Server database with its own context, so it works whatever state the host is in.</summary>
    private async ValueTask DropSqlServerDatabaseAsync()
    {
        if (_sqlServer is null || _dropped)
        {
            return;
        }

        _dropped = true;
        var options = new DbContextOptionsBuilder<BugTrackerDbContext>().UseSqlServer(_sqlServer).Options;
        await using var db = new BugTrackerDbContext(options);
        await db.Database.EnsureDeletedAsync();
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
