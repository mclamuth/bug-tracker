using BugTracker.Application;
using BugTracker.Application.Notifications;
using BugTracker.Application.Tickets;
using BugTracker.Infrastructure.Data;
using BugTracker.Infrastructure.Storage;
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
        services.AddScoped<ITicketNumbers, SqlTicketNumbers>();
        services.AddScoped<DirectoryService>();
        services.AddScoped<ApplicationService>();
        services.AddScoped<UserProvisioning>();
        services.AddScoped<TicketHistoryWriter>();
        services.AddScoped<NotificationService>();
        services.AddScoped<CommentService>();
        services.AddScoped<AttachmentService>();
        services.AddScoped<TicketService>();

        services.Configure<AppOptions>(configuration.GetSection(AppOptions.SectionName));
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        var storageMode = configuration.GetSection(StorageOptions.SectionName)["Mode"] ?? "Local";
        if (string.Equals(storageMode, "Blob", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IAttachmentStorage, BlobAttachmentStorage>();
        }
        else
        {
            services.AddSingleton<IAttachmentStorage, LocalAttachmentStorage>();
        }

        return services;
    }
}
