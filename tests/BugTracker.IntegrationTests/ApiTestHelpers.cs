using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using BugTracker.Application.Tickets;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BugTracker.IntegrationTests;

/// <summary>Shared helpers: JSON settings matching the API, and quick ways to create tickets and read the outbox.</summary>
public static class ApiTestHelpers
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public static object NewDefect(int applicationId = 19, int? assigneeId = null, string title = "Mileage total doubles when a trip is edited") => new
    {
        type = "Defect",
        applicationId,
        title,
        description = "Editing a submitted trip adds the new mileage to the old amount.",
        endUserName = "Diane Cole, Membership",
        stepsToReproduce = "1. Open a report\n2. Edit the trip",
        expectedResult = "Total reflects the new distance",
        actualResult = "Old and new amounts are added",
        environment = "Production",
        severity = "High",
        priority = "P2High",
        assigneeId,
    };

    /// <summary>Like EnsureSuccessStatusCode, but the failure message includes the response body (the error details).</summary>
    public static async Task EnsureOkAsync(this HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"{(int)response.StatusCode} {response.StatusCode}: {body}", null, response.StatusCode);
        }
    }

    public static async Task<TicketDetailDto> CreateTicketAsync(this HttpClient client, object? body = null)
    {
        var response = await client.PostAsJsonAsync("/api/v1/tickets", body ?? NewDefect(), Json);
        await response.EnsureOkAsync();
        return (await response.Content.ReadFromJsonAsync<TicketDetailDto>(Json))!;
    }

    public static async Task<TicketDetailDto> GetTicketAsync(this HttpClient client, int number) =>
        (await client.GetFromJsonAsync<TicketDetailDto>($"/api/v1/tickets/{number}", Json))!;

    public static Task<HttpResponseMessage> MoveAsync(this HttpClient client, int number, int toStatusId, object? extra = null)
    {
        var body = new Dictionary<string, object?> { ["toStatusId"] = toStatusId };
        if (extra is not null)
        {
            foreach (var p in extra.GetType().GetProperties())
            {
                body[p.Name] = p.GetValue(extra);
            }
        }
        return client.PostAsJsonAsync($"/api/v1/tickets/{number}/transitions", body, Json);
    }

    public static async Task<TicketDetailDto> ReadTicketAsync(this HttpResponseMessage response)
    {
        await response.EnsureOkAsync();
        return (await response.Content.ReadFromJsonAsync<TicketDetailDto>(Json))!;
    }

    /// <summary>Emails queued for one ticket, as (recipient, kind).</summary>
    public static async Task<List<(string To, NotificationKind Kind)>> OutboxForAsync(this BugTrackerApiFactory factory, int ticketNumber)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BugTrackerDbContext>();
        var rows = await db.EmailOutbox.AsNoTracking()
            .Where(m => m.Ticket!.TicketNumber == ticketNumber)
            .OrderBy(m => m.Id)
            .Select(m => new { m.ToAddress, m.Kind })
            .ToListAsync();
        return rows.Select(r => (r.ToAddress, r.Kind)).ToList();
    }

    public static async Task<JsonElement> ProblemAsync(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Json);
}
