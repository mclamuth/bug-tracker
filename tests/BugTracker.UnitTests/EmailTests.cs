using System.Net;
using System.Text.Json;
using Azure.Core;
using BugTracker.Application.Notifications;
using BugTracker.Infrastructure.Email;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace BugTracker.UnitTests;

public sealed class EmailTemplateTests
{
    private static EmailContent Content(string? quote = "Line one\nLine two", string title = "Mileage total doubles") => new()
    {
        Heading = "You’ve been assigned a ticket",
        Lead = "Ken Fukumoto assigned you a defect.",
        Quote = quote,
        TicketNumber = "BT-1042",
        TicketTitle = title,
        Summary = [("Application", "Staff Expense"), ("Type", "Defect"), ("Severity", "High"), ("Priority", "P2 High")],
        Excerpt = "When a trip is edited the total doubles.",
        ButtonText = "View ticket",
        Link = "https://bugtracker.cta.org/tickets/1042",
    };

    [Fact]
    public void Shows_the_design_pieces()
    {
        var html = EmailTemplate.Render(Content());

        Assert.Contains("cid:cta-logo", html, StringComparison.Ordinal);
        Assert.Contains("You’ve been assigned a ticket", html, StringComparison.Ordinal);
        Assert.Contains("BT-1042", html, StringComparison.Ordinal);
        Assert.Contains("Staff Expense", html, StringComparison.Ordinal);
        Assert.Contains("P2 High", html, StringComparison.Ordinal);
        Assert.Contains("href=\"https://bugtracker.cta.org/tickets/1042\"", html, StringComparison.Ordinal);
        Assert.Contains("Line one<br>Line two", html, StringComparison.Ordinal);
        Assert.Contains("Please do not reply", html, StringComparison.Ordinal);
    }

    [Fact]
    public void Text_people_typed_is_encoded()
    {
        var html = EmailTemplate.Render(Content(quote: "<script>alert(1)</script>", title: "Total < 0 & \"wrong\""));

        Assert.DoesNotContain("<script>", html, StringComparison.Ordinal);
        Assert.Contains("&lt;script&gt;", html, StringComparison.Ordinal);
        Assert.Contains("Total &lt; 0 &amp; &quot;wrong&quot;", html, StringComparison.Ordinal);
    }

    [Fact]
    public void No_quote_box_without_a_quote()
    {
        Assert.DoesNotContain("border-left:3px solid", EmailTemplate.Render(Content(quote: null)), StringComparison.Ordinal);
    }
}

public sealed class GraphEmailSenderTests
{
    private sealed class Handler(HttpStatusCode status, string body = "") : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public string? Sent { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            Sent = await request.Content!.ReadAsStringAsync(ct);
            return new HttpResponseMessage(status) { Content = new StringContent(body) };
        }
    }

    private sealed class FakeCredential : TokenCredential
    {
        public string[] Scopes { get; private set; } = [];

        public override AccessToken GetToken(TokenRequestContext context, CancellationToken ct) => Token(context);

        public override ValueTask<AccessToken> GetTokenAsync(TokenRequestContext context, CancellationToken ct) => new(Token(context));

        private AccessToken Token(TokenRequestContext context)
        {
            Scopes = context.Scopes;
            return new AccessToken("fake-token", DateTimeOffset.UtcNow.AddHours(1));
        }
    }

    private static readonly IOptions<EmailOptions> Options = Microsoft.Extensions.Options.Options.Create(new EmailOptions());

    [Fact]
    public async Task Sends_from_the_bugtracker_mailbox_with_the_logo_inline()
    {
        var handler = new Handler(HttpStatusCode.Accepted);
        var credential = new FakeCredential();
        using var http = new HttpClient(handler);
        var sender = new GraphEmailSender(http, credential, Options);

        await sender.SendAsync(new EmailMessage("mcaber@cta.org", "[BT-1042] Assigned to you", "<p>Hi</p>"), CancellationToken.None);

        Assert.Equal(["https://graph.microsoft.com/.default"], credential.Scopes);
        Assert.Equal(HttpMethod.Post, handler.Request!.Method);
        Assert.Equal("https://graph.microsoft.com/v1.0/users/bugtracker%40cta.org/sendMail", handler.Request.RequestUri!.AbsoluteUri);
        Assert.Equal("Bearer fake-token", handler.Request.Headers.Authorization!.ToString());

        using var json = JsonDocument.Parse(handler.Sent!);
        var message = json.RootElement.GetProperty("message");
        Assert.Equal("[BT-1042] Assigned to you", message.GetProperty("subject").GetString());
        Assert.Equal("HTML", message.GetProperty("body").GetProperty("contentType").GetString());
        Assert.Equal("mcaber@cta.org", message.GetProperty("toRecipients")[0].GetProperty("emailAddress").GetProperty("address").GetString());
        var logo = message.GetProperty("attachments")[0];
        Assert.Equal("#microsoft.graph.fileAttachment", logo.GetProperty("@odata.type").GetString());
        Assert.Equal("cta-logo", logo.GetProperty("contentId").GetString());
        Assert.True(logo.GetProperty("isInline").GetBoolean());
        Assert.Equal(EmailLogo.Bytes, Convert.FromBase64String(logo.GetProperty("contentBytes").GetString()!));
        Assert.True(json.RootElement.GetProperty("saveToSentItems").GetBoolean());
    }

    [Fact]
    public async Task A_refusal_from_Graph_is_an_error_with_its_reason()
    {
        using var http = new HttpClient(new Handler(HttpStatusCode.Forbidden, """{"error":{"code":"ErrorAccessDenied"}}"""));
        var sender = new GraphEmailSender(http, new FakeCredential(), Options);

        var ex = await Assert.ThrowsAsync<HttpRequestException>(() =>
            sender.SendAsync(new EmailMessage("mcaber@cta.org", "s", "b"), CancellationToken.None));

        Assert.Equal(HttpStatusCode.Forbidden, ex.StatusCode);
        Assert.Contains("ErrorAccessDenied", ex.Message, StringComparison.Ordinal);
    }
}

public sealed class PickupEmailSenderTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "bugtracker-pickup-" + Guid.NewGuid().ToString("N"));

    private sealed class Environment(string root) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "BugTracker.Api";
        public string ContentRootPath { get; set; } = root;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    [Fact]
    public async Task Writes_an_html_file_you_can_open_with_the_logo_built_in()
    {
        var options = Options.Create(new EmailOptions { PickupPath = "emails" });
        var sender = new PickupEmailSender(options, new Environment(_root));
        var html = EmailTemplate.Render(new EmailContent
        {
            Heading = "A ticket was reopened",
            Lead = "Josh Ralls reopened a defect assigned to you.",
            TicketNumber = "BT-1042",
            TicketTitle = "Mileage",
            Summary = [],
            ButtonText = "View ticket",
            Link = "http://localhost:5173/tickets/1042",
        });

        await sender.SendAsync(new EmailMessage("mcaber@cta.org", "[BT-1042] Reopened: Mileage", html), CancellationToken.None);

        var file = Assert.Single(Directory.GetFiles(Path.Combine(_root, "emails"), "*.html"));
        Assert.Contains("mcaber-cta-org", Path.GetFileName(file), StringComparison.Ordinal);
        var written = await File.ReadAllTextAsync(file);
        Assert.Contains("data:image/png;base64,", written, StringComparison.Ordinal);
        Assert.DoesNotContain("cid:cta-logo", written, StringComparison.Ordinal);
        Assert.Contains("[BT-1042] Reopened: Mileage", written, StringComparison.Ordinal);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }
}
