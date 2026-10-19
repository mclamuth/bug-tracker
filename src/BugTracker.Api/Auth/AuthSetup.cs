using BugTracker.Application;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Identity.Web;

namespace BugTracker.Api.Auth;

public static class AuthSetup
{
    /// <summary>
    /// Configures sign-in for the chosen mode. Development mode is refused outside the Development
    /// environment so it can never reach Test or Production by accident.
    /// </summary>
    public static IServiceCollection AddBugTrackerAuth(
        this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var authOptions = configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));

        if (authOptions.IsDevelopmentMode)
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException(
                    "Auth:Mode 'Development' is only allowed when ASPNETCORE_ENVIRONMENT is Development.");
            }

            services.AddAuthentication(DevelopmentAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, DevelopmentAuthHandler>(DevelopmentAuthHandler.SchemeName, _ => { });
        }
        else
        {
            services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
                .AddMicrosoftIdentityWebApi(configuration.GetSection("AzureAd"));
            services.AddScoped<IClaimsTransformation, EntraUserClaimsTransformation>();
        }

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();

        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.BugTrackerUser, policy => policy
                .RequireAuthenticatedUser()
                .RequireClaim(BugTrackerClaims.UserId))
            .SetFallbackPolicy(new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .RequireClaim(BugTrackerClaims.UserId)
                .Build());

        return services;
    }
}
