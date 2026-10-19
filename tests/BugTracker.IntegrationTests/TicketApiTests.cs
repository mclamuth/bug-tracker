using System.Net;
using System.Net.Http.Json;
using BugTracker.Application.Tickets;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

/// <summary>Creating and editing tickets.</summary>
public sealed class TicketApiTests(BugTrackerApiFactory factory) : IClassFixture<BugTrackerApiFactory>
{
    private const string Ken = "kfukumoto@cta.org";

    [Fact]
    public async Task An_unassigned_ticket_starts_as_New_and_emails_Ken_for_triage()
    {
        var elyse = factory.CreateClientAs(SeedData.ElyseOrris);

        var ticket = await elyse.CreateTicketAsync();

        Assert.True(ticket.Number >= BugTrackerDbContext.FirstTicketNumber);
        Assert.Equal($"BT-{ticket.Number}", ticket.DisplayNumber);
        Assert.Equal(StatusIds.New, ticket.StatusId);
        Assert.Null(ticket.Assignee);
        Assert.Equal("Elyse Orris", ticket.Reporter.DisplayName);
        Assert.Equal("Diane Cole, Membership", ticket.EndUserName);
        Assert.Equal(Priority.P2High, ticket.Priority);
        Assert.Contains(ticket.AllowedTransitions, t => t.ToStatusId == StatusIds.Assigned && t.RequiresAssignee);

        var emails = await factory.OutboxForAsync(ticket.Number);
        Assert.Equal([(Ken, NotificationKind.NewTicket)], emails);
    }

    [Fact]
    public async Task Choosing_a_developer_up_front_assigns_it_and_emails_them_too()
    {
        var elyse = factory.CreateClientAs(SeedData.ElyseOrris);

        var ticket = await elyse.CreateTicketAsync(NewDefect(assigneeId: SeedData.MaxCaber));

        Assert.Equal(StatusIds.Assigned, ticket.StatusId);
        Assert.Equal("Max Caber", ticket.Assignee!.DisplayName);
        var emails = await factory.OutboxForAsync(ticket.Number);
        Assert.Contains((Ken, NotificationKind.NewTicket), emails);
        Assert.Contains(("mcaber@cta.org", NotificationKind.Assigned), emails);
    }

    [Fact]
    public async Task Nobody_is_emailed_about_their_own_action()
    {
        var ken = factory.CreateClientAs(SeedData.KenFukumoto);

        var ticket = await ken.CreateTicketAsync();

        Assert.Empty(await factory.OutboxForAsync(ticket.Number));
    }

    [Fact]
    public async Task Ticket_numbers_go_up_by_one()
    {
        var client = factory.CreateClientAs(SeedData.JoshRalls);

        var first = await client.CreateTicketAsync();
        var second = await client.CreateTicketAsync();

        Assert.Equal(first.Number + 1, second.Number);
    }

    [Fact]
    public async Task Missing_fields_come_back_as_a_validation_problem()
    {
        var client = factory.CreateClientAs(SeedData.ElyseOrris);

        var response = await client.PostAsJsonAsync("/api/v1/tickets", new { type = "Defect", title = " " }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.ProblemAsync()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("applicationId", out _));
        Assert.True(errors.TryGetProperty("title", out _));
        Assert.True(errors.TryGetProperty("description", out _));
        Assert.True(errors.TryGetProperty("severity", out _));
    }

    [Fact]
    public async Task Tickets_can_only_be_assigned_to_developers()
    {
        var client = factory.CreateClientAs(SeedData.KenFukumoto);

        var response = await client.PostAsJsonAsync("/api/v1/tickets", NewDefect(assigneeId: SeedData.ElyseOrris), Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ProblemAsync()).GetProperty("errors").TryGetProperty("assigneeId", out _));
    }

    [Fact]
    public async Task Enhancements_drop_the_defect_only_details()
    {
        var client = factory.CreateClientAs(SeedData.MaxCaber);
        var body = new
        {
            type = "Enhancement",
            applicationId = 22,
            title = "Add a bulk-approve option for supervisors",
            description = "Supervisors approve requests one at a time today.",
            severity = "High",
            stepsToReproduce = "n/a",
        };

        var ticket = await client.CreateTicketAsync(body);

        Assert.Equal(TicketType.Enhancement, ticket.Type);
        Assert.Null(ticket.Severity);
        Assert.Null(ticket.StepsToReproduce);
        Assert.Equal(Priority.P3Normal, ticket.Priority);
    }

    [Fact]
    public async Task Unknown_ticket_is_404()
    {
        var response = await factory.CreateClientAs(SeedData.MaxCaber).GetAsync("/api/v1/tickets/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Editing_records_history_and_a_stale_edit_is_rejected()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var ticket = await max.CreateTicketAsync();

        var edited = await (await max.PatchAsJsonAsync($"/api/v1/tickets/{ticket.Number}",
            new { rowVersion = ticket.RowVersion, title = "Mileage doubles after editing a trip", priority = "P1Urgent" }, Json)).ReadTicketAsync();

        Assert.Equal("Mileage doubles after editing a trip", edited.Title);
        Assert.Equal(Priority.P1Urgent, edited.Priority);
        Assert.NotEqual(ticket.RowVersion, edited.RowVersion);

        var history = await max.GetFromJsonAsync<List<HistoryEntryDto>>($"/api/v1/tickets/{ticket.Number}/history", Json);
        Assert.Contains(history!, h => h.FieldName == "Priority" && h.OldValue == "P2 High" && h.NewValue == "P1 Urgent");
        Assert.Contains(history!, h => h.FieldName == "Title" && h.NewValue == "Mileage doubles after editing a trip");
        Assert.Equal("Created", history!.Last().FieldName);

        // Someone still holding the old version can't overwrite the change.
        var stale = await max.PatchAsJsonAsync($"/api/v1/tickets/{ticket.Number}", new { rowVersion = ticket.RowVersion, title = "Old view" }, Json);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
    }

    [Fact]
    public async Task Fields_left_out_of_an_edit_stay_the_same_and_null_clears_them()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var ticket = await max.CreateTicketAsync();

        var edited = await (await max.PatchAsJsonAsync($"/api/v1/tickets/{ticket.Number}",
            new { rowVersion = ticket.RowVersion, endUserName = (string?)null }, Json)).ReadTicketAsync();

        Assert.Null(edited.EndUserName);
        Assert.Equal(ticket.Title, edited.Title);
        Assert.Equal(ticket.StepsToReproduce, edited.StepsToReproduce);
    }

    [Fact]
    public async Task Turning_a_defect_into_an_enhancement_clears_its_severity()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var ticket = await max.CreateTicketAsync();

        var edited = await (await max.PatchAsJsonAsync($"/api/v1/tickets/{ticket.Number}",
            new { rowVersion = ticket.RowVersion, type = "Enhancement" }, Json)).ReadTicketAsync();

        Assert.Null(edited.Severity);
        Assert.Null(edited.Environment);
    }

    [Fact]
    public async Task Dates_read_back_from_the_database_are_marked_as_UTC()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var created = await max.CreateTicketAsync();

        // Read raw JSON, as the browser does: without a trailing Z it would be taken as local time.
        using var json = await System.Text.Json.JsonDocument.ParseAsync(
            await max.GetStreamAsync($"/api/v1/tickets/{created.Number}"));
        var history = await max.GetFromJsonAsync<System.Text.Json.JsonElement>($"/api/v1/tickets/{created.Number}/history");

        Assert.EndsWith("Z", json.RootElement.GetProperty("createdAt").GetString(), StringComparison.Ordinal);
        Assert.EndsWith("Z", json.RootElement.GetProperty("updatedAt").GetString(), StringComparison.Ordinal);
        Assert.EndsWith("Z", history[0].GetProperty("changedAt").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_ticket_and_its_history_can_load_at_the_same_time()
    {
        // The detail page asks for both at once.
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var created = await max.CreateTicketAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(i =>
            max.GetAsync(i % 2 == 0 ? $"/api/v1/tickets/{created.Number}" : $"/api/v1/tickets/{created.Number}/history")));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
    }
}
