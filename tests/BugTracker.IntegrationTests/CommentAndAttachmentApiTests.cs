using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BugTracker.Application.Tickets;
using BugTracker.Domain;
using BugTracker.Infrastructure.Data;
using static BugTracker.IntegrationTests.ApiTestHelpers;

namespace BugTracker.IntegrationTests;

public sealed class CommentAndAttachmentApiTests(BugTrackerApiFactory factory) : IClassFixture<BugTrackerApiFactory>
{
    [Fact]
    public async Task Mentioning_someone_emails_them_and_comments_list_newest_first()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var n = (await max.CreateTicketAsync()).Number;

        await max.PostAsJsonAsync($"/api/v1/tickets/{n}/comments", new { body = "Looking into it." }, Json);
        var response = await max.PostAsJsonAsync($"/api/v1/tickets/{n}/comments", new { body = "@Elyse Orris this is ready for you to retest." }, Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var comment = (await response.Content.ReadFromJsonAsync<CommentDto>(Json))!;
        Assert.Equal(["Elyse Orris"], comment.Mentions.Select(m => m.DisplayName));
        Assert.Contains(("eorris@cta.org", NotificationKind.Mentioned), await factory.OutboxForAsync(n));

        var comments = await max.GetFromJsonAsync<List<CommentDto>>($"/api/v1/tickets/{n}/comments", Json);
        Assert.Equal(comment.Id, comments![0].Id);
        Assert.Equal("Looking into it.", comments[1].Body);
    }

    [Fact]
    public async Task Only_the_author_can_edit_or_delete_a_comment()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var bobby = factory.CreateClientAs(SeedData.BobbyMcDonald);
        var n = (await max.CreateTicketAsync()).Number;
        var comment = (await (await max.PostAsJsonAsync($"/api/v1/tickets/{n}/comments", new { body = "First thoughts" }, Json))
            .Content.ReadFromJsonAsync<CommentDto>(Json))!;

        Assert.Equal(HttpStatusCode.Forbidden, (await bobby.PutAsJsonAsync($"/api/v1/comments/{comment.Id}", new { body = "Hijacked" }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await bobby.DeleteAsync($"/api/v1/comments/{comment.Id}")).StatusCode);

        var edited = (await (await max.PutAsJsonAsync($"/api/v1/comments/{comment.Id}", new { body = "Better thoughts" }, Json))
            .Content.ReadFromJsonAsync<CommentDto>(Json))!;
        Assert.Equal("Better thoughts", edited.Body);
        Assert.NotNull(edited.EditedAt);

        Assert.Equal(HttpStatusCode.NoContent, (await max.DeleteAsync($"/api/v1/comments/{comment.Id}")).StatusCode);
        Assert.Empty((await max.GetTicketAsync(n)).Comments);
    }

    [Fact]
    public async Task Editing_a_comment_only_emails_people_newly_mentioned()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var n = (await max.CreateTicketAsync()).Number;
        var comment = (await (await max.PostAsJsonAsync($"/api/v1/tickets/{n}/comments", new { body = "@Josh Ralls can you check?" }, Json))
            .Content.ReadFromJsonAsync<CommentDto>(Json))!;

        await max.PutAsJsonAsync($"/api/v1/comments/{comment.Id}", new { body = "@Josh Ralls and @Greg Gee can you check?" }, Json);

        var emails = await factory.OutboxForAsync(n);
        Assert.Single(emails, e => e.To == "jralls@cta.org");
        Assert.Single(emails, e => e.To == "ggee@cta.org");
    }

    [Fact]
    public async Task Empty_comments_are_rejected()
    {
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var n = (await max.CreateTicketAsync()).Number;

        var response = await max.PostAsJsonAsync($"/api/v1/tickets/{n}/comments", new { body = "   " }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Files_upload_download_and_only_the_uploader_can_remove_them()
    {
        var elyse = factory.CreateClientAs(SeedData.ElyseOrris);
        var max = factory.CreateClientAs(SeedData.MaxCaber);
        var n = (await elyse.CreateTicketAsync()).Number;
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];

        var upload = await elyse.PostAsync($"/api/v1/tickets/{n}/attachments", File("../mileage total.png", png));
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var attachment = (await upload.Content.ReadFromJsonAsync<AttachmentDto>(Json))!;
        Assert.Equal("mileage total.png", attachment.FileName); // Folders stripped from the name.
        Assert.Equal("image/png", attachment.ContentType);
        Assert.Equal(png.Length, attachment.SizeBytes);

        var download = await max.GetAsync($"/api/v1/attachments/{attachment.Id}");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal(png, await download.Content.ReadAsByteArrayAsync());
        Assert.Equal("attachment", download.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", download.Headers.GetValues("X-Content-Type-Options").Single());

        Assert.Single((await max.GetTicketAsync(n)).Attachments);

        Assert.Equal(HttpStatusCode.Forbidden, (await max.DeleteAsync($"/api/v1/attachments/{attachment.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await elyse.DeleteAsync($"/api/v1/attachments/{attachment.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await max.GetAsync($"/api/v1/attachments/{attachment.Id}")).StatusCode);

        var history = await max.GetFromJsonAsync<List<HistoryEntryDto>>($"/api/v1/tickets/{n}/history", Json);
        Assert.Contains(history!, h => h is { FieldName: "Attachment", OldValue: null, NewValue: "mileage total.png" });
        Assert.Contains(history!, h => h is { FieldName: "Attachment", OldValue: "mileage total.png", NewValue: null });
    }

    [Theory]
    [InlineData("setup.exe")]
    [InlineData("script.js")]
    [InlineData("noextension")]
    public async Task Only_allowed_file_types_can_be_attached(string fileName)
    {
        var elyse = factory.CreateClientAs(SeedData.ElyseOrris);
        var n = (await elyse.CreateTicketAsync()).Number;

        var response = await elyse.PostAsync($"/api/v1/tickets/{n}/attachments", File(fileName, [1, 2, 3]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static MultipartFormDataContent File(string name, byte[] bytes)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        return new MultipartFormDataContent { { content, "file", name } };
    }
}
