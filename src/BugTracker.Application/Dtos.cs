namespace BugTracker.Application;

/// <summary>A team member as the UI sees them.</summary>
public sealed record UserDto(
    int Id,
    string DisplayName,
    string Email,
    string Initials,
    bool IsDeveloper,
    bool IsIca,
    bool IsSupervisor);

/// <summary>An application as the UI sees it.</summary>
public sealed record ApplicationDto(
    int Id,
    string Name,
    string? Description,
    int? DefaultAssigneeId,
    string? DefaultAssigneeName,
    string? LauncherUrl,
    bool IsActive,
    int OpenTickets);

public sealed record StatusDto(int Id, string Name, int SortOrder, bool IsClosed);

public sealed record TransitionDto(
    int FromStatusId,
    int ToStatusId,
    bool RequiresComment,
    bool RequiresAssignee,
    bool RequiresResolution);

public sealed record OptionDto(string Value, string Label);

/// <summary>Everything the UI needs to fill dropdowns and enforce the workflow.</summary>
public sealed record LookupsDto(
    IReadOnlyList<StatusDto> Statuses,
    IReadOnlyList<TransitionDto> Transitions,
    IReadOnlyList<OptionDto> TicketTypes,
    IReadOnlyList<OptionDto> Severities,
    IReadOnlyList<OptionDto> Priorities,
    IReadOnlyList<OptionDto> Environments,
    IReadOnlyList<OptionDto> Resolutions);
