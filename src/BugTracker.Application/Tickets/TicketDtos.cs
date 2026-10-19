using BugTracker.Domain;

namespace BugTracker.Application.Tickets;

/// <summary>A person shown next to a ticket (assignee, reporter, comment author).</summary>
public sealed record PersonDto(int Id, string DisplayName, string Initials);

/// <summary>One row of the ticket list.</summary>
public sealed record TicketListItemDto(
    int Number,
    string DisplayNumber,
    TicketType Type,
    string Title,
    int ApplicationId,
    string ApplicationName,
    Severity? Severity,
    Priority Priority,
    int StatusId,
    string StatusName,
    PersonDto? Assignee,
    PersonDto Reporter,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record TicketPageDto(IReadOnlyList<TicketListItemDto> Items, int TotalCount, int Page, int PageSize);

/// <summary>The full ticket, with what the UI needs to show the next allowed status changes.</summary>
public sealed record TicketDetailDto(
    int Number,
    string DisplayNumber,
    TicketType Type,
    string Title,
    string Description,
    string? EndUserName,
    string? StepsToReproduce,
    string? ExpectedResult,
    string? ActualResult,
    TicketEnvironment? Environment,
    Severity? Severity,
    Priority Priority,
    int ApplicationId,
    string ApplicationName,
    int StatusId,
    string StatusName,
    bool IsClosed,
    Resolution? Resolution,
    int? DuplicateOfNumber,
    PersonDto? Assignee,
    PersonDto Reporter,
    DateOnly? DueDate,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? ClosedAt,
    string RowVersion,
    IReadOnlyList<TransitionDto> AllowedTransitions,
    IReadOnlyList<CommentDto> Comments,
    IReadOnlyList<AttachmentDto> Attachments);

public sealed record CommentDto(
    int Id,
    PersonDto Author,
    string Body,
    IReadOnlyList<PersonDto> Mentions,
    DateTime CreatedAt,
    DateTime? EditedAt);

public sealed record AttachmentDto(
    int Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    int? CommentId,
    PersonDto UploadedBy,
    DateTime UploadedAt);

public sealed record HistoryEntryDto(
    long Id,
    PersonDto ChangedBy,
    DateTime ChangedAt,
    string FieldName,
    string? OldValue,
    string? NewValue);

// ---------- Requests ----------

public sealed record CreateTicketRequest(
    TicketType? Type,
    int? ApplicationId,
    string? Title,
    string? Description,
    string? EndUserName,
    string? StepsToReproduce,
    string? ExpectedResult,
    string? ActualResult,
    TicketEnvironment? Environment,
    Severity? Severity,
    Priority? Priority,
    int? AssigneeId,
    DateOnly? DueDate);

/// <summary>
/// Edits to a ticket's fields. Only the properties that are sent change; status and assignee change
/// through their own endpoints. RowVersion is the value from the last read, to catch conflicting edits.
/// </summary>
public sealed record UpdateTicketRequest
{
    public required string RowVersion { get; init; }
    public Patch<TicketType> Type { get; init; }
    public Patch<int> ApplicationId { get; init; }
    public Patch<string> Title { get; init; }
    public Patch<string> Description { get; init; }
    public Patch<string?> EndUserName { get; init; }
    public Patch<string?> StepsToReproduce { get; init; }
    public Patch<string?> ExpectedResult { get; init; }
    public Patch<string?> ActualResult { get; init; }
    public Patch<TicketEnvironment?> Environment { get; init; }
    public Patch<Severity?> Severity { get; init; }
    public Patch<Priority> Priority { get; init; }
    public Patch<DateOnly?> DueDate { get; init; }
}

public sealed record TransitionRequest(
    int ToStatusId,
    string? Comment,
    Resolution? Resolution,
    int? DuplicateOfNumber,
    int? AssigneeId,
    string? RowVersion);

public sealed record AssignRequest(int AssigneeId, string? Comment, string? RowVersion);

public sealed record CommentRequest(string? Body);

/// <summary>Ticket list query string.</summary>
public sealed record TicketQuery
{
    /// <summary>open (default), unassigned, assigned-to-me, reported-by-me, closed, all.</summary>
    public string? View { get; init; }
    public TicketType? Type { get; init; }
    public int? StatusId { get; init; }
    public int? ApplicationId { get; init; }
    public int? AssigneeId { get; init; }
    public int? ReporterId { get; init; }
    public Severity? Severity { get; init; }
    public Priority? Priority { get; init; }

    /// <summary>Matches the ticket number (1042 or BT-1042), title or description.</summary>
    public string? Search { get; init; }

    /// <summary>number, title, application, severity, priority, status, assignee, created, updated (default).</summary>
    public string? Sort { get; init; }

    /// <summary>asc or desc. Defaults to desc for dates and numbers, asc otherwise.</summary>
    public string? Direction { get; init; }

    /// <summary>1-based page number (default 1).</summary>
    public int? Page { get; init; }

    /// <summary>Rows per page (default 25, at most 100).</summary>
    public int? PageSize { get; init; }
}

/// <summary>
/// A value that was either sent or left out of a JSON request, so PATCH can tell
/// "set this to null" apart from "don't change this".
/// </summary>
public readonly record struct Patch<T>(T Value)
{
    public bool HasValue { get; } = true;

    public static implicit operator Patch<T>(T value) => new(value);
}
