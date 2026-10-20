using System.Net;
using System.Net.Http.Json;
using BugTracker.Application;
using BugTracker.Infrastructure.Data;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

/// <summary>Adding, editing and switching off applications (the Applications admin page).</summary>
public sealed class ApplicationApiTests(BugTrackerApiFactory factory) : IClassFixture<BugTrackerApiFactory>
{
    private HttpClient Michael => factory.CreateClientAs(SeedData.MichaelLamuth);

    private static object NewApp(string name, string? url = "https://payroll.cta.org/", int? developer = SeedData.HueChi) => new
    {
        name,
        description = "Payroll corrections and approvals",
        defaultAssigneeId = developer,
        launcherUrl = url,
        isActive = true,
    };

    [Fact]
    public async Task Adding_an_application_makes_it_available_for_tickets_and_the_launcher()
    {
        var response = await Michael.PostAsJsonAsync("/api/v1/applications", NewApp("Payroll Corrections"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var app = (await response.Content.ReadFromJsonAsync<ApplicationDto>(Json))!;
        Assert.True(app.Id > 22);
        Assert.Equal("Hue Chi", app.DefaultAssigneeName);
        Assert.Equal("https://payroll.cta.org/", app.LauncherUrl);
        Assert.Equal(0, app.OpenTickets);

        var all = await Michael.GetFromJsonAsync<ApplicationDto[]>("/api/v1/applications", Json);
        Assert.Contains(all!, a => a.Id == app.Id);
        var ticket = await Michael.CreateTicketAsync(NewDefect(applicationId: app.Id));
        Assert.Equal("Payroll Corrections", ticket.ApplicationName);
    }

    [Fact]
    public async Task Editing_changes_every_field_and_blank_values_clear()
    {
        var created = (await (await Michael.PostAsJsonAsync("/api/v1/applications", NewApp("Mileage Log"))).Content
            .ReadFromJsonAsync<ApplicationDto>(Json))!;

        var response = await Michael.PutAsJsonAsync($"/api/v1/applications/{created.Id}", new
        {
            name = "  Mileage Logbook ",
            description = "",
            defaultAssigneeId = (int?)null,
            launcherUrl = " ",
            isActive = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var app = (await response.Content.ReadFromJsonAsync<ApplicationDto>(Json))!;
        Assert.Equal("Mileage Logbook", app.Name);
        Assert.Null(app.Description);
        Assert.Null(app.DefaultAssigneeId);
        Assert.Null(app.LauncherUrl);
    }

    [Fact]
    public async Task A_switched_off_application_keeps_its_tickets_but_takes_no_new_ones()
    {
        var created = (await (await Michael.PostAsJsonAsync("/api/v1/applications", NewApp("Old Intranet"))).Content
            .ReadFromJsonAsync<ApplicationDto>(Json))!;
        var ticket = await Michael.CreateTicketAsync(NewDefect(applicationId: created.Id));

        var off = await Michael.PutAsJsonAsync($"/api/v1/applications/{created.Id}", new
        {
            name = "Old Intranet",
            defaultAssigneeId = SeedData.HueChi,
            launcherUrl = "https://payroll.cta.org/",
            isActive = false,
        });
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);

        Assert.Equal("Old Intranet", (await Michael.GetTicketAsync(ticket.Number)).ApplicationName);
        var refused = await Michael.PostAsJsonAsync("/api/v1/tickets", NewDefect(applicationId: created.Id), Json);
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
    }

    [Theory]
    [InlineData("", "https://ok.cta.org/", SeedData.HueChi, "name")]
    [InlineData("staff expense", "https://ok.cta.org/", SeedData.HueChi, "name")] // already exists (Staff Expense)
    [InlineData("Valid Name 1", "ctaovertime.azurewebsites.net", SeedData.HueChi, "launcherUrl")]
    [InlineData("Valid Name 2", "javascript:alert(1)", SeedData.HueChi, "launcherUrl")]
    [InlineData("Valid Name 3", "https://ok.cta.org/", SeedData.ElyseOrris, "defaultAssigneeId")] // an ICA, not a developer
    public async Task Invalid_values_come_back_against_their_field(string name, string url, int developer, string field)
    {
        var response = await Michael.PostAsJsonAsync("/api/v1/applications", NewApp(name, url, developer));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ValidationProblemDetails>();
        Assert.Contains(field, problem!.Errors.Keys);
    }

    [Fact]
    public async Task Renaming_to_its_own_name_in_different_case_is_fine()
    {
        var response = await Michael.PutAsJsonAsync("/api/v1/applications/19", new
        {
            name = "Staff expense",
            description = "Staff expense reporting and reimbursement",
            defaultAssigneeId = SeedData.MaxCaber,
            launcherUrl = "https://ctastaffexpense.azurewebsites.net/",
            isActive = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_application_is_a_404()
    {
        var response = await Michael.PutAsJsonAsync("/api/v1/applications/9999", NewApp("Nobody"));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
