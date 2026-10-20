namespace BugTracker.Domain;

/// <summary>A team member. Rows are created on first sign-in or seeded for the known team.</summary>
public class User
{
    public int Id { get; set; }

    /// <summary>The Entra ID object id (oid claim). Null until the person first signs in with Entra.</summary>
    public Guid? EntraObjectId { get; set; }

    public required string DisplayName { get; set; }
    public required string Email { get; set; }

    // Role flags decide the dashboard layout and pickers. They are not permissions.
    public bool IsDeveloper { get; set; }
    public bool IsIca { get; set; }
    public bool IsSupervisor { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime? LastSignInAt { get; set; }
}

/// <summary>
/// One of the internal applications ISSD supports. Named TrackedApplication (table: Applications)
/// to avoid clashing with the BugTracker.Application namespace.
/// </summary>
public class TrackedApplication
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    /// <summary>Developer who is pre-selected when a ticket is created for this application.</summary>
    public int? DefaultAssigneeId { get; set; }
    public User? DefaultAssignee { get; set; }

    /// <summary>When set, the application appears in the header's app launcher.</summary>
    public string? LauncherUrl { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>A workflow status such as New or Ready for Test.</summary>
public class Status
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public int SortOrder { get; set; }

    /// <summary>True for statuses that end the workflow (Closed, Won't Fix).</summary>
    public bool IsClosed { get; set; }
}

/// <summary>An allowed move between two statuses, with the rules the move enforces.</summary>
public class StatusTransition
{
    public int FromStatusId { get; set; }
    public Status? FromStatus { get; set; }
    public int ToStatusId { get; set; }
    public Status? ToStatus { get; set; }

    public bool RequiresComment { get; set; }
    public bool RequiresAssignee { get; set; }
    public bool RequiresResolution { get; set; }
}

/// <summary>A defect or enhancement request.</summary>
public class Ticket
{
    public int Id { get; set; }

    /// <summary>Human-friendly number from a database sequence, shown as BT-1042.</summary>
    public int TicketNumber { get; set; }

    public TicketType Type { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }

    /// <summary>Optional name and department of the end user who called the issue in.</summary>
    public string? EndUserName { get; set; }

    // Defect-only fields.
    public string? StepsToReproduce { get; set; }
    public string? ExpectedResult { get; set; }
    public string? ActualResult { get; set; }
    public TicketEnvironment? Environment { get; set; }
    public Severity? Severity { get; set; }

    public Priority Priority { get; set; } = Priority.P3Normal;

    public int ApplicationId { get; set; }
    public TrackedApplication? Application { get; set; }

    public int StatusId { get; set; } = StatusIds.New;
    public Status? Status { get; set; }

    public Resolution? Resolution { get; set; }
    public int? DuplicateOfTicketId { get; set; }
    public Ticket? DuplicateOfTicket { get; set; }

    public int ReportedById { get; set; }
    public User? ReportedBy { get; set; }

    public int? AssignedToId { get; set; }
    public User? AssignedTo { get; set; }

    public DateOnly? DueDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    /// <summary>Concurrency token so two people can't silently overwrite each other.</summary>
    public byte[] RowVersion { get; set; } = [];

    public List<Comment> Comments { get; } = [];
    public List<Attachment> Attachments { get; } = [];

    public string DisplayNumber => $"BT-{TicketNumber}";
}

/// <summary>A comment on a ticket.</summary>
public class Comment
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public int AuthorId { get; set; }
    public User? Author { get; set; }
    public required string Body { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }

    public List<CommentMention> Mentions { get; } = [];
}

/// <summary>One @mention of a person inside a comment.</summary>
public class CommentMention
{
    public int CommentId { get; set; }
    public Comment? Comment { get; set; }
    public int MentionedUserId { get; set; }
    public User? MentionedUser { get; set; }
}

/// <summary>A file attached to a ticket or to one of its comments.</summary>
public class Attachment
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public int? CommentId { get; set; }
    public Comment? Comment { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }

    /// <summary>Location of the file in blob storage (or the local folder in development).</summary>
    public required string BlobPath { get; set; }

    public int UploadedById { get; set; }
    public User? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }
}

/// <summary>One field change on a ticket, written automatically on save.</summary>
public class TicketHistory
{
    public long Id { get; set; }
    public int TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public int ChangedById { get; set; }
    public User? ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; }
    public required string FieldName { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
}

/// <summary>An email waiting to be sent, saved in the same transaction as the change that caused it.</summary>
public class EmailOutbox
{
    public long Id { get; set; }
    public int? TicketId { get; set; }
    public Ticket? Ticket { get; set; }

    /// <summary>Which email this is, so the sender can pick the right template.</summary>
    public NotificationKind Kind { get; set; }

    public required string ToAddress { get; set; }
    public required string Subject { get; set; }
    public required string HtmlBody { get; set; }
    public EmailStatus Status { get; set; } = EmailStatus.Pending;
    public int Attempts { get; set; }

    /// <summary>When to try again after a failed attempt; null means as soon as possible.</summary>
    public DateTime? NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentAt { get; set; }
}
