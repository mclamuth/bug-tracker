using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugTracker.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class OutboxKindAndTicketLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte>(
                name: "Kind",
                table: "EmailOutbox",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.CreateIndex(
                name: "IX_EmailOutbox_TicketId",
                table: "EmailOutbox",
                column: "TicketId");

            migrationBuilder.AddForeignKey(
                name: "FK_EmailOutbox_Tickets_TicketId",
                table: "EmailOutbox",
                column: "TicketId",
                principalTable: "Tickets",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmailOutbox_Tickets_TicketId",
                table: "EmailOutbox");

            migrationBuilder.DropIndex(
                name: "IX_EmailOutbox_TicketId",
                table: "EmailOutbox");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "EmailOutbox");
        }
    }
}
