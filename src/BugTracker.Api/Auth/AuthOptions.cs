namespace BugTracker.Api.Auth;

/// <summary>Which sign-in the app uses. Bound from the "Auth" configuration section.</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>"Development" (pick a team member, local only) or "Entra" (Microsoft sign-in).</summary>
    public string Mode { get; set; } = AuthModes.Entra;

    /// <summary>Client (application) id of the SPA registration. Entra mode only.</summary>
    public string? SpaClientId { get; set; }

    /// <summary>Full scope the SPA requests for the API, e.g. api://&lt;api-client-id&gt;/access_as_user.</summary>
    public string? ApiScope { get; set; }

    public bool IsDevelopmentMode => string.Equals(Mode, AuthModes.Development, StringComparison.OrdinalIgnoreCase);
}

public static class AuthModes
{
    public const string Development = "Development";
    public const string Entra = "Entra";
}

public static class BugTrackerClaims
{
    /// <summary>Claim holding the signed-in person's Users.Id.</summary>
    public const string UserId = "bt_user_id";
}

public static class Policies
{
    /// <summary>Every endpoint requires this: signed in and linked to a Users row.</summary>
    public const string BugTrackerUser = "BugTrackerUser";
}
