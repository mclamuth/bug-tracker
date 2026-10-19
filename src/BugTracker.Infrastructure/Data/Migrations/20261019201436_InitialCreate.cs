using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace BugTracker.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence<int>(
                name: "TicketNumbers",
                startValue: 1001L);

            migrationBuilder.CreateTable(
                name: "EmailOutbox",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketId = table.Column<int>(type: "int", nullable: true),
                    ToAddress = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    HtmlBody = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<byte>(type: "tinyint", nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailOutbox", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Statuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsClosed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Statuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EntraObjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    IsDeveloper = table.Column<bool>(type: "bit", nullable: false),
                    IsIca = table.Column<bool>(type: "bit", nullable: false),
                    IsSupervisor = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LastSignInAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StatusTransitions",
                columns: table => new
                {
                    FromStatusId = table.Column<int>(type: "int", nullable: false),
                    ToStatusId = table.Column<int>(type: "int", nullable: false),
                    RequiresComment = table.Column<bool>(type: "bit", nullable: false),
                    RequiresAssignee = table.Column<bool>(type: "bit", nullable: false),
                    RequiresResolution = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StatusTransitions", x => new { x.FromStatusId, x.ToStatusId });
                    table.ForeignKey(
                        name: "FK_StatusTransitions_Statuses_FromStatusId",
                        column: x => x.FromStatusId,
                        principalTable: "Statuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StatusTransitions_Statuses_ToStatusId",
                        column: x => x.ToStatusId,
                        principalTable: "Statuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Applications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DefaultAssigneeId = table.Column<int>(type: "int", nullable: true),
                    LauncherUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Applications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Applications_Users_DefaultAssigneeId",
                        column: x => x.DefaultAssigneeId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Tickets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketNumber = table.Column<int>(type: "int", nullable: false, defaultValueSql: "NEXT VALUE FOR [TicketNumbers]"),
                    Type = table.Column<byte>(type: "tinyint", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EndUserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StepsToReproduce = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExpectedResult = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ActualResult = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Environment = table.Column<byte>(type: "tinyint", nullable: true),
                    Severity = table.Column<byte>(type: "tinyint", nullable: true),
                    Priority = table.Column<byte>(type: "tinyint", nullable: false),
                    ApplicationId = table.Column<int>(type: "int", nullable: false),
                    StatusId = table.Column<int>(type: "int", nullable: false),
                    Resolution = table.Column<byte>(type: "tinyint", nullable: true),
                    DuplicateOfTicketId = table.Column<int>(type: "int", nullable: true),
                    ReportedById = table.Column<int>(type: "int", nullable: false),
                    AssignedToId = table.Column<int>(type: "int", nullable: true),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tickets", x => x.Id);
                    table.CheckConstraint("CK_Tickets_SeverityOnlyForDefects", "[Severity] IS NULL OR [Type] = 1");
                    table.ForeignKey(
                        name: "FK_Tickets_Applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "Applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tickets_Statuses_StatusId",
                        column: x => x.StatusId,
                        principalTable: "Statuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tickets_Tickets_DuplicateOfTicketId",
                        column: x => x.DuplicateOfTicketId,
                        principalTable: "Tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tickets_Users_AssignedToId",
                        column: x => x.AssignedToId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tickets_Users_ReportedById",
                        column: x => x.ReportedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Comments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketId = table.Column<int>(type: "int", nullable: false),
                    AuthorId = table.Column<int>(type: "int", nullable: false),
                    Body = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Comments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Comments_Tickets_TicketId",
                        column: x => x.TicketId,
                        principalTable: "Tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Comments_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TicketHistory",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketId = table.Column<int>(type: "int", nullable: false),
                    ChangedById = table.Column<int>(type: "int", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FieldName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    OldValue = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    NewValue = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TicketHistory_Tickets_TicketId",
                        column: x => x.TicketId,
                        principalTable: "Tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TicketHistory_Users_ChangedById",
                        column: x => x.ChangedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Attachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketId = table.Column<int>(type: "int", nullable: false),
                    CommentId = table.Column<int>(type: "int", nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    BlobPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UploadedById = table.Column<int>(type: "int", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Attachments_Comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "Comments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Attachments_Tickets_TicketId",
                        column: x => x.TicketId,
                        principalTable: "Tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Attachments_Users_UploadedById",
                        column: x => x.UploadedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CommentMentions",
                columns: table => new
                {
                    CommentId = table.Column<int>(type: "int", nullable: false),
                    MentionedUserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommentMentions", x => new { x.CommentId, x.MentionedUserId });
                    table.ForeignKey(
                        name: "FK_CommentMentions_Comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "Comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CommentMentions_Users_MentionedUserId",
                        column: x => x.MentionedUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Statuses",
                columns: new[] { "Id", "IsClosed", "Name", "SortOrder" },
                values: new object[,]
                {
                    { 1, false, "New", 1 },
                    { 2, false, "Triaged", 2 },
                    { 3, false, "Assigned", 3 },
                    { 4, false, "In Progress", 4 },
                    { 5, false, "Ready for Test", 5 },
                    { 6, false, "Verified", 6 },
                    { 7, true, "Closed", 7 },
                    { 8, false, "Reopened", 8 },
                    { 9, true, "Won't Fix", 9 }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "DisplayName", "Email", "EntraObjectId", "IsActive", "IsDeveloper", "IsIca", "IsSupervisor", "LastSignInAt" },
                values: new object[,]
                {
                    { 1, "Max Caber", "mcaber@cta.org", null, true, true, false, false, null },
                    { 2, "Bobby McDonald", "bmcdonald@cta.org", null, true, true, false, false, null },
                    { 3, "Hue Chi", "hchi@cta.org", null, true, true, false, false, null },
                    { 4, "Shyamal Gurazada", "sgurazada@cta.org", null, true, true, false, false, null },
                    { 5, "Michael Lamuth", "mlamuth@cta.org", null, true, true, true, false, null },
                    { 6, "Elyse Orris", "eorris@cta.org", null, true, false, true, false, null },
                    { 7, "Josh Ralls", "jralls@cta.org", null, true, false, true, false, null },
                    { 8, "Val Guzman", "vguzman@cta.org", null, true, false, true, false, null },
                    { 9, "Jeff Hugo", "jhugo@cta.org", null, true, false, true, false, null },
                    { 10, "Greg Gee", "ggee@cta.org", null, true, false, true, false, null },
                    { 11, "Ken Fukumoto", "kfukumoto@cta.org", null, true, false, false, true, null }
                });

            migrationBuilder.InsertData(
                table: "Applications",
                columns: new[] { "Id", "DefaultAssigneeId", "Description", "IsActive", "LauncherUrl", "Name" },
                values: new object[,]
                {
                    { 1, 3, "Vehicle and mileage data management", true, null, "Auto Data" },
                    { 2, 3, "Board member expense reporting", true, null, "Board Expense" },
                    { 3, 2, "Employee mobile device requests and inventory", true, null, "Cell Phone" },
                    { 4, 4, "Committee proposal and document submissions", true, null, "Committee Submissions" },
                    { 5, 1, "Conference attendance and reporting", true, null, "Conference Reports" },
                    { 6, 3, "Conference room scheduling and management", true, null, "Conference Rooms" },
                    { 7, 4, "Organization-wide content and directory search", true, null, "CTA Search" },
                    { 8, 5, "Executive Board documents and workflows", true, null, "Eboard" },
                    { 9, 2, "Governance and legal services case management", true, null, "GLS CM" },
                    { 10, 1, "Governance and legal services forms", true, null, "GLS Forms" },
                    { 11, 5, "Interim position requests and approvals", true, null, "Interim Positions" },
                    { 12, 3, "Release time requests and tracking", true, null, "Local President Release Time" },
                    { 13, 1, "New Business Item submission and tracking", true, null, "NBI" },
                    { 14, 1, "Office services reporting and dashboards", true, null, "Office Services Reports" },
                    { 15, 2, "Employee option selection and administration", true, null, "Option Management" },
                    { 16, 4, "Organizing grant applications and approvals", true, null, "Organizing Grant App" },
                    { 17, 3, "Overtime requests, approvals, and tracking", true, null, "Overtime" },
                    { 18, 5, "Reduction in force case management", true, null, "RIF" },
                    { 19, 1, "Staff expense reporting and reimbursement", true, null, "Staff Expense" },
                    { 20, 5, "Vehicle tire requests and fulfillment", true, null, "Tire Request" },
                    { 21, 4, "Staff training registration and records", true, null, "Training" },
                    { 22, 2, "Employee vacation and sick leave requests", true, null, "Vacation Sick Leave" }
                });

            migrationBuilder.InsertData(
                table: "StatusTransitions",
                columns: new[] { "FromStatusId", "ToStatusId", "RequiresAssignee", "RequiresComment", "RequiresResolution" },
                values: new object[,]
                {
                    { 1, 2, false, false, false },
                    { 1, 3, true, false, false },
                    { 1, 9, false, true, true },
                    { 2, 3, true, false, false },
                    { 2, 9, false, true, true },
                    { 3, 2, false, false, false },
                    { 3, 4, false, false, false },
                    { 4, 5, false, false, false },
                    { 4, 9, false, true, true },
                    { 5, 6, false, false, false },
                    { 5, 8, false, true, false },
                    { 6, 7, false, false, false },
                    { 7, 8, false, true, false },
                    { 8, 3, true, false, false },
                    { 8, 4, false, false, false },
                    { 9, 8, false, true, false }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_DefaultAssigneeId",
                table: "Applications",
                column: "DefaultAssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_Applications_Name",
                table: "Applications",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_CommentId",
                table: "Attachments",
                column: "CommentId");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_TicketId",
                table: "Attachments",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_UploadedById",
                table: "Attachments",
                column: "UploadedById");

            migrationBuilder.CreateIndex(
                name: "IX_CommentMentions_MentionedUserId",
                table: "CommentMentions",
                column: "MentionedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_AuthorId",
                table: "Comments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_TicketId_CreatedAt",
                table: "Comments",
                columns: new[] { "TicketId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailOutbox_Status_CreatedAt",
                table: "EmailOutbox",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StatusTransitions_ToStatusId",
                table: "StatusTransitions",
                column: "ToStatusId");

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistory_ChangedById",
                table: "TicketHistory",
                column: "ChangedById");

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistory_TicketId_ChangedAt",
                table: "TicketHistory",
                columns: new[] { "TicketId", "ChangedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_ApplicationId_StatusId",
                table: "Tickets",
                columns: new[] { "ApplicationId", "StatusId" });

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_AssignedToId",
                table: "Tickets",
                column: "AssignedToId");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_DuplicateOfTicketId",
                table: "Tickets",
                column: "DuplicateOfTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_ReportedById",
                table: "Tickets",
                column: "ReportedById");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_StatusId_AssignedToId",
                table: "Tickets",
                columns: new[] { "StatusId", "AssignedToId" });

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_TicketNumber",
                table: "Tickets",
                column: "TicketNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_UpdatedAt",
                table: "Tickets",
                column: "UpdatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_EntraObjectId",
                table: "Users",
                column: "EntraObjectId",
                unique: true,
                filter: "[EntraObjectId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Attachments");

            migrationBuilder.DropTable(
                name: "CommentMentions");

            migrationBuilder.DropTable(
                name: "EmailOutbox");

            migrationBuilder.DropTable(
                name: "StatusTransitions");

            migrationBuilder.DropTable(
                name: "TicketHistory");

            migrationBuilder.DropTable(
                name: "Comments");

            migrationBuilder.DropTable(
                name: "Tickets");

            migrationBuilder.DropTable(
                name: "Applications");

            migrationBuilder.DropTable(
                name: "Statuses");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropSequence(
                name: "TicketNumbers");
        }
    }
}
