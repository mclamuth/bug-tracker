using System.Net.Http.Json;
using BugTracker.Application;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using BugTracker.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

/// <summary>What the emails say, and how the outbox sender delivers, retries and gives up.</summary>
public sealed class EmailOutboxTests(BugTrackerApiFactory factory) : IClassFixture<BugTrackerApiFactory>
{
    private sealed class FakeClock : IClock
    {
        public DateTime UtcNow { get; set; } = DateTime.UtcNow;
    }

    private sealed class RecordingSender(int failures = 0) : IEmailSender
    {
        private int _failuresLeft = failures;
        public List<EmailMessage> Sent { get; } = [];

        public Task SendAsync(EmailMessage message, CancellationToken ct)
        {
            if (_failuresLeft-- > 0) throw new HttpRequestException("Graph is unavailable");
            Sent.Add(message);
            return Task.CompletedTask;
        }
    }

    /// <summary>Runs the sender against the test database, for only the emails of one ticket.</summary>
    private async Task<int> SendAsync(IEmailSender sender, FakeClock clock, int ticketNumber, EmailOptions? settings = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>();
        // Other tests' emails are already in this database: set them aside so this ticket's are the only ones due.
        await db.EmailOutbox.Where(m => m.Status == EmailStatus.Pending && m.Ticket!.TicketNumber != ticketNumber)
            .ExecuteUpdateAsync(u => u.SetProperty(m => m.Status, EmailStatus.Failed));
        var outbox = new EmailOutboxSender(db, sender, clock, Options.Create(settings ?? new EmailOptions()), NullLogger<EmailOutboxSender>.Instance);
        return await outbox.SendDueAsync(CancellationToken.None);
    }

    private async Task<List<EmailOutbox>> RowsAsync(int ticketNumber)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>();
        return await db.EmailOutbox.AsNoTracking().Where(m => m.Ticket!.TicketNumber == ticketNumber).OrderBy(m => m.Id).ToListAsync();
    }

    [Fact]
    public async Task Queued_emails_are_sent_and_marked_sent()
    {
        var ticket = await factory.CreateClientAs(SeedData.ElyseOrris).CreateTicketAsync();
        var sender = new RecordingSender();

        await SendAsync(sender, new FakeClock(), ticket.Number);

        var email = Assert.Single(sender.Sent);
        Assert.Equal("kfukumoto@cta.org", email.To);
        Assert.StartsWith($"[{ticket.DisplayNumber}] New defect needs triage", email.Subject, StringComparison.Ordinal);
        Assert.Contains("A new ticket needs triage", email.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("Elyse Orris submitted a new unassigned defect.", email.HtmlBody, StringComparison.Ordinal);
        var row = Assert.Single(await RowsAsync(ticket.Number));
        Assert.Equal(EmailStatus.Sent, row.Status);
        Assert.NotNull(row.SentAt);
        Assert.Equal(1, row.Attempts);
    }

    [Fact]
    public async Task A_failed_send_is_retried_later_then_given_up()
    {
        var ticket = await factory.CreateClientAs(SeedData.ElyseOrris).CreateTicketAsync();
        var clock = new FakeClock();
        var failing = new RecordingSender(failures: 99);
        var settings = new EmailOptions { MaxAttempts = 3 };

        await SendAsync(failing, clock, ticket.Number, settings);
        var row = Assert.Single(await RowsAsync(ticket.Number));
        Assert.Equal(EmailStatus.Pending, row.Status);
        Assert.Equal(1, row.Attempts);
        Assert.Equal("Graph is unavailable", row.LastError);
        Assert.True(row.NextAttemptAt > clock.UtcNow);

        // Not due yet: nothing happens.
        Assert.Equal(0, await SendAsync(failing, clock, ticket.Number, settings));

        clock.UtcNow = clock.UtcNow.AddMinutes(2);
        await SendAsync(failing, clock, ticket.Number, settings);
        clock.UtcNow = clock.UtcNow.AddMinutes(10);
        await SendAsync(failing, clock, ticket.Number, settings);

        row = Assert.Single(await RowsAsync(ticket.Number));
        Assert.Equal(EmailStatus.Failed, row.Status);
        Assert.Equal(3, row.Attempts);
    }

    [Fact]
    public async Task It_recovers_when_sending_works_again()
    {
        var ticket = await factory.CreateClientAs(SeedData.ElyseOrris).CreateTicketAsync();
        var clock = new FakeClock();
        var flaky = new RecordingSender(failures: 1);

        await SendAsync(flaky, clock, ticket.Number);
        clock.UtcNow = clock.UtcNow.AddMinutes(2);
        await SendAsync(flaky, clock, ticket.Number);

        Assert.Single(flaky.Sent);
        var row = Assert.Single(await RowsAsync(ticket.Number));
        Assert.Equal(EmailStatus.Sent, row.Status);
        Assert.Null(row.LastError);
    }

    [Fact]
    public async Task Stale_emails_are_dropped_instead_of_sent_late()
    {
        var ticket = await factory.CreateClientAs(SeedData.ElyseOrris).CreateTicketAsync();
        var sender = new RecordingSender();

        await SendAsync(sender, new FakeClock { UtcNow = DateTime.UtcNow.AddHours(49) }, ticket.Number);

        Assert.Empty(sender.Sent);
        var row = Assert.Single(await RowsAsync(ticket.Number));
        Assert.Equal(EmailStatus.Failed, row.Status);
        Assert.Contains("48 hours", row.LastError, StringComparison.Ordinal);
    }

    [Fact]
    public async Task In_the_Test_environment_everything_can_go_to_one_address()
    {
        var ticket = await factory.CreateClientAs(SeedData.ElyseOrris).CreateTicketAsync();
        var sender = new RecordingSender();

        await SendAsync(sender, new FakeClock(), ticket.Number, new EmailOptions { RedirectAllTo = "mlamuth@cta.org" });

        var email = Assert.Single(sender.Sent);
        Assert.Equal("mlamuth@cta.org", email.To);
        Assert.StartsWith("[for kfukumoto@cta.org] ", email.Subject, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Each_email_carries_the_note_or_comment_that_goes_with_it()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var ticket = await factory.CreateClientAs(SeedData.ElyseOrris).CreateTicketAsync();

        await (await ken.PutAsJsonAsync($"/api/v1/tickets/{ticket.Number}/assignee",
            new { assigneeId = SeedData.MaxCaber, comment = "Please look at this first." }, Json)).EnsureOkAsync();
        await (await max.MoveAsync(ticket.Number, StatusIds.InProgress)).EnsureOkAsync();
        await (await max.PostAsJsonAsync($"/api/v1/tickets/{ticket.Number}/comments",
            new { body = "@Elyse Orris can you check <this>?" }, Json)).EnsureOkAsync();
        await (await max.MoveAsync(ticket.Number, StatusIds.ReadyForTest, new { comment = "Try a long trip." })).EnsureOkAsync();
        await (await factory.CreateClientAs(SeedData.ElyseOrris).MoveAsync(ticket.Number, StatusIds.Reopened, new { comment = "Still doubles." })).EnsureOkAsync();

        var rows = await RowsAsync(ticket.Number);
        string Body(NotificationKind kind) => rows.Single(r => r.Kind == kind).HtmlBody;

        Assert.Contains("Ken Fukumoto assigned you a defect.", Body(NotificationKind.Assigned), StringComparison.Ordinal);
        Assert.Contains("Please look at this first.", Body(NotificationKind.Assigned), StringComparison.Ordinal);
        Assert.Contains("Max Caber mentioned you on", Body(NotificationKind.Mentioned), StringComparison.Ordinal);
        Assert.Contains("can you check &lt;this&gt;?", Body(NotificationKind.Mentioned), StringComparison.Ordinal);
        Assert.Contains("Ready for you to test", Body(NotificationKind.ReadyForTest), StringComparison.Ordinal);
        Assert.Contains("Try a long trip.", Body(NotificationKind.ReadyForTest), StringComparison.Ordinal);
        Assert.Contains("Elyse Orris reopened a defect assigned to you.", Body(NotificationKind.Reopened), StringComparison.Ordinal);
        Assert.Contains("Still doubles.", Body(NotificationKind.Reopened), StringComparison.Ordinal);
        Assert.Contains($"/tickets/{ticket.Number}", Body(NotificationKind.Reopened), StringComparison.Ordinal);
    }
}
