using BugTracker.Application;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BugTracker.Infrastructure.Email;

/// <summary>
/// Sends what's waiting in the EmailOutbox. A failed email is tried again later (after 1, 5, 15, 60 and then
/// 240 minutes) and marked Failed after <see cref="EmailOptions.MaxAttempts"/> tries; the reason is kept in
/// LastError. Emails left unsent for longer than <see cref="EmailOptions.MaxAgeHours"/> are dropped, so an
/// outage doesn't end in a flood of stale notifications.
/// </summary>
public sealed partial class EmailOutboxSender(
    BugTrackerDbContext db,
    IEmailSender sender,
    IClock clock,
    IOptions<EmailOptions> options,
    ILogger<EmailOutboxSender> logger)
{
    public const int BatchSize = 20;
    private static readonly TimeSpan[] Backoff =
    [
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(60),
        TimeSpan.FromMinutes(240),
    ];

    /// <summary>Sends up to one batch of due emails. Returns how many were handled (sent, retried or dropped).</summary>
    public async Task<int> SendDueAsync(CancellationToken ct)
    {
        var settings = options.Value;
        var now = clock.UtcNow;
        var due = await db.EmailOutbox
            .Where(m => m.Status == EmailStatus.Pending && (m.NextAttemptAt == null || m.NextAttemptAt <= now))
            .OrderBy(m => m.Id)
            .Take(BatchSize)
            .ToListAsync(ct);

        foreach (var email in due)
        {
            if (now - email.CreatedAt > TimeSpan.FromHours(settings.MaxAgeHours))
            {
                email.Status = EmailStatus.Failed;
                email.LastError = $"Not sent: still queued after {settings.MaxAgeHours} hours.";
                LogDropped(email.Id, email.ToAddress);
                continue;
            }

            var (to, subject) = string.IsNullOrWhiteSpace(settings.RedirectAllTo)
                ? (email.ToAddress, email.Subject)
                : (settings.RedirectAllTo, $"[for {email.ToAddress}] {email.Subject}");

            email.Attempts++;
            try
            {
                await sender.SendAsync(new EmailMessage(to, subject, email.HtmlBody), ct);
                email.Status = EmailStatus.Sent;
                email.SentAt = clock.UtcNow;
                email.LastError = null;
                email.NextAttemptAt = null;
                LogSent(email.Id, email.Kind, to);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                email.LastError = Application.Notifications.EmailTemplate.Shorten(ex.Message, 2000);
                if (email.Attempts >= settings.MaxAttempts)
                {
                    email.Status = EmailStatus.Failed;
                    LogGaveUp(ex, email.Id, email.ToAddress, email.Attempts);
                }
                else
                {
                    email.NextAttemptAt = clock.UtcNow + Backoff[Math.Min(email.Attempts - 1, Backoff.Length - 1)];
                    LogRetrying(ex, email.Id, email.ToAddress, email.NextAttemptAt.Value);
                }
            }

            // Save after each email, so one that went out is never sent twice if a later one throws.
            await db.SaveChangesAsync(ct);
        }

        await db.SaveChangesAsync(ct);
        return due.Count;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Sent email {Id} ({Kind}) to {To}")]
    private partial void LogSent(long id, NotificationKind kind, string to);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {Id} to {To} failed; trying again at {Next:u}")]
    private partial void LogRetrying(Exception ex, long id, string to, DateTime next);

    [LoggerMessage(Level = LogLevel.Error, Message = "Email {Id} to {To} failed {Attempts} times; giving up")]
    private partial void LogGaveUp(Exception ex, long id, string to, int attempts);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {Id} to {To} was queued too long and won't be sent")]
    private partial void LogDropped(long id, string to);
}

/// <summary>Runs <see cref="EmailOutboxSender"/> in the background every few seconds while the app is up.</summary>
public sealed partial class EmailOutboxWorker(
    IServiceScopeFactory scopes,
    IOptions<EmailOptions> options,
    ILogger<EmailOutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogStarted(options.Value.Mode, options.Value.FromMailbox);
        var pause = TimeSpan.FromSeconds(Math.Max(1, options.Value.PollSeconds));

        while (!stoppingToken.IsCancellationRequested)
        {
            var handled = 0;
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                handled = await scope.ServiceProvider.GetRequiredService<EmailOutboxSender>().SendDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // A database hiccup, say. Keep going; the emails are still queued.
                LogBatchFailed(ex);
            }

            // A full batch means there may be more waiting: go again straight away.
            if (handled < EmailOutboxSender.BatchSize)
            {
                try
                {
                    await Task.Delay(pause, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Email sender started ({Mode}, from {From})")]
    private partial void LogStarted(string mode, string from);

    [LoggerMessage(Level = LogLevel.Error, Message = "Sending queued emails failed; will try again")]
    private partial void LogBatchFailed(Exception ex);
}
