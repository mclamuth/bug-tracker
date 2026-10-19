using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugTracker.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class LauncherLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 17,
                column: "LauncherUrl",
                value: "https://ctaovertime.azurewebsites.net/");

            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 19,
                column: "LauncherUrl",
                value: "https://ctastaffexpense.azurewebsites.net/");

            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 21,
                column: "LauncherUrl",
                value: "https://training.cta.org/");

            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 22,
                column: "LauncherUrl",
                value: "https://vslcta.azurewebsites.net/");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 17,
                column: "LauncherUrl",
                value: null);

            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 19,
                column: "LauncherUrl",
                value: null);

            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 21,
                column: "LauncherUrl",
                value: null);

            migrationBuilder.UpdateData(
                table: "Applications",
                keyColumn: "Id",
                keyValue: 22,
                column: "LauncherUrl",
                value: null);
        }
    }
}
