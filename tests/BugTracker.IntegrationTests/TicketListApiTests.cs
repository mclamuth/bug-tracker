using System.Net;
using System.Net.Http.Json;
using BugTracker.Application.Tickets;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

/// <summary>Views, filters, search, sorting and paging, against a known set of tickets.</summary>
public sealed class TicketListApiTests : IClassFixture<TicketListApiTests.SeededFactory>
{
    private readonly SeededFactory _factory;

    public TicketListApiTests(SeededFactory factory) => _factory = factory;

    /// <summary>Six tickets: new, assigned to Max, in progress for Hue, Elyse's, closed, and an enhancement.</summary>
    public sealed class SeededFactory : IAsyncLifetime
    {
        public BugTrackerApiFactory Api { get; } = new();
        public Dictionary<string, int> Numbers { get; } = [];

        public async Task InitializeAsync()
        {
            var ken = Api.CreateClientAs(SeedData.KenFukumoto);
            var elyse = Api.CreateClientAs(SeedData.ElyseOrris);
            var hue = Api.CreateClientAs(SeedData.HueChi);

            Numbers["new"] = (await ken.CreateTicketAsync(NewDefect(title: "Receipt total is wrong"))).Number;
            Numbers["max"] = (await ken.CreateTicketAsync(NewDefect(assigneeId: SeedData.MaxCaber, title: "Session expires early"))).Number;
            Numbers["hue"] = (await ken.CreateTicketAsync(NewDefect(applicationId: 17, assigneeId: SeedData.HueChi, title: "Overtime rounds down"))).Number;
            await (await hue.MoveAsync(Numbers["hue"], StatusIds.InProgress)).EnsureOkAsync();
            Numbers["elyse"] = (await elyse.CreateTicketAsync(NewDefect(title: "Search misses apostrophes"))).Number;
            Numbers["closed"] = (await ken.CreateTicketAsync(NewDefect(title: "Old printer issue"))).Number;
            await (await ken.MoveAsync(Numbers["closed"], StatusIds.WontFix, new { comment = "Retired printer.", resolution = "WontFix" })).EnsureOkAsync();
            Numbers["enh"] = (await ken.CreateTicketAsync(new
            {
                type = "Enhancement",
                applicationId = 7,
                title = "Department filter",
                description = "Let people filter results by department.",
                priority = "P4Low",
            })).Number;
        }

        public Task DisposeAsync()
        {
            Api.Dispose();
            return Task.CompletedTask;
        }
    }

    private async Task<TicketPageDto> ListAsync(int asUser, string query)
    {
        var client = _factory.Api.CreateClientAs(asUser);
        return (await client.GetFromJsonAsync<TicketPageDto>($"/api/v1/tickets?{query}", Json))!;
    }

    private int[] Numbers(params string[] keys) => keys.Select(k => _factory.Numbers[k]).Order().ToArray();

    [Fact]
    public async Task Open_is_the_default_and_hides_closed_tickets()
    {
        var page = await ListAsync(SeedData.KenFukumoto, "");

        Assert.Equal(5, page.TotalCount);
        Assert.DoesNotContain(page.Items, t => t.Number == _factory.Numbers["closed"]);
    }

    [Theory]
    [InlineData("unassigned", SeedData.KenFukumoto, new[] { "new", "elyse", "enh" })]
    [InlineData("assigned-to-me", SeedData.MaxCaber, new[] { "max" })]
    [InlineData("reported-by-me", SeedData.ElyseOrris, new[] { "elyse" })]
    [InlineData("closed", SeedData.KenFukumoto, new[] { "closed" })]
    public async Task Quick_views(string view, int asUser, string[] expected)
    {
        var page = await ListAsync(asUser, $"view={view}");

        Assert.Equal(Numbers(expected), page.Items.Select(t => t.Number).Order().ToArray());
    }

    [Fact]
    public async Task All_includes_closed_tickets()
    {
        Assert.Equal(6, (await ListAsync(SeedData.KenFukumoto, "view=all")).TotalCount);
    }

    [Fact]
    public async Task Filters_combine()
    {
        var byStatus = await ListAsync(SeedData.KenFukumoto, $"statusId={StatusIds.InProgress}");
        Assert.Equal(Numbers("hue"), byStatus.Items.Select(t => t.Number).ToArray());

        var byApp = await ListAsync(SeedData.KenFukumoto, "applicationId=17");
        Assert.Equal(Numbers("hue"), byApp.Items.Select(t => t.Number).ToArray());

        var enhancements = await ListAsync(SeedData.KenFukumoto, "type=Enhancement&priority=P4Low");
        Assert.Equal(Numbers("enh"), enhancements.Items.Select(t => t.Number).ToArray());

        var byAssignee = await ListAsync(SeedData.KenFukumoto, $"assigneeId={SeedData.MaxCaber}");
        Assert.Equal("Max Caber", byAssignee.Items.Single().Assignee!.DisplayName);
    }

    [Fact]
    public async Task Search_matches_ticket_numbers_and_titles()
    {
        var n = _factory.Numbers["elyse"];

        Assert.Equal(n, (await ListAsync(SeedData.KenFukumoto, $"search=BT-{n}")).Items.Single().Number);
        Assert.Equal(n, (await ListAsync(SeedData.KenFukumoto, $"search={n}")).Items.Single().Number);
        Assert.Equal(n, (await ListAsync(SeedData.KenFukumoto, "search=apostrophes")).Items.Single().Number);
    }

    [Fact]
    public async Task Sorting_by_severity_puts_enhancements_last_and_paging_works()
    {
        var sorted = await ListAsync(SeedData.KenFukumoto, "sort=severity");
        Assert.Equal(_factory.Numbers["enh"], sorted.Items[^1].Number);

        var page2 = await ListAsync(SeedData.KenFukumoto, "sort=number&direction=asc&pageSize=2&page=2");
        Assert.Equal(5, page2.TotalCount);
        Assert.Equal(2, page2.Items.Count);
        Assert.Equal(2, page2.Page);
        Assert.True(page2.Items[0].Number < page2.Items[1].Number);
    }

    [Fact]
    public async Task Unknown_view_or_sort_is_a_validation_problem()
    {
        var client = _factory.Api.CreateClientAs(SeedData.KenFukumoto);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/v1/tickets?view=mine")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/v1/tickets?sort=colour")).StatusCode);
    }

    [Fact]
    public async Task Counts_match_each_quick_view()
    {
        var max = _factory.Api.CreateClientAs(SeedData.MaxCaber);
        var elyse = _factory.Api.CreateClientAs(SeedData.ElyseOrris);

        var forMax = (await max.GetFromJsonAsync<TicketViewCountsDto>("/api/v1/tickets/counts", Json))!;
        var forElyse = (await elyse.GetFromJsonAsync<TicketViewCountsDto>("/api/v1/tickets/counts", Json))!;

        Assert.Equal(new TicketViewCountsDto(Open: 5, Unassigned: 3, AssignedToMe: 1, ReportedByMe: 0, Closed: 1, All: 6), forMax);
        Assert.Equal(0, forElyse.AssignedToMe);
        Assert.Equal(1, forElyse.ReportedByMe);
    }
}
