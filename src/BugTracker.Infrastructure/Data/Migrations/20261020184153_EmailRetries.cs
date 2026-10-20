using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugTracker.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class EmailRetries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmailOutbox_Status_CreatedAt",
                table: "EmailOutbox");

            migrationBuilder.AddColumn<DateTime>(
                name: "NextAttemptAt",
                table: "EmailOutbox",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmailOutbox_Status_NextAttemptAt",
                table: "EmailOutbox",
                columns: new[] { "Status", "NextAttemptAt" });

            // Emails queued before sending existed used placeholder text: don't send them now.
            migrationBuilder.Sql(
                "UPDATE EmailOutbox SET Status = 3, LastError = 'Queued before email sending was set up; not sent.' WHERE Status = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmailOutbox_Status_NextAttemptAt",
                table: "EmailOutbox");

            migrationBuilder.DropColumn(
                name: "NextAttemptAt",
                table: "EmailOutbox");

            migrationBuilder.CreateIndex(
                name: "IX_EmailOutbox_Status_CreatedAt",
                table: "EmailOutbox",
                columns: new[] { "Status", "CreatedAt" });
        }
    }
}
