using System.Globalization;
using System.Net;
using System.Text;

namespace BugTracker.Application.Notifications;

/// <summary>What one notification email says. Everything is plain text; the template encodes it.</summary>
public sealed record EmailContent
{
    public required string Heading { get; init; }
    public required string Lead { get; init; }

    /// <summary>A comment or reason to show quoted (the @mention, the reopen reason, the note for the tester).</summary>
    public string? Quote { get; init; }

    public required string TicketNumber { get; init; }
    public required string TicketTitle { get; init; }

    /// <summary>The summary grid on the ticket card: Application, Type, Severity, Priority, Status, Reported by.</summary>
    public required IReadOnlyList<(string Label, string Value)> Summary { get; init; }

    /// <summary>The start of the description, shown under the card.</summary>
    public string? Excerpt { get; init; }

    public required string ButtonText { get; init; }
    public required string Link { get; init; }
}

/// <summary>
/// Renders notification emails to match the Figma email designs: 600 px wide, CTA logo and "ISSD Bug Tracker"
/// at the top, a heading and lead, an optional quote, the ticket card, a button and a grey footer.
/// <para>
/// Email clients (Outlook especially) ignore most modern CSS, so this uses tables and inline styles only.
/// The logo is an inline attachment referenced as <c>cid:cta-logo</c>, so it shows without loading anything
/// from the internet.
/// </para>
/// </summary>
public static class EmailTemplate
{
    public const string LogoContentId = "cta-logo";

    private const string Font = "'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif";
    private const string Blue = "#0F6CBD";
    private const string Text = "#242424";
    private const string Muted = "#616161";
    private const string Border = "#E0E0E0";
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    public static string Render(EmailContent c)
    {
        var html = new StringBuilder();
        html.Append(Inv, $$"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="light">
            <title>{{E(c.TicketNumber)}}: {{E(c.TicketTitle)}}</title>
            </head>
            <body style="margin:0;padding:0;background:#F5F5F5;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{E(Preheader(c))}}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F5F5;">
            <tr><td align="center" style="padding:24px 12px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border:1px solid {{Border}};">
            <tr><td style="padding:34px 40px 0 40px;font-family:{{Font}};color:{{Text}};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;"><img src="cid:{{LogoContentId}}" width="190" height="37" alt="California Teachers Association" style="display:block;border:0;width:190px;height:37px;"></td>
                <td align="right" style="vertical-align:middle;font-family:{{Font}};font-size:14px;color:#424242;">ISSD <strong>Bug Tracker</strong></td>
              </tr>
              </table>
            </td></tr>
            <tr><td style="padding:28px 40px 0 40px;font-family:{{Font}};color:{{Text}};">
              <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;font-weight:600;color:{{Text}};">{{E(c.Heading)}}</h1>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#424242;">{{E(c.Lead)}}</p>
            </td></tr>
            """);

        if (!string.IsNullOrWhiteSpace(c.Quote))
        {
            html.Append(Inv, $"""
                <tr><td style="padding:18px 40px 0 40px;font-family:{Font};">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="padding:14px 16px;border-left:3px solid {Blue};background:#F3F8FC;font-size:14px;line-height:1.6;color:#424242;">“{Paragraphs(c.Quote)}”</td></tr>
                  </table>
                </td></tr>
                """);
        }

        html.Append(Inv, $"""
            <tr><td style="padding:20px 40px 0 40px;font-family:{Font};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid {Border};border-radius:6px;">
              <tr><td style="padding:18px 18px 4px 18px;font-family:{Font};">
                <div style="font-size:13px;font-weight:700;color:{Blue};">{E(c.TicketNumber)}</div>
                <div style="margin:7px 0 14px 0;font-size:17px;line-height:1.4;font-weight:600;color:{Text};">{E(c.TicketTitle)}</div>
              </td></tr>
              <tr><td style="padding:0 18px 4px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EDEDED;">
            """);

        // Three to a row, as in the design.
        for (var i = 0; i < c.Summary.Count; i += 3)
        {
            html.Append("<tr>");
            for (var j = i; j < i + 3; j++)
            {
                html.Append(Inv, $"""<td width="33%" style="padding:14px 8px 10px 0;vertical-align:top;font-family:{Font};">""");
                if (j < c.Summary.Count)
                {
                    var (label, value) = c.Summary[j];
                    html.Append(Inv, $"""<div style="font-size:12px;color:{Muted};">{E(label)}</div><div style="margin-top:3px;font-size:14px;font-weight:600;color:{Text};">{E(value)}</div>""");
                }
                html.Append("</td>");
            }
            html.Append("</tr>");
        }

        html.Append("""
                </table>
              </td></tr>
              </table>
            </td></tr>
            """);

        if (!string.IsNullOrWhiteSpace(c.Excerpt))
        {
            html.Append(Inv, $"""
                <tr><td style="padding:20px 40px 0 40px;font-family:{Font};font-size:14px;line-height:1.6;color:{Text};">{Paragraphs(c.Excerpt)}</td></tr>
                """);
        }

        html.Append(Inv, $$"""
            <tr><td style="padding:24px 40px 32px 40px;font-family:{{Font}};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-radius:5px;background:{{Blue}};">
                <a href="{{E(c.Link)}}" style="display:inline-block;padding:9px 18px;font-family:{{Font}};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:5px;">{{E(c.ButtonText)}}</a>
              </td></tr>
              </table>
              <p style="margin:14px 0 0 0;font-size:12px;line-height:1.5;color:{{Muted}};">Or open {{E(c.Link)}}</p>
            </td></tr>
            <tr><td style="padding:20px 40px;background:#F7F7F7;font-family:{{Font}};font-size:11px;line-height:1.6;color:{{Muted}};">
              This is an automated message from the ISSD Bug Tracker. Please do not reply to this email.
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            """);
        return html.ToString();
    }

    /// <summary>The line inbox previews show after the subject.</summary>
    private static string Preheader(EmailContent c) => c.Quote is { Length: > 0 } q ? Shorten(q, 120) : c.Lead;

    /// <summary>Encodes text and keeps its line breaks.</summary>
    private static string Paragraphs(string text) =>
        E(text.Trim()).Replace("\r\n", "\n", StringComparison.Ordinal).Replace("\n", "<br>", StringComparison.Ordinal);

    public static string Shorten(string text, int max)
    {
        var flat = text.Trim();
        return flat.Length <= max ? flat : flat[..(max - 1)].TrimEnd() + "…";
    }

    private static string E(string value) => WebUtility.HtmlEncode(value);
}
