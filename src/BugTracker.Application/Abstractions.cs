using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application;

/// <summary>The database as the application layer sees it. Implemented by Infrastructure.</summary>
public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<TrackedApplication> Applications { get; }
    DbSet<Status> Statuses { get; }
    DbSet<StatusTransition> StatusTransitions { get; }
    DbSet<Ticket> Tickets { get; }
    DbSet<Comment> Comments { get; }
    DbSet<CommentMention> CommentMentions { get; }
    DbSet<Attachment> Attachments { get; }
    DbSet<TicketHistory> TicketHistory { get; }
    DbSet<EmailOutbox> EmailOutbox { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

/// <summary>The signed-in person for the current request.</summary>
public interface ICurrentUser
{
    /// <summary>The Users.Id of the signed-in person.</summary>
    int UserId { get; }
}

/// <summary>Testable clock so code never calls DateTime.UtcNow directly.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
