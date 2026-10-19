using System.Globalization;
using System.Security.Claims;
using BugTracker.Application;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Identity.Web;

namespace BugTracker.Api.Auth;

/// <summary>
/// After Entra validates the token, links the caller to their Users row (creating it on first sign-in)
/// and adds the bt_user_id claim the rest of the app relies on.
/// </summary>
public sealed class EntraUserClaimsTransformation(UserProvisioning provisioning, IHttpContextAccessor http) : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true || principal.HasClaim(c => c.Type == BugTrackerClaims.UserId))
        {
            return principal;
        }

        var objectId = principal.GetObjectId();
        if (!Guid.TryParse(objectId, out var oid))
        {
            return principal;
        }

        var email = principal.FindFirstValue("preferred_username")
            ?? principal.FindFirstValue(ClaimTypes.Email)
            ?? principal.FindFirstValue(ClaimTypes.Upn)
            ?? string.Empty;
        var name = principal.FindFirstValue("name") ?? email;

        var ct = http.HttpContext?.RequestAborted ?? CancellationToken.None;
        var user = await provisioning.ResolveAsync(oid, email, name, ct);
        if (!user.IsActive)
        {
            return principal;
        }

        var clone = principal.Clone();
        ((ClaimsIdentity)clone.Identity!).AddClaim(
            new Claim(BugTrackerClaims.UserId, user.Id.ToString(CultureInfo.InvariantCulture)));
        return clone;
    }
}
