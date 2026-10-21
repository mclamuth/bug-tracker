using System.Net.Http.Json;
using BugTracker.Application.Tickets;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

/// <summary>My Work for each role, against a known set of tickets.</summary>
public sealed class DashboardApiTests : IClassFixture<DashboardApiTests.SeededFactory>
{
    private readonly SeededFactory _factory;

    public DashboardApiTests(SeededFactory factory) => _factory = factory;

    /// <summary>
    /// Two new tickets waiting for triage (one critical); Max has one in progress, one ready for test and one
    /// just assigned; Hue has one reopened by Elyse.
    /// </summary>
    public sealed class SeededFactory : IAsyncLifetime
    {
        public BugTrackerApiFactory Api { get; } = new();
        public Dictionary<string, int> N { get; } = [];

        public async Task InitializeAsync()
        {
            var ken = Api.CreateClientAs(SeedData.KenFukumoto);
            var elyse = Api.CreateClientAs(SeedData.ElyseOrris);
            var max = Api.CreateClientAs(SeedData.MaxCaber);
            var hue = Api.CreateClientAs(SeedData.HueChi);

            N["triage1"] = (await ken.CreateTicketAsync(NewDefect(title: "First to triage"))).Number;
            N["triage2"] = (await elyse.CreateTicketAsync(new
            {
                type = "Defect",
                applicationId = 19,
                title = "Second to triage",
                description = "Totals are wrong for everyone.",
                severity = "Critical",
                priority = "P1Urgent",
            })).Number;

            N["progress"] = (await elyse.CreateTicketAsync(NewDefect(assigneeId: SeedData.MaxCaber, title: "Max in progress"))).Number;
            await (await max.MoveAsync(N["progress"], StatusIds.InProgress)).EnsureOkAsync();

            N["ready"] = (await elyse.CreateTicketAsync(NewDefect(assigneeId: SeedData.MaxCaber, title: "Max ready for test"))).Number;
            await (await max.MoveAsync(N["ready"], StatusIds.InProgress)).EnsureOkAsync();
            await (await max.MoveAsync(N["ready"], StatusIds.ReadyForTest)).EnsureOkAsync();

            N["reopened"] = (await elyse.CreateTicketAsync(NewDefect(applicationId: 17, assigneeId: SeedData.HueChi, title: "Hue reopened"))).Number;
            await (await hue.MoveAsync(N["reopened"], StatusIds.InProgress)).EnsureOkAsync();
            await (await hue.MoveAsync(N["reopened"], StatusIds.ReadyForTest)).EnsureOkAsync();
            await (await elyse.MoveAsync(N["reopened"], StatusIds.Reopened, new { comment = "Still rounds down." })).EnsureOkAsync();

            N["assigned"] = (await ken.CreateTicketAsync(NewDefect(assigneeId: SeedData.MaxCaber, title: "Max just assigned"))).Number;
        }

        public Task DisposeAsync()
        {
            Api.Dispose();
            return Task.CompletedTask;
        }
    }

    private async Task<DashboardDto> DashboardAsync(int asUser) =>
        (await _factory.Api.CreateClientAs(asUser).GetFromJsonAsync<DashboardDto>("/api/v1/dashboard", Json))!;

    [Fact]
    public async Task A_developer_sees_their_active_work_in_order()
    {
        var max = await DashboardAsync(SeedData.MaxCaber);

        // Ready for Test is out of Max's hands, so it isn't active work; In Progress comes before Assigned.
        Assert.Equal([_factory.N["progress"], _factory.N["assigned"]], max.MyActive.Select(t => t.Number));
        Assert.Equal(3, max.Counts.AssignedToMe);
        Assert.Equal(0, max.Counts.MyReopened);
        Assert.Equal(1, max.Counts.CriticalOpen);
        Assert.Equal(6, max.Counts.OpenedThisWeek);
    }

    [Fact]
    public async Task An_ica_sees_the_testing_queue_and_what_they_reported()
    {
        var elyse = await DashboardAsync(SeedData.ElyseOrris);

        Assert.Equal([_factory.N["ready"]], elyse.ReadyForTest.Select(t => t.Number));
        Assert.Equal(1, elyse.Counts.ReadyForTest);
        Assert.Equal(4, elyse.Counts.ReportedByMe);
        Assert.Equal(4, elyse.ReportedByMe.Count);
        Assert.Equal(1, elyse.Counts.Reopened);
    }

    [Fact]
    public async Task The_supervisor_sees_triage_oldest_first_and_the_team_workload()
    {
        var ken = await DashboardAsync(SeedData.KenFukumoto);

        Assert.Equal([_factory.N["triage1"], _factory.N["triage2"]], ken.NeedsTriage.Select(t => t.Number));
        Assert.Equal(2, ken.Counts.NeedsTriage);
        Assert.Equal(2, ken.Counts.Unassigned);
        Assert.Equal(4, ken.Counts.OpenWithDeveloper);
        Assert.Equal(3, ken.Counts.ActiveDevelopment);

        var max = ken.Workload.Single(w => w.Developer.Id == SeedData.MaxCaber);
        Assert.Equal((1, 1, 0), (max.Assigned, max.InProgress, max.Reopened));
        var hue = ken.Workload.Single(w => w.Developer.Id == SeedData.HueChi);
        Assert.Equal((0, 0, 1), (hue.Assigned, hue.InProgress, hue.Reopened));
        Assert.Equal(4, ken.Workload.Count); // every active developer, busiest first
        Assert.Equal(SeedData.MaxCaber, ken.Workload[0].Developer.Id);
    }

    [Fact]
    public async Task Recent_activity_shows_the_latest_changes_and_comments()
    {
        var dashboard = await DashboardAsync(SeedData.MaxCaber);

        Assert.InRange(dashboard.RecentActivity.Count, 1, 8);
        Assert.Equal(dashboard.RecentActivity.OrderByDescending(a => a.At).Select(a => a.At), dashboard.RecentActivity.Select(a => a.At));
        Assert.Contains(dashboard.RecentActivity, a => a.Kind == "status" && a.NewValue == "Reopened" && a.TicketNumber == _factory.N["reopened"]);
        Assert.Contains(dashboard.RecentActivity, a => a.Kind == "comment" && a.By.DisplayName == "Elyse Orris");
        Assert.Contains(dashboard.RecentActivity, a => a.Kind == "created" && a.TicketNumber == _factory.N["assigned"]);
    }
}
