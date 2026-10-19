using System.Text.Json.Serialization;
using BugTracker.Api.Auth;
using BugTracker.Api.Endpoints;
using BugTracker.Application;
using BugTracker.Application.Tickets;
using BugTracker.Infrastructure;
using BugTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBugTrackerInfrastructure(builder.Configuration);
builder.Services.AddBugTrackerAuth(builder.Configuration, builder.Environment);
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Enums travel as names ("Defect", "P2High"), matching /api/v1/lookups.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.Converters.Add(new PatchJsonConverterFactory());
});
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    options.MultipartBodyLengthLimit = AttachmentService.MaxBytes + (1024 * 1024));
builder.Services.AddOpenApi(options =>
{
    // Patch<T> (edit fields that may be left out) is just T on the wire: describe it that way, inline.
    options.CreateSchemaReferenceId = type =>
        IsPatch(type.Type) ? null : Microsoft.AspNetCore.OpenApi.OpenApiOptions.CreateDefaultSchemaReferenceId(type);
    options.AddSchemaTransformer(async (schema, context, ct) =>
    {
        if (!IsPatch(context.JsonTypeInfo.Type)) return;
        var inner = await context.GetOrCreateSchemaAsync(context.JsonTypeInfo.Type.GetGenericArguments()[0], null, ct);
        schema.Type = inner.Type;
        schema.Format = inner.Format;
        schema.Enum = inner.Enum;
        schema.Properties = inner.Properties;
        schema.Required = inner.Required;
    });
});
builder.Services.AddHealthChecks().AddDbContextCheck<BugTrackerDbContext>("database");

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    // Local development only. Test and Production apply migrations from the deployment pipeline.
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>().Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    // The developer exception page (on by default here) returns the exception as Problem Details.
    app.MapOpenApi().AllowAnonymous();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseStatusCodePages();

app.UseHttpsRedirection();

// The built React app is copied to wwwroot for Test and Production.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapDirectoryEndpoints();
app.MapTicketEndpoints();

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

static bool IsPatch(Type type) => type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Patch<>);

/// <summary>Exposed so integration tests can host the API.</summary>
public partial class Program;
