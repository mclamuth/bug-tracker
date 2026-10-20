using System.Text.RegularExpressions;
using BugTracker.Application.Notifications;
using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application.Tickets;

/// <summary>Creates, lists, reads and edits tickets, and moves them through the workflow.</summary>
public sealed partial class TicketService(
    IAppDbContext db,
    ICurrentUser current,
    IClock clock,
    TicketHistoryWriter history,
    CommentService comments,
    NotificationService notify,
    ITicketNumbers numbers)
{
    public const int MaxTitleLength = 200;
    public const int MaxPageSize = 100;

    // ---------- List ----------

    public async Task<AppResult<TicketPageDto>> ListAsync(TicketQuery q, CancellationToken ct)
    {
        var me = current.UserId;
        var closed = await ClosedStatusIdsAsync(ct);
        var query = db.Tickets.AsNoTracking();

        switch ((q.View ?? "open").Trim().ToLowerInvariant())
        {
            case "open": query = query.Where(t => !closed.Contains(t.StatusId)); break;
            case "unassigned": query = query.Where(t => t.AssignedToId == null && !closed.Contains(t.StatusId)); break;
            case "assigned-to-me": query = query.Where(t => t.AssignedToId == me && !closed.Contains(t.StatusId)); break;
            case "reported-by-me": query = query.Where(t => t.ReportedById == me && !closed.Contains(t.StatusId)); break;
            case "closed": query = query.Where(t => closed.Contains(t.StatusId)); break;
            case "all": break;
            default: return AppError.Invalid("view", "Use open, unassigned, assigned-to-me, reported-by-me, closed or all.");
        }

        if (q.Type is { } type) query = query.Where(t => t.Type == type);
        if (q.StatusId is { } statusId) query = query.Where(t => t.StatusId == statusId);
        if (q.ApplicationId is { } appId) query = query.Where(t => t.ApplicationId == appId);
        if (q.AssigneeId is { } assigneeId) query = query.Where(t => t.AssignedToId == assigneeId);
        if (q.ReporterId is { } reporterId) query = query.Where(t => t.ReportedById == reporterId);
        if (q.Severity is { } severity) query = query.Where(t => t.Severity == severity);
        if (q.Priority is { } priority) query = query.Where(t => t.Priority == priority);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            var number = TicketNumberPattern().Match(term);
            if (number.Success && int.TryParse(number.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture, out var n))
            {
                query = query.Where(t => t.TicketNumber == n || t.Title.Contains(term));
            }
            else
            {
                query = query.Where(t => t.Title.Contains(term) || t.Description.Contains(term));
            }
        }

        var sorted = Sort(query, q.Sort, q.Direction);
        if (sorted is null)
        {
            return AppError.Invalid("sort", "Use number, title, application, severity, priority, status, assignee, created or updated.");
        }

        var pageSize = Math.Clamp(q.PageSize ?? 25, 1, MaxPageSize);
        var page = Math.Max(q.Page ?? 1, 1);
        var total = await query.CountAsync(ct);

        var rows = await sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.TicketNumber,
                t.Type,
                t.Title,
                t.ApplicationId,
                ApplicationName = t.Application!.Name,
                t.Severity,
                t.Priority,
                t.StatusId,
                StatusName = t.Status!.Name,
                AssigneeId = (int?)t.AssignedTo!.Id,
                AssigneeName = t.AssignedTo!.DisplayName,
                ReporterId = t.ReportedBy!.Id,
                ReporterName = t.ReportedBy!.DisplayName,
                t.CreatedAt,
                t.UpdatedAt,
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new TicketListItemDto(
            r.TicketNumber,
            $"BT-{r.TicketNumber}",
            r.Type,
            r.Title,
            r.ApplicationId,
            r.ApplicationName,
            r.Severity,
            r.Priority,
            r.StatusId,
            r.StatusName,
            r.AssigneeId is { } id ? Person(id, r.AssigneeName) : null,
            Person(r.ReporterId, r.ReporterName),
            r.CreatedAt,
            r.UpdatedAt)).ToList();

        return new TicketPageDto(items, total, page, pageSize);
    }

    /// <summary>How many tickets each quick view holds, for the tabs on the ticket list.</summary>
    public async Task<TicketViewCountsDto> CountsAsync(CancellationToken ct)
    {
        var me = current.UserId;
        var closed = await ClosedStatusIdsAsync(ct);
        var all = db.Tickets.AsNoTracking();
        var open = all.Where(t => !closed.Contains(t.StatusId));

        return new TicketViewCountsDto(
            Open: await open.CountAsync(ct),
            Unassigned: await open.CountAsync(t => t.AssignedToId == null, ct),
            AssignedToMe: await open.CountAsync(t => t.AssignedToId == me, ct),
            ReportedByMe: await open.CountAsync(t => t.ReportedById == me, ct),
            Closed: await all.CountAsync(t => closed.Contains(t.StatusId), ct),
            All: await all.CountAsync(ct));
    }

    private static IQueryable<Ticket>? Sort(IQueryable<Ticket> query, string? sort, string? direction)
    {
        var key = (sort ?? "updated").Trim().ToLowerInvariant();
        var newestFirstByDefault = key is "updated" or "created" or "number";
        var descending = direction?.Trim().ToLowerInvariant() switch
        {
            "asc" => false,
            "desc" => true,
            _ => newestFirstByDefault,
        };

        IOrderedQueryable<Ticket>? ordered = key switch
        {
            "number" => descending ? query.OrderByDescending(t => t.TicketNumber) : query.OrderBy(t => t.TicketNumber),
            "title" => descending ? query.OrderByDescending(t => t.Title) : query.OrderBy(t => t.Title),
            "application" => descending ? query.OrderByDescending(t => t.Application!.Name) : query.OrderBy(t => t.Application!.Name),
            // Enhancements have no severity: always list them after defects.
            "severity" => descending
                ? query.OrderBy(t => t.Severity == null).ThenByDescending(t => t.Severity)
                : query.OrderBy(t => t.Severity == null).ThenBy(t => t.Severity),
            "priority" => descending ? query.OrderByDescending(t => t.Priority) : query.OrderBy(t => t.Priority),
            "status" => descending ? query.OrderByDescending(t => t.Status!.SortOrder) : query.OrderBy(t => t.Status!.SortOrder),
            // Unassigned tickets always last.
            "assignee" => descending
                ? query.OrderBy(t => t.AssignedToId == null).ThenByDescending(t => t.AssignedTo!.DisplayName)
                : query.OrderBy(t => t.AssignedToId == null).ThenBy(t => t.AssignedTo!.DisplayName),
            "created" => descending ? query.OrderByDescending(t => t.CreatedAt) : query.OrderBy(t => t.CreatedAt),
            "updated" => descending ? query.OrderByDescending(t => t.UpdatedAt) : query.OrderBy(t => t.UpdatedAt),
            _ => null,
        };

        return ordered?.ThenByDescending(t => t.TicketNumber);
    }

    // ---------- Read ----------

    public async Task<AppResult<TicketDetailDto>> GetAsync(int number, CancellationToken ct)
    {
        var ticket = await db.Tickets.AsNoTracking()
            .Include(t => t.Application)
            .Include(t => t.Status)
            .Include(t => t.AssignedTo)
            .Include(t => t.ReportedBy)
            .Include(t => t.DuplicateOfTicket)
            .Include(t => t.Attachments).ThenInclude(a => a.UploadedBy)
            .FirstOrDefaultAsync(t => t.TicketNumber == number, ct);
        if (ticket is null)
        {
            return AppError.NotFound($"Ticket BT-{number}");
        }

        var transitions = await db.StatusTransitions.AsNoTracking()
            .Where(t => t.FromStatusId == ticket.StatusId)
            .OrderBy(t => t.ToStatusId)
            .Select(t => new TransitionDto(t.FromStatusId, t.ToStatusId, t.RequiresComment, t.RequiresAssignee, t.RequiresResolution))
            .ToListAsync(ct);

        var ticketComments = await comments.ListForTicketAsync(ticket.Id, ct);

        return new TicketDetailDto(
            ticket.TicketNumber,
            ticket.DisplayNumber,
            ticket.Type,
            ticket.Title,
            ticket.Description,
            ticket.EndUserName,
            ticket.StepsToReproduce,
            ticket.ExpectedResult,
            ticket.ActualResult,
            ticket.Environment,
            ticket.Severity,
            ticket.Priority,
            ticket.ApplicationId,
            ticket.Application!.Name,
            ticket.StatusId,
            ticket.Status!.Name,
            ticket.Status.IsClosed,
            ticket.Resolution,
            ticket.DuplicateOfTicket?.TicketNumber,
            ticket.AssignedTo is { } a ? Person(a.Id, a.DisplayName) : null,
            Person(ticket.ReportedBy!.Id, ticket.ReportedBy.DisplayName),
            ticket.DueDate,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            ticket.ClosedAt,
            Convert.ToBase64String(ticket.RowVersion),
            transitions,
            ticketComments,
            ticket.Attachments
                .OrderByDescending(x => x.UploadedAt)
                .Select(x => AttachmentService.ToDto(x))
                .ToList());
    }

    // ---------- Create ----------

    public async Task<AppResult<TicketDetailDto>> CreateAsync(CreateTicketRequest req, CancellationToken ct)
    {
        var me = current.UserId;
        var errors = new ValidationErrors();

        if (req.Type is null) errors.Add("type", "Choose Defect or Enhancement.");
        await ValidateApplicationAsync(req.ApplicationId, errors, ct);
        ValidateText(req.Title, req.Description, req.EndUserName, errors);
        if (req.Type == TicketType.Defect && req.Severity is null) errors.Add("severity", "Choose a severity for the defect.");
        if (req.AssigneeId is { } assigneeId) await ValidateAssigneeAsync(assigneeId, errors, ct);
        if (errors.Any) return errors.ToError();

        var now = clock.UtcNow;
        var isDefect = req.Type == TicketType.Defect;
        var ticket = new Ticket
        {
            TicketNumber = await numbers.NextAsync(ct),
            Type = req.Type!.Value,
            ApplicationId = req.ApplicationId!.Value,
            Title = req.Title!.Trim(),
            Description = req.Description!.Trim(),
            EndUserName = Clean(req.EndUserName),
            // Reproduction details and severity only apply to defects.
            StepsToReproduce = isDefect ? Clean(req.StepsToReproduce) : null,
            ExpectedResult = isDefect ? Clean(req.ExpectedResult) : null,
            ActualResult = isDefect ? Clean(req.ActualResult) : null,
            Environment = isDefect ? req.Environment : null,
            Severity = isDefect ? req.Severity : null,
            Priority = req.Priority ?? Priority.P3Normal,
            // Unassigned tickets wait for triage; choosing a developer up front assigns it straight away.
            StatusId = req.AssigneeId is null ? StatusIds.New : StatusIds.Assigned,
            AssignedToId = req.AssigneeId,
            ReportedById = me,
            DueDate = req.DueDate,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Tickets.Add(ticket);
        history.Add(ticket, me, "Created", null, req.AssigneeId is null ? "New" : "Assigned");
        await notify.TicketCreatedAsync(ticket, me, ct);
        await db.SaveChangesAsync(ct); // Ticket, history and emails are saved together.

        return await GetAsync(ticket.TicketNumber, ct);
    }

    // ---------- Edit fields ----------

    public async Task<AppResult<TicketDetailDto>> UpdateAsync(int number, UpdateTicketRequest req, CancellationToken ct)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == number, ct);
        if (ticket is null) return AppError.NotFound($"Ticket BT-{number}");
        if (!RowVersionMatches(ticket, req.RowVersion)) return AppError.StaleTicket();

        var before = TicketHistoryWriter.Snapshot(ticket);
        var errors = new ValidationErrors();

        if (req.Type.HasValue) ticket.Type = req.Type.Value;
        if (req.ApplicationId.HasValue)
        {
            await ValidateApplicationAsync(req.ApplicationId.Value, errors, ct, allowInactiveId: ticket.ApplicationId);
            ticket.ApplicationId = req.ApplicationId.Value;
        }
        if (req.Title.HasValue) ticket.Title = req.Title.Value?.Trim() ?? "";
        if (req.Description.HasValue) ticket.Description = req.Description.Value?.Trim() ?? "";
        if (req.EndUserName.HasValue) ticket.EndUserName = Clean(req.EndUserName.Value);
        if (req.StepsToReproduce.HasValue) ticket.StepsToReproduce = Clean(req.StepsToReproduce.Value);
        if (req.ExpectedResult.HasValue) ticket.ExpectedResult = Clean(req.ExpectedResult.Value);
        if (req.ActualResult.HasValue) ticket.ActualResult = Clean(req.ActualResult.Value);
        if (req.Environment.HasValue) ticket.Environment = req.Environment.Value;
        if (req.Severity.HasValue) ticket.Severity = req.Severity.Value;
        if (req.Priority.HasValue) ticket.Priority = req.Priority.Value;
        if (req.DueDate.HasValue) ticket.DueDate = req.DueDate.Value;

        ValidateText(ticket.Title, ticket.Description, ticket.EndUserName, errors);
        if (ticket.Type == TicketType.Enhancement)
        {
            // Becoming an enhancement drops the defect-only details.
            ticket.Severity = null;
            ticket.Environment = null;
            ticket.StepsToReproduce = null;
            ticket.ExpectedResult = null;
            ticket.ActualResult = null;
        }
        else if (ticket.Severity is null)
        {
            errors.Add("severity", "Choose a severity for the defect.");
        }
        if (errors.Any) return errors.ToError();

        if (await history.RecordChangesAsync(ticket, before, current.UserId, ct) == 0)
        {
            return await GetAsync(number, ct); // Nothing changed: don't touch UpdatedAt.
        }

        ticket.UpdatedAt = clock.UtcNow;
        return await SaveAndReturnAsync(number, ct);
    }

    // ---------- Status changes ----------

    public async Task<AppResult<TicketDetailDto>> TransitionAsync(int number, TransitionRequest req, CancellationToken ct)
    {
        var me = current.UserId;
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == number, ct);
        if (ticket is null) return AppError.NotFound($"Ticket BT-{number}");
        if (req.RowVersion is not null && !RowVersionMatches(ticket, req.RowVersion)) return AppError.StaleTicket();

        var rule = await db.StatusTransitions.AsNoTracking()
            .FirstOrDefaultAsync(t => t.FromStatusId == ticket.StatusId && t.ToStatusId == req.ToStatusId, ct);
        if (rule is null)
        {
            var from = await StatusNameAsync(ticket.StatusId, ct);
            var to = await StatusNameAsync(req.ToStatusId, ct) ?? $"status {req.ToStatusId}";
            return AppError.Conflict($"A ticket can't move from {from} to {to}.");
        }

        var errors = new ValidationErrors();
        var comment = Clean(req.Comment);
        if (rule.RequiresComment && comment is null) errors.Add("comment", "Add a comment explaining this change.");
        if (comment is { Length: > CommentService.MaxBodyLength }) errors.Add("comment", $"Keep the comment under {CommentService.MaxBodyLength} characters.");

        int? newAssigneeId = null;
        if (rule.RequiresAssignee)
        {
            newAssigneeId = req.AssigneeId ?? ticket.AssignedToId;
            if (newAssigneeId is null) errors.Add("assigneeId", "Choose a developer to assign.");
            else await ValidateAssigneeAsync(newAssigneeId.Value, errors, ct);
        }

        Ticket? duplicateOf = null;
        if (rule.RequiresResolution)
        {
            if (req.Resolution is not (Resolution.WontFix or Resolution.Duplicate or Resolution.CannotReproduce or Resolution.ByDesign))
            {
                errors.Add("resolution", "Choose Won't Fix, Duplicate, Cannot Reproduce or By Design.");
            }
            else if (req.Resolution == Resolution.Duplicate)
            {
                duplicateOf = req.DuplicateOfNumber is { } dup
                    ? await db.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == dup, ct)
                    : null;
                if (duplicateOf is null) errors.Add("duplicateOfNumber", "Enter the number of the ticket this duplicates.");
                else if (duplicateOf.Id == ticket.Id) errors.Add("duplicateOfNumber", "A ticket can't be a duplicate of itself.");
            }
        }
        if (errors.Any) return errors.ToError();

        var before = TicketHistoryWriter.Snapshot(ticket);
        var previousAssigneeId = ticket.AssignedToId;
        var now = clock.UtcNow;
        ticket.StatusId = req.ToStatusId;

        switch (req.ToStatusId)
        {
            case StatusIds.Assigned:
                ticket.AssignedToId = newAssigneeId;
                break;
            case StatusIds.Triaged when before["Status"] is StatusIds.Assigned:
                ticket.AssignedToId = null; // Unassign: back to the backlog.
                break;
            case StatusIds.WontFix:
                ticket.Resolution = req.Resolution;
                ticket.DuplicateOfTicketId = duplicateOf?.Id;
                ticket.ClosedAt = now;
                break;
            case StatusIds.Closed:
                ticket.Resolution ??= ticket.Type == TicketType.Defect ? Resolution.Fixed : Resolution.Implemented;
                ticket.ClosedAt = now;
                break;
            case StatusIds.Reopened:
                ticket.Resolution = null;
                ticket.DuplicateOfTicketId = null;
                ticket.ClosedAt = null;
                break;
        }

        await history.RecordChangesAsync(ticket, before, me, ct);
        ticket.UpdatedAt = now;

        if (comment is not null) await comments.AddToTicketAsync(ticket, comment, ct);
        if (ticket.AssignedToId is { } assignee && assignee != previousAssigneeId) await notify.AssignedAsync(ticket, assignee, me, comment, ct);
        if (req.ToStatusId == StatusIds.ReadyForTest) await notify.ReadyForTestAsync(ticket, comment, me, ct);
        if (req.ToStatusId == StatusIds.Reopened) await notify.ReopenedAsync(ticket, comment, me, ct);

        return await SaveAndReturnAsync(number, ct);
    }

    // ---------- Assignment ----------

    /// <summary>
    /// Assign or reassign. A New or Triaged ticket becomes Assigned; a ticket already being worked
    /// (Assigned, In Progress, Ready for Test, Reopened) keeps its status and just changes hands.
    /// </summary>
    public async Task<AppResult<TicketDetailDto>> AssignAsync(int number, AssignRequest req, CancellationToken ct)
    {
        var me = current.UserId;
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == number, ct);
        if (ticket is null) return AppError.NotFound($"Ticket BT-{number}");
        if (req.RowVersion is not null && !RowVersionMatches(ticket, req.RowVersion)) return AppError.StaleTicket();

        if (ticket.StatusId is StatusIds.Verified or StatusIds.Closed or StatusIds.WontFix)
        {
            return AppError.Conflict($"A ticket that is {await StatusNameAsync(ticket.StatusId, ct)} can't be reassigned. Reopen it first.");
        }

        var errors = new ValidationErrors();
        await ValidateAssigneeAsync(req.AssigneeId, errors, ct);
        var comment = Clean(req.Comment);
        if (comment is { Length: > CommentService.MaxBodyLength }) errors.Add("comment", $"Keep the comment under {CommentService.MaxBodyLength} characters.");
        if (errors.Any) return errors.ToError();

        if (ticket.AssignedToId == req.AssigneeId && comment is null)
        {
            return await GetAsync(number, ct);
        }

        var before = TicketHistoryWriter.Snapshot(ticket);
        var changedHands = ticket.AssignedToId != req.AssigneeId;
        ticket.AssignedToId = req.AssigneeId;
        if (ticket.StatusId is StatusIds.New or StatusIds.Triaged)
        {
            ticket.StatusId = StatusIds.Assigned;
        }

        await history.RecordChangesAsync(ticket, before, me, ct);
        ticket.UpdatedAt = clock.UtcNow;
        if (comment is not null) await comments.AddToTicketAsync(ticket, comment, ct);
        if (changedHands) await notify.AssignedAsync(ticket, req.AssigneeId, me, comment, ct);

        return await SaveAndReturnAsync(number, ct);
    }

    // ---------- History ----------

    public async Task<AppResult<IReadOnlyList<HistoryEntryDto>>> HistoryAsync(int number, CancellationToken ct)
    {
        var ticketId = await db.Tickets.Where(t => t.TicketNumber == number).Select(t => (int?)t.Id).FirstOrDefaultAsync(ct);
        if (ticketId is null) return AppError.NotFound($"Ticket BT-{number}");

        var rows = await db.TicketHistory.AsNoTracking()
            .Where(h => h.TicketId == ticketId)
            .OrderByDescending(h => h.ChangedAt).ThenByDescending(h => h.Id)
            .Select(h => new { h.Id, h.ChangedById, ChangedByName = h.ChangedBy!.DisplayName, h.ChangedAt, h.FieldName, h.OldValue, h.NewValue })
            .ToListAsync(ct);

        return rows.Select(h => new HistoryEntryDto(h.Id, Person(h.ChangedById, h.ChangedByName), h.ChangedAt, h.FieldName, h.OldValue, h.NewValue)).ToList();
    }

    // ---------- Helpers ----------

    internal static PersonDto Person(int id, string name) => new(id, name, DirectoryService.Initials(name));

    private async Task<AppResult<TicketDetailDto>> SaveAndReturnAsync(int number, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppError.StaleTicket();
        }
        return await GetAsync(number, ct);
    }

    private static bool RowVersionMatches(Ticket ticket, string rowVersion)
    {
        try
        {
            return Convert.FromBase64String(rowVersion).AsSpan().SequenceEqual(ticket.RowVersion);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private async Task<List<int>> ClosedStatusIdsAsync(CancellationToken ct) =>
        await db.Statuses.Where(s => s.IsClosed).Select(s => s.Id).ToListAsync(ct);

    private async Task<string?> StatusNameAsync(int id, CancellationToken ct) =>
        await db.Statuses.Where(s => s.Id == id).Select(s => s.Name).FirstOrDefaultAsync(ct);

    private async Task ValidateApplicationAsync(int? applicationId, ValidationErrors errors, CancellationToken ct, int? allowInactiveId = null)
    {
        if (applicationId is null)
        {
            errors.Add("applicationId", "Choose an application.");
            return;
        }

        var app = await db.Applications.AsNoTracking().FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (app is null || (!app.IsActive && app.Id != allowInactiveId))
        {
            errors.Add("applicationId", "Choose an active application.");
        }
    }

    private async Task ValidateAssigneeAsync(int assigneeId, ValidationErrors errors, CancellationToken ct)
    {
        var ok = await db.Users.AnyAsync(u => u.Id == assigneeId && u.IsActive && u.IsDeveloper, ct);
        if (!ok) errors.Add("assigneeId", "Tickets can only be assigned to an active developer.");
    }

    private static void ValidateText(string? title, string? description, string? endUserName, ValidationErrors errors)
    {
        if (string.IsNullOrWhiteSpace(title)) errors.Add("title", "Enter a short title.");
        else if (title.Trim().Length > MaxTitleLength) errors.Add("title", $"Keep the title under {MaxTitleLength} characters.");
        if (string.IsNullOrWhiteSpace(description)) errors.Add("description", "Describe the issue or request.");
        if (endUserName is { Length: > 200 }) errors.Add("endUserName", "Keep this under 200 characters.");
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^(?:BT-?)?(\d{1,9})$", RegexOptions.IgnoreCase)]
    private static partial Regex TicketNumberPattern();
}
