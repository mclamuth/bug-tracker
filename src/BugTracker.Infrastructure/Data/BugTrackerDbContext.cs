using BugTracker.Application;
using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Infrastructure.Data;

public sealed class BugTrackerDbContext(DbContextOptions<BugTrackerDbContext> options)
    : DbContext(options), IAppDbContext
{
    public const string TicketNumberSequence = "TicketNumbers";
    public const int FirstTicketNumber = 1001;

    public DbSet<User> Users => Set<User>();
    public DbSet<TrackedApplication> Applications => Set<TrackedApplication>();
    public DbSet<Status> Statuses => Set<Status>();
    public DbSet<StatusTransition> StatusTransitions => Set<StatusTransition>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<CommentMention> CommentMentions => Set<CommentMention>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<TicketHistory> TicketHistory => Set<TicketHistory>();
    public DbSet<EmailOutbox> EmailOutbox => Set<EmailOutbox>();

    /// <summary>
    /// Every DateTime is stored in UTC. SQL Server's datetime2 doesn't keep that, so mark values read back as UTC;
    /// otherwise the API sends them without a "Z" and browsers would read them as local time.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter() : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
        v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var isSqlServer = Database.IsSqlServer();

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("Users");
            e.Property(u => u.DisplayName).HasMaxLength(200);
            e.Property(u => u.Email).HasMaxLength(320);
            e.HasIndex(u => u.EntraObjectId).IsUnique().HasFilter(isSqlServer ? "[EntraObjectId] IS NOT NULL" : null);
            e.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<TrackedApplication>(e =>
        {
            e.ToTable("Applications");
            e.Property(a => a.Name).HasMaxLength(100);
            e.Property(a => a.Description).HasMaxLength(500);
            e.Property(a => a.LauncherUrl).HasMaxLength(500);
            e.HasIndex(a => a.Name).IsUnique();
            e.HasOne(a => a.DefaultAssignee).WithMany().HasForeignKey(a => a.DefaultAssigneeId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Status>(e =>
        {
            e.ToTable("Statuses");
            e.Property(s => s.Id).ValueGeneratedNever();
            e.Property(s => s.Name).HasMaxLength(50);
        });

        modelBuilder.Entity<StatusTransition>(e =>
        {
            e.ToTable("StatusTransitions");
            e.HasKey(t => new { t.FromStatusId, t.ToStatusId });
            e.HasOne(t => t.FromStatus).WithMany().HasForeignKey(t => t.FromStatusId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(t => t.ToStatus).WithMany().HasForeignKey(t => t.ToStatusId).OnDelete(DeleteBehavior.Restrict);
        });

        if (isSqlServer)
        {
            modelBuilder.HasSequence<int>(TicketNumberSequence).StartsAt(FirstTicketNumber).IncrementsBy(1);
        }

        modelBuilder.Entity<Ticket>(e =>
        {
            e.ToTable("Tickets", t =>
            {
                // Severity and the reproduction details only make sense for defects.
                t.HasCheckConstraint("CK_Tickets_SeverityOnlyForDefects", "[Severity] IS NULL OR [Type] = 1");
            });
            e.Property(t => t.Title).HasMaxLength(200);
            e.Property(t => t.EndUserName).HasMaxLength(200);
            e.Property(t => t.Description).IsRequired();
            e.HasIndex(t => t.TicketNumber).IsUnique();
            e.HasIndex(t => new { t.StatusId, t.AssignedToId });
            e.HasIndex(t => new { t.ApplicationId, t.StatusId });
            e.HasIndex(t => t.ReportedById);
            e.HasIndex(t => t.UpdatedAt);

            if (isSqlServer)
            {
                e.Property(t => t.TicketNumber).HasDefaultValueSql($"NEXT VALUE FOR [{TicketNumberSequence}]");
                e.Property(t => t.RowVersion).IsRowVersion();
            }
            else
            {
                e.Property(t => t.RowVersion).IsConcurrencyToken();
            }

            e.HasOne(t => t.Application).WithMany().HasForeignKey(t => t.ApplicationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(t => t.Status).WithMany().HasForeignKey(t => t.StatusId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(t => t.ReportedBy).WithMany().HasForeignKey(t => t.ReportedById).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(t => t.AssignedTo).WithMany().HasForeignKey(t => t.AssignedToId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(t => t.DuplicateOfTicket).WithMany().HasForeignKey(t => t.DuplicateOfTicketId).OnDelete(DeleteBehavior.Restrict);
            e.Ignore(t => t.DisplayNumber);
        });

        modelBuilder.Entity<Comment>(e =>
        {
            e.ToTable("Comments");
            e.Property(c => c.Body).IsRequired();
            e.HasIndex(c => new { c.TicketId, c.CreatedAt });
            e.HasOne(c => c.Ticket).WithMany(t => t.Comments).HasForeignKey(c => c.TicketId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CommentMention>(e =>
        {
            e.ToTable("CommentMentions");
            e.HasKey(m => new { m.CommentId, m.MentionedUserId });
            e.HasOne(m => m.Comment).WithMany(c => c.Mentions).HasForeignKey(m => m.CommentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.MentionedUser).WithMany().HasForeignKey(m => m.MentionedUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Attachment>(e =>
        {
            e.ToTable("Attachments");
            e.Property(a => a.FileName).HasMaxLength(260);
            e.Property(a => a.ContentType).HasMaxLength(200);
            e.Property(a => a.BlobPath).HasMaxLength(500);
            e.HasOne(a => a.Ticket).WithMany(t => t.Attachments).HasForeignKey(a => a.TicketId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Comment).WithMany().HasForeignKey(a => a.CommentId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(a => a.UploadedBy).WithMany().HasForeignKey(a => a.UploadedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TicketHistory>(e =>
        {
            e.ToTable("TicketHistory");
            e.Property(h => h.FieldName).HasMaxLength(100);
            e.Property(h => h.OldValue).HasMaxLength(2000);
            e.Property(h => h.NewValue).HasMaxLength(2000);
            e.HasIndex(h => new { h.TicketId, h.ChangedAt });
            e.HasOne(h => h.Ticket).WithMany().HasForeignKey(h => h.TicketId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(h => h.ChangedBy).WithMany().HasForeignKey(h => h.ChangedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<EmailOutbox>(e =>
        {
            e.ToTable("EmailOutbox");
            e.Property(m => m.ToAddress).HasMaxLength(320);
            e.Property(m => m.Subject).HasMaxLength(300);
            e.Property(m => m.LastError).HasMaxLength(2000);
            e.HasIndex(m => new { m.Status, m.CreatedAt });
            e.HasOne(m => m.Ticket).WithMany().HasForeignKey(m => m.TicketId).OnDelete(DeleteBehavior.SetNull);
        });

        SeedData.Apply(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // SQL Server updates rowversion itself. Other databases (SQLite in tests) need a new token on
        // every change so a stale edit is still caught.
        if (!Database.IsSqlServer())
        {
            foreach (var entry in ChangeTracker.Entries<Ticket>())
            {
                if (entry.State is EntityState.Added or EntityState.Modified)
                {
                    entry.Entity.RowVersion = Guid.NewGuid().ToByteArray();
                }
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
