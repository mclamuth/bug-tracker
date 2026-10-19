using System.Net;
using System.Net.Http.Json;
using BugTracker.Api.Endpoints;
using BugTracker.Application;
using BugTracker.Infrastructure.Data;

namespace BugTracker.IntegrationTests;

public sealed class DirectoryApiTests(BugTrackerApiFactory factory) : IClassFixture<BugTrackerApiFactory>
{
    [Fact]
    public async Task Auth_config_is_anonymous_and_reports_development_mode()
    {
        var config = await factory.CreateClient().GetFromJsonAsync<AuthConfigDto>("/api/v1/auth-config");

        Assert.NotNull(config);
        Assert.Equal("Development", config.Mode);
        Assert.Null(config.ClientId);
    }

    [Fact]
    public async Task Api_requires_sign_in()
    {
        var response = await factory.CreateClient().GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_user_id_is_rejected()
    {
        var response = await factory.CreateClientAs(999).GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_returns_the_signed_in_person_with_both_roles()
    {
        var me = await factory.CreateClientAs(SeedData.MichaelLamuth).GetFromJsonAsync<UserDto>("/api/v1/me");

        Assert.NotNull(me);
        Assert.Equal("Michael Lamuth", me.DisplayName);
        Assert.Equal("ML", me.Initials);
        Assert.True(me.IsDeveloper);
        Assert.True(me.IsIca);
        Assert.False(me.IsSupervisor);
    }

    [Theory]
    [InlineData(null, 11)]
    [InlineData("developer", 5)]
    [InlineData("ica", 6)]
    [InlineData("supervisor", 1)]
    public async Task Users_can_be_filtered_by_role(string? role, int expected)
    {
        var url = role is null ? "/api/v1/users" : $"/api/v1/users?role={role}";
        var users = await factory.CreateClientAs(SeedData.KenFukumoto).GetFromJsonAsync<List<UserDto>>(url);

        Assert.NotNull(users);
        Assert.Equal(expected, users.Count);
    }

    [Fact]
    public async Task Applications_list_has_all_22_with_default_developers()
    {
        var apps = await factory.CreateClientAs(SeedData.ElyseOrris).GetFromJsonAsync<List<ApplicationDto>>("/api/v1/applications");

        Assert.NotNull(apps);
        Assert.Equal(22, apps.Count);
        Assert.Equal("Auto Data", apps[0].Name);
        Assert.True(apps.FindIndex(a => a.Name == "Cell Phone") < apps.FindIndex(a => a.Name == "CTA Search"));
        Assert.All(apps, a => Assert.False(string.IsNullOrEmpty(a.DefaultAssigneeName)));
        Assert.Equal("Max Caber", apps.Single(a => a.Name == "Staff Expense").DefaultAssigneeName);
    }

    [Fact]
    public async Task Lookups_return_the_workflow()
    {
        var lookups = await factory.CreateClientAs(SeedData.MaxCaber).GetFromJsonAsync<LookupsDto>("/api/v1/lookups");

        Assert.NotNull(lookups);
        Assert.Equal(9, lookups.Statuses.Count);
        Assert.Equal(16, lookups.Transitions.Count);
        Assert.Equal(4, lookups.Priorities.Count);
    }

    [Fact]
    public async Task Development_sign_in_options_are_anonymous()
    {
        var people = await factory.CreateClient().GetFromJsonAsync<List<UserDto>>("/api/v1/dev/sign-in-options");

        Assert.NotNull(people);
        Assert.Equal(11, people.Count);
    }

    [Fact]
    public async Task Unknown_api_route_is_a_404_not_the_react_app()
    {
        var response = await factory.CreateClientAs(SeedData.MaxCaber).GetAsync("/api/v1/nope");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Health_check_is_anonymous_and_healthy()
    {
        var response = await factory.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
