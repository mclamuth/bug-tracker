namespace BugTracker.Infrastructure.Email;

/// <summary>How notification emails are delivered. Bound from the "Email" configuration section.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    /// <summary>
    /// None: queue only (tests, or until sending is set up). Pickup: write each email as an HTML file you can
    /// open in a browser (a developer's machine). Graph: send through Microsoft 365 (Test and Production).
    /// </summary>
    public string Mode { get; set; } = EmailModes.None;

    /// <summary>The mailbox emails come from.</summary>
    public string FromMailbox { get; set; } = "bugtracker@cta.org";

    /// <summary>Pickup mode: the folder for the HTML files, relative to the API project.</summary>
    public string PickupPath { get; set; } = "../../.local/emails";

    /// <summary>
    /// When set, every email goes to this address instead, with the real recipient in the subject.
    /// For the Test environment, so testing never emails people who didn't ask for it.
    /// </summary>
    public string? RedirectAllTo { get; set; }

    /// <summary>How often the sender checks for queued emails.</summary>
    public int PollSeconds { get; set; } = 15;

    /// <summary>Tries before an email is marked as failed.</summary>
    public int MaxAttempts { get; set; } = 6;

    /// <summary>Emails still unsent after this long are dropped rather than sent late (after an outage, say).</summary>
    public int MaxAgeHours { get; set; } = 48;

    public GraphEmailOptions Graph { get; set; } = new();
}

/// <summary>
/// Microsoft Graph sign-in. In Azure, leave these empty: the App Service's managed identity is used (its client
/// id is in the AZURE_CLIENT_ID setting). A tenant, client id and secret are only for sending from somewhere
/// without a managed identity, such as trying Graph from a developer's machine; keep the secret in user secrets.
/// </summary>
public sealed class GraphEmailOptions
{
    public string? TenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
}

public static class EmailModes
{
    public const string None = "None";
    public const string Pickup = "Pickup";
    public const string Graph = "Graph";
}
