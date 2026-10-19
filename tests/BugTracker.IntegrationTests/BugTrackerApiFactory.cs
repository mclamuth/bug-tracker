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
/// Hosts the real API in memory with development sign-in and an in-memory SQLite database,
/// so the HTTP surface can be tested without SQL Server. SQL Server–specific behaviour is
/// covered by running the migrations in CI.
/// </summary>
public sealed class BugTrackerApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:BugTracker", "Server=unused");
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.UseSetting("Auth:Mode", "Development");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<BugTrackerDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<BugTrackerDbContext>>();

            _connection.Open();
            services.AddDbContext<BugTrackerDbContext>(options => options.UseSqlite(_connection));

            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();
            scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>().Database.EnsureCreated();
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
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}
