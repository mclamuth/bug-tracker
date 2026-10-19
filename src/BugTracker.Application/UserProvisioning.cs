using BugTracker.Domain;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.Application;

/// <summary>
/// Finds the Users row for someone who has just signed in with Entra ID, creating it on first sign-in.
/// The team is seeded by email address, so the first Entra sign-in links the seeded row to the person's object id.
/// </summary>
public sealed class UserProvisioning(IAppDbContext db, IClock clock)
{
    public async Task<User> ResolveAsync(Guid objectId, string email, string displayName, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.EntraObjectId == objectId, ct);

        if (user is null && !string.IsNullOrWhiteSpace(email))
        {
            // Emails are stored lower-case, so a plain comparison works on every database.
            var normalized = email.Trim().ToLowerInvariant();
            user = await db.Users.FirstOrDefaultAsync(u => u.EntraObjectId == null && u.Email == normalized, ct);
            if (user is not null)
            {
                user.EntraObjectId = objectId;
            }
        }

        if (user is null)
        {
            user = new User
            {
                EntraObjectId = objectId,
                DisplayName = string.IsNullOrWhiteSpace(displayName) ? email : displayName.Trim(),
                Email = email.Trim().ToLowerInvariant(),
            };
            db.Users.Add(user);
        }

        // Only record a sign-in once per minute so every API call doesn't write to the database.
        var now = clock.UtcNow;
        if (user.LastSignInAt is null || now - user.LastSignInAt > TimeSpan.FromMinutes(1))
        {
            user.LastSignInAt = now;
            await db.SaveChangesAsync(ct);
        }

        return user;
    }
}
