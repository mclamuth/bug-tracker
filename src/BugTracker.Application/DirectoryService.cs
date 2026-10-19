using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application;

/// <summary>Reads people, applications and lookup values.</summary>
public sealed class DirectoryService(IAppDbContext db)
{
    public async Task<IReadOnlyList<UserDto>> GetUsersAsync(string? role, CancellationToken ct)
    {
        var query = db.Users.AsNoTracking().Where(u => u.IsActive);
        query = role?.ToLowerInvariant() switch
        {
            null or "" => query,
            "developer" => query.Where(u => u.IsDeveloper),
            "ica" => query.Where(u => u.IsIca),
            "supervisor" => query.Where(u => u.IsSupervisor),
            _ => query.Where(_ => false),
        };

        var users = await query.OrderBy(u => u.DisplayName).ToListAsync(ct);
        return users.Select(ToDto).ToList();
    }

    public async Task<UserDto?> GetUserAsync(int id, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        return user is null ? null : ToDto(user);
    }

    public async Task<IReadOnlyList<ApplicationDto>> GetApplicationsAsync(CancellationToken ct)
    {
        var openStatusIds = await db.Statuses.Where(s => !s.IsClosed).Select(s => s.Id).ToListAsync(ct);

        var apps = await db.Applications
            .AsNoTracking()
            .Select(a => new ApplicationDto(
                a.Id,
                a.Name,
                a.Description,
                a.DefaultAssigneeId,
                a.DefaultAssignee == null ? null : a.DefaultAssignee.DisplayName,
                a.LauncherUrl,
                a.IsActive,
                db.Tickets.Count(t => t.ApplicationId == a.Id && openStatusIds.Contains(t.StatusId))))
            .ToListAsync(ct);

        // Sort here so the order is the same on every database collation ("Cell Phone" before "CTA Search").
        return apps.OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<LookupsDto> GetLookupsAsync(CancellationToken ct)
    {
        var statuses = await db.Statuses.AsNoTracking()
            .OrderBy(s => s.SortOrder)
            .Select(s => new StatusDto(s.Id, s.Name, s.SortOrder, s.IsClosed))
            .ToListAsync(ct);

        var transitions = await db.StatusTransitions.AsNoTracking()
            .OrderBy(t => t.FromStatusId).ThenBy(t => t.ToStatusId)
            .Select(t => new TransitionDto(t.FromStatusId, t.ToStatusId, t.RequiresComment, t.RequiresAssignee, t.RequiresResolution))
            .ToListAsync(ct);

        return new LookupsDto(
            statuses,
            transitions,
            DisplayNames.TicketTypes,
            DisplayNames.Severities,
            DisplayNames.Priorities,
            DisplayNames.Environments,
            DisplayNames.Resolutions);
    }

    public static UserDto ToDto(User u) => new(
        u.Id, u.DisplayName, u.Email, Initials(u.DisplayName), u.IsDeveloper, u.IsIca, u.IsSupervisor);

    public static string Initials(string displayName)
    {
        var parts = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => "?",
            1 => parts[0][..1].ToUpperInvariant(),
            _ => string.Concat(parts[0][0], parts[^1][0]).ToUpperInvariant(),
        };
    }
}

/// <summary>Labels for the fixed value sets, shared by the API and email templates.</summary>
public static class DisplayNames
{
    public static readonly IReadOnlyList<OptionDto> TicketTypes =
    [
        new(nameof(TicketType.Defect), "Defect"),
        new(nameof(TicketType.Enhancement), "Enhancement"),
    ];

    public static readonly IReadOnlyList<OptionDto> Severities =
    [
        new(nameof(Severity.Critical), "Critical"),
        new(nameof(Severity.High), "High"),
        new(nameof(Severity.Medium), "Medium"),
        new(nameof(Severity.Low), "Low"),
    ];

    public static readonly IReadOnlyList<OptionDto> Priorities =
    [
        new(nameof(Priority.P1Urgent), "P1 Urgent"),
        new(nameof(Priority.P2High), "P2 High"),
        new(nameof(Priority.P3Normal), "P3 Normal"),
        new(nameof(Priority.P4Low), "P4 Low"),
    ];

    public static readonly IReadOnlyList<OptionDto> Environments =
    [
        new(nameof(TicketEnvironment.Production), "Production"),
        new(nameof(TicketEnvironment.Test), "Test"),
        new(nameof(TicketEnvironment.Development), "Development"),
    ];

    public static readonly IReadOnlyList<OptionDto> Resolutions =
    [
        new(nameof(Resolution.Fixed), "Fixed"),
        new(nameof(Resolution.Implemented), "Implemented"),
        new(nameof(Resolution.WontFix), "Won't Fix"),
        new(nameof(Resolution.Duplicate), "Duplicate"),
        new(nameof(Resolution.CannotReproduce), "Cannot Reproduce"),
        new(nameof(Resolution.ByDesign), "By Design"),
    ];
}
