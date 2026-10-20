using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application;

/// <summary>The fields of an application, as sent when adding or editing one.</summary>
public sealed record SaveApplicationRequest(
    string? Name,
    string? Description,
    int? DefaultAssigneeId,
    string? LauncherUrl,
    bool? IsActive);

/// <summary>
/// Adds and edits the tracked applications (the Applications admin page). Applications are never deleted:
/// tickets point at them, so retiring one means switching it off, which hides it from new tickets and the launcher.
/// </summary>
public sealed class ApplicationService(IAppDbContext db, DirectoryService directory)
{
    public const int MaxNameLength = 100;
    public const int MaxDescriptionLength = 500;
    public const int MaxUrlLength = 500;

    public async Task<AppResult<ApplicationDto>> CreateAsync(SaveApplicationRequest req, CancellationToken ct)
    {
        var app = new TrackedApplication { Name = "", IsActive = true };
        var error = await ApplyAsync(app, req, ct);
        if (error is not null) return error;

        db.Applications.Add(app);
        await db.SaveChangesAsync(ct);
        return await ReadAsync(app.Id, ct);
    }

    public async Task<AppResult<ApplicationDto>> UpdateAsync(int id, SaveApplicationRequest req, CancellationToken ct)
    {
        var app = await db.Applications.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (app is null) return AppError.NotFound("Application");

        var error = await ApplyAsync(app, req, ct);
        if (error is not null) return error;

        await db.SaveChangesAsync(ct);
        return await ReadAsync(app.Id, ct);
    }

    /// <summary>Validates the request and copies it onto the application. Returns the problem, or null.</summary>
    private async Task<AppError?> ApplyAsync(TrackedApplication app, SaveApplicationRequest req, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var name = req.Name?.Trim() ?? "";
        var description = Clean(req.Description);
        var url = Clean(req.LauncherUrl);

        if (name.Length == 0) errors.Add("name", "Enter the application’s name.");
        else if (name.Length > MaxNameLength) errors.Add("name", $"Keep the name under {MaxNameLength} characters.");
        else
        {
            // Compared in memory so "staff expense" and "Staff Expense" clash on every database collation.
            var others = await db.Applications.Where(a => a.Id != app.Id).Select(a => a.Name).ToListAsync(ct);
            if (others.Contains(name, StringComparer.OrdinalIgnoreCase)) errors.Add("name", "Another application already has this name.");
        }

        if (description is { Length: > MaxDescriptionLength }) errors.Add("description", $"Keep the description under {MaxDescriptionLength} characters.");

        if (url is not null)
        {
            if (url.Length > MaxUrlLength) errors.Add("launcherUrl", $"Keep the link under {MaxUrlLength} characters.");
            else if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            {
                errors.Add("launcherUrl", "Enter a full web address starting with https://");
            }
        }

        if (req.DefaultAssigneeId is { } developerId
            && !await db.Users.AnyAsync(u => u.Id == developerId && u.IsDeveloper && u.IsActive, ct))
        {
            errors.Add("defaultAssigneeId", "Choose an active developer, or no default.");
        }

        if (errors.Any) return errors.ToError();

        app.Name = name;
        app.Description = description;
        app.LauncherUrl = url;
        app.DefaultAssigneeId = req.DefaultAssigneeId;
        app.IsActive = req.IsActive ?? app.IsActive;
        return null;
    }

    private async Task<AppResult<ApplicationDto>> ReadAsync(int id, CancellationToken ct) =>
        (await directory.GetApplicationsAsync(ct)).First(a => a.Id == id);

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
