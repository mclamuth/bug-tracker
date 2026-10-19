using BugTracker.Api.Auth;
using BugTracker.Application;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

namespace BugTracker.Api.Endpoints;

public static class DirectoryEndpoints
{
    public static IEndpointRouteBuilder MapDirectoryEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/v1").RequireAuthorization(Policies.BugTrackerUser);

        api.MapGet("/me", async Task<Results<Ok<UserDto>, NotFound>> (ICurrentUser current, DirectoryService directory, CancellationToken ct) =>
            await directory.GetUserAsync(current.UserId, ct) is { } me ? TypedResults.Ok(me) : TypedResults.NotFound())
            .WithName("GetMe")
            .WithSummary("The signed-in user and their roles.");

        api.MapGet("/users", async (string? role, DirectoryService directory, CancellationToken ct) =>
            TypedResults.Ok(await directory.GetUsersAsync(role, ct)))
            .WithName("GetUsers")
            .WithSummary("Active team members, optionally filtered by role (developer, ica, supervisor).");

        api.MapGet("/applications", async (DirectoryService directory, CancellationToken ct) =>
            TypedResults.Ok(await directory.GetApplicationsAsync(ct)))
            .WithName("GetApplications")
            .WithSummary("All applications with their default developer, launcher URL and open ticket count.");

        api.MapGet("/lookups", async (DirectoryService directory, CancellationToken ct) =>
            TypedResults.Ok(await directory.GetLookupsAsync(ct)))
            .WithName("GetLookups")
            .WithSummary("Statuses, allowed transitions and fixed value sets.");

        // Anonymous: tells the React app which sign-in to show, so one build works in every environment.
        app.MapGet("/api/v1/auth-config", (IOptions<AuthOptions> options, IConfiguration configuration) =>
        {
            var auth = options.Value;
            return TypedResults.Ok(new AuthConfigDto(
                auth.IsDevelopmentMode ? AuthModes.Development : AuthModes.Entra,
                auth.IsDevelopmentMode ? null : configuration["AzureAd:TenantId"],
                auth.IsDevelopmentMode ? null : auth.SpaClientId,
                auth.IsDevelopmentMode ? null : auth.ApiScope));
        })
        .AllowAnonymous()
        .WithName("GetAuthConfig");

        return app;
    }

    /// <summary>Development mode only: the people you can sign in as.</summary>
    public static IEndpointRouteBuilder MapDevelopmentSignInEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/dev/sign-in-options", async (DirectoryService directory, CancellationToken ct) =>
            TypedResults.Ok(await directory.GetUsersAsync(null, ct)))
            .AllowAnonymous()
            .WithName("GetDevelopmentSignInOptions");

        return app;
    }
}

public sealed record AuthConfigDto(string Mode, string? TenantId, string? ClientId, string? ApiScope);
