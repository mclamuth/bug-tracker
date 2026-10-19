using BugTracker.Api.Auth;
using BugTracker.Api.Endpoints;
using BugTracker.Infrastructure;
using BugTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBugTrackerInfrastructure(builder.Configuration);
builder.Services.AddBugTrackerAuth(builder.Configuration, builder.Environment);
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddDbContextCheck<BugTrackerDbContext>("database");

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    // Local development only. Test and Production apply migrations from the deployment pipeline.
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();

// The built React app is copied to wwwroot for Test and Production.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapDirectoryEndpoints();

var authMode = app.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
if (authMode.IsDevelopmentMode)
{
    app.MapDevelopmentSignInEndpoints();
}

// Unknown /api routes are real 404s; everything else is a React route.
app.Map("/api/{**rest}", () => Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found"))
    .AllowAnonymous();
app.MapFallbackToFile("index.html").AllowAnonymous();

await app.RunAsync();

/// <summary>Exposed so integration tests can host the API.</summary>
public partial class Program;
