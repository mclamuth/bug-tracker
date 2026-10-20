using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Serialization;
using Azure.Core;
using BugTracker.Application.Notifications;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace BugTracker.Infrastructure.Email;

/// <summary>One email, ready to deliver. The logo travels with it as an inline image.</summary>
public sealed record EmailMessage(string To, string Subject, string HtmlBody);

/// <summary>Delivers one email. Throws if it couldn't; the outbox sender retries later.</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>The CTA logo used in emails (cid:cta-logo), embedded in this assembly.</summary>
public static class EmailLogo
{
    public const string FileName = "cta-logo.png";
    public const string ContentType = "image/png";

    private static readonly Lazy<byte[]> Png = new(() =>
    {
        using var stream = typeof(EmailLogo).Assembly.GetManifestResourceStream("BugTracker.Infrastructure.Email.cta-logo-email.png")
            ?? throw new InvalidOperationException("The email logo resource is missing.");
        using var copy = new MemoryStream();
        stream.CopyTo(copy);
        return copy.ToArray();
    });

    public static byte[] Bytes => Png.Value;
}

/// <summary>
/// Sends through Microsoft Graph as the bugtracker@cta.org mailbox (POST /users/{mailbox}/sendMail).
/// Needs the Mail.Send application permission, limited by IT to that one mailbox (docs/entra-setup-request.md).
/// </summary>
public sealed class GraphEmailSender(HttpClient http, TokenCredential credential, IOptions<EmailOptions> options) : IEmailSender
{
    private static readonly string[] Scopes = ["https://graph.microsoft.com/.default"];

    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var token = await credential.GetTokenAsync(new TokenRequestContext(Scopes), ct);
        var from = options.Value.FromMailbox;

        var body = new SendMailRequest(
            new GraphMessage(
                message.Subject,
                new GraphBody("HTML", message.HtmlBody),
                [new GraphRecipient(new GraphAddress(message.To))],
                [new GraphAttachment(EmailLogo.FileName, EmailLogo.ContentType, Convert.ToBase64String(EmailLogo.Bytes), EmailTemplate.LogoContentId, true)]),
            SaveToSentItems: true);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(from)}/sendMail")
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

        using var response = await http.SendAsync(request, ct);
        if (response.StatusCode != HttpStatusCode.Accepted && !response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException(
                $"Microsoft Graph returned {(int)response.StatusCode} {response.StatusCode}: {EmailTemplate.Shorten(detail, 500)}",
                null, response.StatusCode);
        }
    }

    // The sendMail request body: https://learn.microsoft.com/graph/api/user-sendmail
    private sealed record SendMailRequest(
        [property: JsonPropertyName("message")] GraphMessage Message,
        [property: JsonPropertyName("saveToSentItems")] bool SaveToSentItems);

    private sealed record GraphMessage(
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("body")] GraphBody Body,
        [property: JsonPropertyName("toRecipients")] GraphRecipient[] ToRecipients,
        [property: JsonPropertyName("attachments")] GraphAttachment[] Attachments);

    private sealed record GraphBody(
        [property: JsonPropertyName("contentType")] string ContentType,
        [property: JsonPropertyName("content")] string Content);

    private sealed record GraphRecipient([property: JsonPropertyName("emailAddress")] GraphAddress EmailAddress);

    private sealed record GraphAddress([property: JsonPropertyName("address")] string Address);

    private sealed record GraphAttachment(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("contentType")] string ContentType,
        [property: JsonPropertyName("contentBytes")] string ContentBytes,
        [property: JsonPropertyName("contentId")] string ContentId,
        [property: JsonPropertyName("isInline")] bool IsInline,
        [property: JsonPropertyName("@odata.type")] string ODataType = "#microsoft.graph.fileAttachment");
}

/// <summary>
/// For a developer's machine: writes each email as an HTML file (with the logo built in and the recipient and
/// subject shown at the top), so you can open it in a browser instead of sending anything.
/// </summary>
public sealed class PickupEmailSender(IOptions<EmailOptions> options, IHostEnvironment environment) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var folder = Path.GetFullPath(Path.Combine(environment.ContentRootPath, options.Value.PickupPath));
        Directory.CreateDirectory(folder);

        var logo = $"data:{EmailLogo.ContentType};base64,{Convert.ToBase64String(EmailLogo.Bytes)}";
        var envelope = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;font-size:12px;background:#f0f0f0;padding:10px 16px;border-bottom:1px solid #ddd;">
            <div><span style="color:#616161;">To:</span> {WebUtility.HtmlEncode(message.To)}</div>
            <div><span style="color:#616161;">Subject:</span> <strong>{WebUtility.HtmlEncode(message.Subject)}</strong></div>
            </div>
            """;
        var html = message.HtmlBody.Replace($"cid:{EmailTemplate.LogoContentId}", logo, StringComparison.Ordinal);
        var body = html.IndexOf("<body", StringComparison.OrdinalIgnoreCase);
        html = body < 0 ? envelope + html : html.Insert(html.IndexOf('>', body) + 1, envelope);

        var name = $"{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}-{Slug(message.To)}-{Slug(message.Subject)}.html";
        await File.WriteAllTextAsync(Path.Combine(folder, name), html, Encoding.UTF8, ct);
    }

    private static string Slug(string text)
    {
        var chars = text.ToLowerInvariant().Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray();
        var slug = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length > 40 ? slug[..40] : slug;
    }
}
