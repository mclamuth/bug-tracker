using System.Globalization;
using BugTracker.Application;

namespace BugTracker.Api.Auth;

/// <summary>Reads the signed-in person's Users.Id from the bt_user_id claim.</summary>
public sealed class HttpCurrentUser(IHttpContextAccessor http) : ICurrentUser
{
    public int UserId
    {
        get
        {
            var value = http.HttpContext?.User.FindFirst(BugTrackerClaims.UserId)?.Value;
            return value is not null && int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var id)
                ? id
                : throw new InvalidOperationException("No signed-in user for this request.");
        }
    }
}
