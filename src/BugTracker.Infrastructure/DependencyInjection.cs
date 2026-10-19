using BugTracker.Application;
using BugTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BugTracker.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "BugTracker";

    /// <summary>Registers the database and the application services.</summary>
    public static IServiceCollection AddBugTrackerInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is missing. See docs/local-setup.md.");

        services.AddDbContext<BugTrackerDbContext>(options =>
            options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure()));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<BugTrackerDbContext>());

        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<DirectoryService>();
        services.AddScoped<UserProvisioning>();

        return services;
    }
}
