using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application.Tickets;

/// <summary>Where attachment files live: a local folder in development, Azure Blob Storage in Azure.</summary>
public interface IAttachmentStorage
{
    Task SaveAsync(string path, Stream content, string contentType, CancellationToken ct);
    Task<Stream?> OpenReadAsync(string path, CancellationToken ct);
    Task DeleteAsync(string path, CancellationToken ct);
}

public sealed record AttachmentDownload(Stream Content, string FileName, string ContentType);

/// <summary>Uploads, downloads and removes files attached to tickets.</summary>
public sealed class AttachmentService(
    IAppDbContext db,
    ICurrentUser current,
    IClock clock,
    IAttachmentStorage storage,
    TicketHistoryWriter history)
{
    public const long MaxBytes = 25L * 1024 * 1024;

    /// <summary>The file types the design allows, with the content type each is served as.</summary>
    public static readonly IReadOnlyDictionary<string, string> AllowedTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".pdf"] = "application/pdf",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
    };

    public async Task<AppResult<AttachmentDto>> UploadAsync(
        int number, string fileName, long length, Stream content, int? commentId, CancellationToken ct)
    {
        var me = current.UserId;
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == number, ct);
        if (ticket is null) return AppError.NotFound($"Ticket BT-{number}");

        var safeName = SafeFileName(fileName);
        var extension = Path.GetExtension(safeName);
        if (length <= 0) return AppError.Invalid("file", "The file is empty.");
        if (length > MaxBytes) return AppError.Invalid("file", "Files can be up to 25 MB.");
        if (!AllowedTypes.TryGetValue(extension, out var contentType))
        {
            return AppError.Invalid("file", "Allowed file types: PNG, JPG, GIF, PDF, DOCX, XLSX, TXT and CSV.");
        }
        if (commentId is { } cid && !await db.Comments.AnyAsync(c => c.Id == cid && c.TicketId == ticket.Id, ct))
        {
            return AppError.Invalid("commentId", "That comment isn't on this ticket.");
        }

        // Stored under a random name: the original name is only metadata, never part of a path.
        var path = $"tickets/{ticket.TicketNumber}/{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        await storage.SaveAsync(path, content, contentType, ct);

        var now = clock.UtcNow;
        var attachment = new Attachment
        {
            Ticket = ticket,
            CommentId = commentId,
            FileName = safeName,
            ContentType = contentType,
            SizeBytes = length,
            BlobPath = path,
            UploadedById = me,
            UploadedAt = now,
        };
        db.Attachments.Add(attachment);
        history.Add(ticket, me, "Attachment", null, safeName);
        ticket.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(path, CancellationToken.None); // Don't leave an orphaned file.
            throw;
        }

        var saved = await db.Attachments.AsNoTracking().Include(a => a.UploadedBy).FirstAsync(a => a.Id == attachment.Id, ct);
        return ToDto(saved);
    }

    public async Task<AppResult<AttachmentDownload>> DownloadAsync(int attachmentId, CancellationToken ct)
    {
        var attachment = await db.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == attachmentId, ct);
        if (attachment is null) return AppError.NotFound("Attachment");

        var stream = await storage.OpenReadAsync(attachment.BlobPath, ct);
        if (stream is null) return AppError.NotFound("The attachment's file");

        return new AttachmentDownload(stream, attachment.FileName, attachment.ContentType);
    }

    /// <summary>Only the person who uploaded a file can remove it, so evidence isn't lost by accident.</summary>
    public async Task<AppResult<bool>> DeleteAsync(int attachmentId, CancellationToken ct)
    {
        var me = current.UserId;
        var attachment = await db.Attachments.Include(a => a.Ticket).FirstOrDefaultAsync(a => a.Id == attachmentId, ct);
        if (attachment is null) return AppError.NotFound("Attachment");
        if (attachment.UploadedById != me) return AppError.Forbidden("Only the person who uploaded a file can remove it.");

        db.Attachments.Remove(attachment);
        history.Add(attachment.Ticket!, me, "Attachment", attachment.FileName, null);
        attachment.Ticket!.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await storage.DeleteAsync(attachment.BlobPath, ct);
        return true;
    }

    internal static AttachmentDto ToDto(Attachment a) => new(
        a.Id,
        a.FileName,
        a.ContentType,
        a.SizeBytes,
        a.CommentId,
        TicketService.Person(a.UploadedById, a.UploadedBy?.DisplayName ?? "Unknown"),
        a.UploadedAt);

    /// <summary>Keeps only the file name (no folders) and drops characters Windows doesn't allow.</summary>
    public static string SafeFileName(string fileName)
    {
        var name = Path.GetFileName(fileName.Replace('\\', '/'));
        var invalid = Path.GetInvalidFileNameChars().Concat(['<', '>', ':', '"', '|', '?', '*']).ToHashSet();
        name = new string(name.Where(c => !invalid.Contains(c) && !char.IsControl(c)).ToArray()).Trim().TrimStart('.');
        if (name.Length == 0) name = "file";
        if (name.Length > 200)
        {
            var ext = Path.GetExtension(name);
            name = name[..(200 - ext.Length)] + ext;
        }
        return name;
    }
}
