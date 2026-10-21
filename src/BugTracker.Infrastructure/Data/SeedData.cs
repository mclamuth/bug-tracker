using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Infrastructure.Data;

/// <summary>
/// Reference data that every environment needs: the workflow, the ISSD team and the applications it supports.
/// Seeded through migrations so Test and Production start identical.
/// </summary>
public static class SeedData
{
    public static void Apply(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Status>().HasData(Statuses);
        modelBuilder.Entity<StatusTransition>().HasData(Transitions);
        modelBuilder.Entity<User>().HasData(Users);
        modelBuilder.Entity<TrackedApplication>().HasData(Applications);
    }

    public static readonly Status[] Statuses =
    [
        new() { Id = StatusIds.New, Name = "New", SortOrder = 1 },
        new() { Id = StatusIds.Triaged, Name = "Triaged", SortOrder = 2 },
        new() { Id = StatusIds.Assigned, Name = "Assigned", SortOrder = 3 },
        new() { Id = StatusIds.InProgress, Name = "In Progress", SortOrder = 4 },
        new() { Id = StatusIds.ReadyForTest, Name = "Ready for Test", SortOrder = 5 },
        new() { Id = StatusIds.Verified, Name = "Verified", SortOrder = 6 },
        new() { Id = StatusIds.Closed, Name = "Closed", SortOrder = 7, IsClosed = true },
        new() { Id = StatusIds.Reopened, Name = "Reopened", SortOrder = 8 },
        new() { Id = StatusIds.WontFix, Name = "Won't Fix", SortOrder = 9, IsClosed = true },
    ];

    /// <summary>The allowed moves, matching the "Ticket workflow" section of the design doc.</summary>
    public static readonly StatusTransition[] Transitions =
    [
        // New: Ken's Triage action assigns in one step; Triaged parks it in the backlog.
        Move(StatusIds.New, StatusIds.Assigned, assignee: true),
        Move(StatusIds.New, StatusIds.Triaged),
        Move(StatusIds.New, StatusIds.WontFix, comment: true, resolution: true),

        Move(StatusIds.Triaged, StatusIds.Assigned, assignee: true),
        Move(StatusIds.Triaged, StatusIds.WontFix, comment: true, resolution: true),

        Move(StatusIds.Assigned, StatusIds.InProgress),
        Move(StatusIds.Assigned, StatusIds.Triaged), // Unassign: back to the backlog.

        Move(StatusIds.InProgress, StatusIds.ReadyForTest),
        Move(StatusIds.InProgress, StatusIds.WontFix, comment: true, resolution: true),

        Move(StatusIds.ReadyForTest, StatusIds.Verified),
        Move(StatusIds.ReadyForTest, StatusIds.Reopened, comment: true),

        Move(StatusIds.Verified, StatusIds.Closed),

        Move(StatusIds.Closed, StatusIds.Reopened, comment: true),
        Move(StatusIds.WontFix, StatusIds.Reopened, comment: true),

        Move(StatusIds.Reopened, StatusIds.InProgress),
        Move(StatusIds.Reopened, StatusIds.Assigned, assignee: true), // Reassign.
    ];

    // Seeded ids for people, so applications can name their default developer.
    public const int MaxCaber = 1;
    public const int BobbyMcDonald = 2;
    public const int HueChi = 3;
    public const int ShyamalGurazada = 4;
    public const int MichaelLamuth = 5;
    public const int ElyseOrris = 6;
    public const int JoshRalls = 7;
    public const int ValGuzman = 8;
    public const int JeffHugo = 9;
    public const int GregGee = 10;
    public const int KenFukumoto = 11;

    /// <summary>
    /// The ISSD team. Emails follow the first-initial + last-name pattern and are matched on first
    /// Entra sign-in; correct any that differ before going live.
    /// </summary>
    public static readonly User[] Users =
    [
        Person(MaxCaber, "Max Caber", "mcaber@cta.org", developer: true),
        Person(BobbyMcDonald, "Bobby McDonald", "bmcdonald@cta.org", developer: true),
        Person(HueChi, "Hue Chi", "hchi@cta.org", developer: true),
        Person(ShyamalGurazada, "Shyamal Gurazada", "sgurazada@cta.org", developer: true),
        Person(MichaelLamuth, "Michael Lamuth", "mlamuth@cta.org", ica: true),
        Person(ElyseOrris, "Elyse Orris", "eorris@cta.org", ica: true),
        Person(JoshRalls, "Josh Ralls", "jralls@cta.org", ica: true),
        Person(ValGuzman, "Val Guzman", "vguzman@cta.org", ica: true),
        Person(JeffHugo, "Jeff Hugo", "jhugo@cta.org", ica: true),
        Person(GregGee, "Greg Gee", "ggee@cta.org", ica: true),
        Person(KenFukumoto, "Ken Fukumoto", "kfukumoto@cta.org", supervisor: true),
    ];

    public static readonly TrackedApplication[] Applications =
    [
        App(1, "Auto Data", "Vehicle and mileage data management", HueChi),
        App(2, "Board Expense", "Board member expense reporting", HueChi),
        App(3, "Cell Phone", "Employee mobile device requests and inventory", BobbyMcDonald),
        App(4, "Committee Submissions", "Committee proposal and document submissions", ShyamalGurazada),
        App(5, "Conference Reports", "Conference attendance and reporting", MaxCaber),
        App(6, "Conference Rooms", "Conference room scheduling and management", HueChi),
        App(7, "CTA Search", "Organization-wide content and directory search", ShyamalGurazada),
        App(8, "Eboard", "Executive Board documents and workflows", ShyamalGurazada),
        App(9, "GLS CM", "Governance and legal services case management", BobbyMcDonald),
        App(10, "GLS Forms", "Governance and legal services forms", MaxCaber),
        App(11, "Interim Positions", "Interim position requests and approvals", MaxCaber),
        App(12, "Local President Release Time", "Release time requests and tracking", HueChi),
        App(13, "NBI", "New Business Item submission and tracking", MaxCaber),
        App(14, "Office Services Reports", "Office services reporting and dashboards", MaxCaber),
        App(15, "Option Management", "Employee option selection and administration", BobbyMcDonald),
        App(16, "Organizing Grant App", "Organizing grant applications and approvals", ShyamalGurazada),
        App(17, "Overtime", "Overtime requests, approvals, and tracking", HueChi, "https://ctaovertime.azurewebsites.net/"),
        App(18, "RIF", "Reduction in force case management", BobbyMcDonald),
        App(19, "Staff Expense", "Staff expense reporting and reimbursement", MaxCaber, "https://ctastaffexpense.azurewebsites.net/"),
        App(20, "Tire Request", "Vehicle tire requests and fulfillment", HueChi),
        App(21, "Training", "Staff training registration and records", ShyamalGurazada, "https://training.cta.org/"),
        App(22, "Vacation Sick Leave", "Employee vacation and sick leave requests", BobbyMcDonald, "https://vslcta.azurewebsites.net/"),
    ];

    private static StatusTransition Move(int from, int to, bool comment = false, bool assignee = false, bool resolution = false) =>
        new() { FromStatusId = from, ToStatusId = to, RequiresComment = comment, RequiresAssignee = assignee, RequiresResolution = resolution };

    private static User Person(int id, string name, string email, bool developer = false, bool ica = false, bool supervisor = false) =>
        new() { Id = id, DisplayName = name, Email = email, IsDeveloper = developer, IsIca = ica, IsSupervisor = supervisor, IsActive = true };

    private static TrackedApplication App(int id, string name, string description, int defaultAssigneeId, string? launcherUrl = null) =>
        new() { Id = id, Name = name, Description = description, DefaultAssigneeId = defaultAssigneeId, LauncherUrl = launcherUrl, IsActive = true };
}
