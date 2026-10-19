using System.Globalization;
using System.Security.Claims;
using System.Text.Encodings.Web;
using BugTracker.Application;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BugTracker.Api.Auth;

/// <summary>
/// Local-only sign-in: the browser sends the chosen team member's id in the X-Dev-User-Id header.
/// Program.cs refuses to start with this handler outside the Development environment.
/// </summary>
public sealed class DevelopmentAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAppDbContext db)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "DevelopmentSignIn";
    public const string HeaderName = "X-Dev-User-Id";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var values))
        {
            return AuthenticateResult.NoResult();
        }

        if (!int.TryParse(values.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var userId))
        {
            return AuthenticateResult.Fail($"{HeaderName} must be a user id.");
        }

        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, Context.RequestAborted);
        if (user is null)
        {
            return AuthenticateResult.Fail("Unknown or inactive user.");
        }

        var identity = new ClaimsIdentity(
        [
            new Claim(BugTrackerClaims.UserId, user.Id.ToString(CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(ClaimTypes.Email, user.Email),
        ], SchemeName);

        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}
