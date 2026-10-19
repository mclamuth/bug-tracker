using BugTracker.Api.Auth;
using BugTracker.Application.Tickets;
using Microsoft.AspNetCore.Mvc;

namespace BugTracker.Api.Endpoints;

public static class TicketEndpoints
{
    public static IEndpointRouteBuilder MapTicketEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/v1").RequireAuthorization(Policies.BugTrackerUser);

        // ---------- Tickets ----------

        api.MapGet("/tickets", async ([AsParameters] TicketQuery query, TicketService tickets, CancellationToken ct) =>
            (await tickets.ListAsync(query, ct)).ToHttp())
            .WithName("ListTickets")
            .WithSummary("Search and filter tickets, with paging and sorting.")
            .Produces<TicketPageDto>();

        api.MapGet("/tickets/counts", async (TicketService tickets, CancellationToken ct) =>
            TypedResults.Ok(await tickets.CountsAsync(ct)))
            .WithName("CountTickets")
            .WithSummary("How many tickets each quick view holds (open, unassigned, assigned to me, reported by me, closed, all).");

        api.MapPost("/tickets", async (CreateTicketRequest request, TicketService tickets, CancellationToken ct) =>
            (await tickets.CreateAsync(request, ct)).ToHttp(t => TypedResults.Created($"/api/v1/tickets/{t.Number}", t)))
            .WithName("CreateTicket")
            .WithSummary("Create a ticket. Unassigned tickets start as New; choosing a developer starts it as Assigned.")
            .Produces<TicketDetailDto>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        api.MapGet("/tickets/{number:int}", async (int number, TicketService tickets, CancellationToken ct) =>
            (await tickets.GetAsync(number, ct)).ToHttp())
            .WithName("GetTicket")
            .WithSummary("One ticket with its comments, attachments and the status changes allowed next.")
            .Produces<TicketDetailDto>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        api.MapPatch("/tickets/{number:int}", async (int number, UpdateTicketRequest request, TicketService tickets, CancellationToken ct) =>
            (await tickets.UpdateAsync(number, request, ct)).ToHttp())
            .WithName("UpdateTicket")
            .WithSummary("Edit ticket fields. Send rowVersion from your last read; a 409 means someone else changed it.")
            .Produces<TicketDetailDto>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        api.MapPost("/tickets/{number:int}/transitions", async (int number, TransitionRequest request, TicketService tickets, CancellationToken ct) =>
            (await tickets.TransitionAsync(number, request, ct)).ToHttp())
            .WithName("ChangeTicketStatus")
            .WithSummary("Move a ticket to another status, with the comment, resolution or developer the move requires.")
            .Produces<TicketDetailDto>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        api.MapPut("/tickets/{number:int}/assignee", async (int number, AssignRequest request, TicketService tickets, CancellationToken ct) =>
            (await tickets.AssignAsync(number, request, ct)).ToHttp())
            .WithName("AssignTicket")
            .WithSummary("Assign or reassign a ticket to a developer, who is emailed.")
            .Produces<TicketDetailDto>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        api.MapGet("/tickets/{number:int}/history", async (int number, TicketService tickets, CancellationToken ct) =>
            (await tickets.HistoryAsync(number, ct)).ToHttp())
            .WithName("GetTicketHistory")
            .WithSummary("Field-by-field change log, newest first.")
            .Produces<IReadOnlyList<HistoryEntryDto>>();

        // ---------- Comments ----------

        api.MapGet("/tickets/{number:int}/comments", async (int number, CommentService comments, CancellationToken ct) =>
            (await comments.ListAsync(number, ct)).ToHttp())
            .WithName("ListComments")
            .WithSummary("Comments, newest first.")
            .Produces<IReadOnlyList<CommentDto>>();

        api.MapPost("/tickets/{number:int}/comments", async (int number, CommentRequest request, CommentService comments, CancellationToken ct) =>
            (await comments.AddAsync(number, request, ct)).ToHttp(c => TypedResults.Created($"/api/v1/comments/{c.Id}", c)))
            .WithName("AddComment")
            .WithSummary("Add a comment. Anyone @mentioned by full name is emailed.")
            .Produces<CommentDto>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        api.MapPut("/comments/{id:int}", async (int id, CommentRequest request, CommentService comments, CancellationToken ct) =>
            (await comments.UpdateAsync(id, request, ct)).ToHttp())
            .WithName("EditComment")
            .WithSummary("Edit your own comment.")
            .Produces<CommentDto>()
            .ProducesProblem(StatusCodes.Status403Forbidden);

        api.MapDelete("/comments/{id:int}", async (int id, CommentService comments, CancellationToken ct) =>
            (await comments.DeleteAsync(id, ct)).ToHttp(_ => TypedResults.NoContent()))
            .WithName("DeleteComment")
            .WithSummary("Delete your own comment.")
            .ProducesProblem(StatusCodes.Status403Forbidden);

        // ---------- Attachments ----------

        api.MapPost("/tickets/{number:int}/attachments", async (
                int number, IFormFile file, [FromForm] int? commentId, AttachmentService attachments, CancellationToken ct) =>
            {
                await using var stream = file.OpenReadStream();
                var result = await attachments.UploadAsync(number, file.FileName, file.Length, stream, commentId, ct);
                return result.ToHttp(a => TypedResults.Created($"/api/v1/attachments/{a.Id}", a));
            })
            .WithName("UploadAttachment")
            .WithSummary("Attach a file (up to 25 MB): PNG, JPG, GIF, PDF, DOCX, XLSX, TXT or CSV.")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<AttachmentDto>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            // Sign-in uses a header, not cookies, so form posts can't be forged from another site.
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(AttachmentService.MaxBytes + (1024 * 1024)));

        api.MapGet("/attachments/{id:int}", async (int id, AttachmentService attachments, HttpContext http, CancellationToken ct) =>
            {
                var result = await attachments.DownloadAsync(id, ct);
                if (!result.IsSuccess) return result.Error!.ToHttp();
                var file = result.Value!;
                http.Response.Headers.XContentTypeOptions = "nosniff";
                return TypedResults.File(file.Content, file.ContentType, file.FileName);
            })
            .WithName("DownloadAttachment")
            .WithSummary("Download a file. Always sent as a download, never shown inline.");

        api.MapDelete("/attachments/{id:int}", async (int id, AttachmentService attachments, CancellationToken ct) =>
            (await attachments.DeleteAsync(id, ct)).ToHttp(_ => TypedResults.NoContent()))
            .WithName("DeleteAttachment")
            .WithSummary("Remove a file you uploaded.")
            .ProducesProblem(StatusCodes.Status403Forbidden);

        return app;
    }
}
