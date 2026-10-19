using System.Net;
using System.Net.Http.Json;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

/// <summary>Status changes and assignment, following the "Ticket workflow" section of the design doc.</summary>
public sealed class WorkflowApiTests(BugTrackerApiFactory factory) : IClassFixture<BugTrackerApiFactory>
{
    [Fact]
    public async Task Triage_assigns_in_one_step_and_emails_the_developer()
    {
        var elyse = factory.CreateClientAs(SeedData.ElyseOrris);
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var ticket = await elyse.CreateTicketAsync();

        var assigned = await (await ken.MoveAsync(ticket.Number, StatusIds.Assigned, new { assigneeId = SeedData.HueChi })).ReadTicketAsync();

        Assert.Equal(StatusIds.Assigned, assigned.StatusId);
        Assert.Equal("Hue Chi", assigned.Assignee!.DisplayName);
        Assert.Contains(("hchi@cta.org", NotificationKind.Assigned), await factory.OutboxForAsync(ticket.Number));
    }

    [Fact]
    public async Task Moving_to_Assigned_without_a_developer_is_rejected()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var ticket = await ken.CreateTicketAsync();

        var response = await ken.MoveAsync(ticket.Number, StatusIds.Assigned);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Moves_the_workflow_does_not_allow_are_a_conflict()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var ticket = await ken.CreateTicketAsync();

        var response = await ken.MoveAsync(ticket.Number, StatusIds.Closed);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("A ticket can't move from New to Closed.", (await response.ProblemAsync()).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Wont_fix_needs_a_reason_and_a_resolution()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var ticket = await ken.CreateTicketAsync();

        var missing = await ken.MoveAsync(ticket.Number, StatusIds.WontFix);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        var errors = (await missing.ProblemAsync()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("comment", out _));
        Assert.True(errors.TryGetProperty("resolution", out _));

        var closed = await (await ken.MoveAsync(ticket.Number, StatusIds.WontFix,
            new { comment = "Working as designed per the policy team.", resolution = "ByDesign" })).ReadTicketAsync();

        Assert.Equal(StatusIds.WontFix, closed.StatusId);
        Assert.True(closed.IsClosed);
        Assert.Equal(Resolution.ByDesign, closed.Resolution);
        Assert.NotNull(closed.ClosedAt);
        Assert.Equal("Working as designed per the policy team.", closed.Comments[0].Body);
    }

    [Fact]
    public async Task A_duplicate_must_point_at_another_ticket()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var original = await ken.CreateTicketAsync();
        var copy = await ken.CreateTicketAsync();

        var self = await ken.MoveAsync(copy.Number, StatusIds.WontFix, new { comment = "Dup", resolution = "Duplicate", duplicateOfNumber = copy.Number });
        Assert.Equal(HttpStatusCode.BadRequest, self.StatusCode);

        var closed = await (await ken.MoveAsync(copy.Number, StatusIds.WontFix,
            new { comment = "Same as the earlier report.", resolution = "Duplicate", duplicateOfNumber = original.Number })).ReadTicketAsync();
        Assert.Equal(original.Number, closed.DuplicateOfNumber);
    }

    [Fact]
    public async Task Full_lifecycle_from_report_to_closed_and_reopened()
    {
        var elyse = factory.CreateClientAs(SeedData.ElyseOrris);
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var n = (await elyse.CreateTicketAsync()).Number;

        await (await ken.MoveAsync(n, StatusIds.Assigned, new { assigneeId = SeedData.MaxCaber })).ReadTicketAsync();
        await (await max.MoveAsync(n, StatusIds.InProgress)).ReadTicketAsync();
        await (await max.MoveAsync(n, StatusIds.ReadyForTest, new { comment = "Fixed the edit calculation." })).ReadTicketAsync();

        // The reporter is told it's ready to test.
        Assert.Contains(("eorris@cta.org", NotificationKind.ReadyForTest), await factory.OutboxForAsync(n));

        // Failing the test needs a reason, and emails the developer.
        Assert.Equal(HttpStatusCode.BadRequest, (await elyse.MoveAsync(n, StatusIds.Reopened)).StatusCode);
        await (await elyse.MoveAsync(n, StatusIds.Reopened, new { comment = "Still doubles for round trips." })).ReadTicketAsync();
        Assert.Contains(("mcaber@cta.org", NotificationKind.Reopened), await factory.OutboxForAsync(n));

        await (await max.MoveAsync(n, StatusIds.InProgress)).ReadTicketAsync();
        await (await max.MoveAsync(n, StatusIds.ReadyForTest)).ReadTicketAsync();
        await (await elyse.MoveAsync(n, StatusIds.Verified)).ReadTicketAsync();
        var closed = await (await elyse.MoveAsync(n, StatusIds.Closed)).ReadTicketAsync();

        Assert.Equal(Resolution.Fixed, closed.Resolution);
        Assert.NotNull(closed.ClosedAt);
        Assert.Equal([StatusIds.Reopened], closed.AllowedTransitions.Select(t => t.ToStatusId));

        var reopened = await (await elyse.MoveAsync(n, StatusIds.Reopened, new { comment = "Came back after the release." })).ReadTicketAsync();
        Assert.Null(reopened.Resolution);
        Assert.Null(reopened.ClosedAt);
        Assert.Equal("Max Caber", reopened.Assignee!.DisplayName);

        var history = await max.GetFromJsonAsync<List<Application.Tickets.HistoryEntryDto>>($"/api/v1/tickets/{n}/history", Json);
        Assert.Equal("Reopened", history![0].NewValue);
        Assert.Contains(history, h => h is { FieldName: "Status", OldValue: "Ready for Test", NewValue: "Verified" });
    }

    [Fact]
    public async Task Closing_an_enhancement_marks_it_implemented()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var n = (await max.CreateTicketAsync(new
        {
            type = "Enhancement",
            applicationId = 7,
            title = "Add a department filter",
            description = "Filter search results by department.",
            assigneeId = SeedData.MaxCaber,
        })).Number;

        foreach (var status in new[] { StatusIds.InProgress, StatusIds.ReadyForTest, StatusIds.Verified })
        {
            await (await max.MoveAsync(n, status)).EnsureOkAsync();
        }
        var closed = await (await max.MoveAsync(n, StatusIds.Closed)).ReadTicketAsync();

        Assert.Equal(Resolution.Implemented, closed.Resolution);
    }

    [Fact]
    public async Task Unassigning_puts_the_ticket_back_in_the_backlog()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var n = (await ken.CreateTicketAsync(NewDefect(assigneeId: SeedData.BobbyMcDonald))).Number;

        var backlog = await (await ken.MoveAsync(n, StatusIds.Triaged)).ReadTicketAsync();

        Assert.Equal(StatusIds.Triaged, backlog.StatusId);
        Assert.Null(backlog.Assignee);
    }

    [Fact]
    public async Task Assigning_a_new_ticket_makes_it_Assigned_but_reassigning_work_in_progress_keeps_its_status()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var n = (await ken.CreateTicketAsync()).Number;

        var assigned = await (await ken.PutAsJsonAsync($"/api/v1/tickets/{n}/assignee", new { assigneeId = SeedData.MaxCaber }, Json)).ReadTicketAsync();
        Assert.Equal(StatusIds.Assigned, assigned.StatusId);

        await (await factory.CreateClientAs(SeedData.MaxCaber).MoveAsync(n, StatusIds.InProgress)).ReadTicketAsync();
        var reassigned = await (await ken.PutAsJsonAsync($"/api/v1/tickets/{n}/assignee",
            new { assigneeId = SeedData.ShyamalGurazada, comment = "Shyamal knows this code best." }, Json)).ReadTicketAsync();

        Assert.Equal(StatusIds.InProgress, reassigned.StatusId);
        Assert.Equal("Shyamal Gurazada", reassigned.Assignee!.DisplayName);
        Assert.Equal("Shyamal knows this code best.", reassigned.Comments[0].Body);
        Assert.Contains(("sgurazada@cta.org", NotificationKind.Assigned), await factory.OutboxForAsync(n));
    }

    [Fact]
    public async Task Closed_tickets_cannot_be_reassigned()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);
        var n = (await ken.CreateTicketAsync()).Number;
        await (await ken.MoveAsync(n, StatusIds.WontFix, new { comment = "Not needed.", resolution = "WontFix" })).EnsureOkAsync();

        var response = await ken.PutAsJsonAsync($"/api/v1/tickets/{n}/assignee", new { assigneeId = SeedData.MaxCaber }, Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }
}
