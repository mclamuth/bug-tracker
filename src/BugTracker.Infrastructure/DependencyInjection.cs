using Azure.Core;
using Azure.Identity;
using BugTracker.Application;
using BugTracker.Application.Notifications;
using BugTracker.Application.Tickets;
using BugTracker.Infrastructure.Data;
using BugTracker.Infrastructure.Email;
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
        services.AddScoped<DashboardService>();

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

        AddEmail(services, configuration);
        return services;
    }

    /// <summary>The background sender for queued emails, with the delivery the configuration asks for.</summary>
    private static void AddEmail(IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(EmailOptions.SectionName);
        services.Configure<EmailOptions>(section);
        var email = section.Get<EmailOptions>() ?? new EmailOptions();

        if (string.Equals(email.Mode, EmailModes.Graph, StringComparison.OrdinalIgnoreCase))
        {
            var graph = email.Graph;
            TokenCredential credential = string.IsNullOrWhiteSpace(graph.ClientSecret)
                ? new DefaultAzureCredential() // the App Service's managed identity in Azure
                : new ClientSecretCredential(graph.TenantId, graph.ClientId, graph.ClientSecret);
            services.AddSingleton(credential);
            services.AddHttpClient<IEmailSender, GraphEmailSender>(client => client.Timeout = TimeSpan.FromSeconds(60));
        }
        else if (string.Equals(email.Mode, EmailModes.Pickup, StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IEmailSender, PickupEmailSender>();
        }
        else
        {
            return; // None: emails stay queued.
        }

        services.AddScoped<EmailOutboxSender>();
        services.AddHostedService<EmailOutboxWorker>();
    }
}
