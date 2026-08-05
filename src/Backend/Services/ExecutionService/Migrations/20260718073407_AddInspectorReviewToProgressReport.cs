using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExecutionService.Migrations
{
    /// <inheritdoc />
    public partial class AddInspectorReviewToProgressReport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InspectorRecommendation",
                table: "ProgressReports",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InspectorRemarks",
                table: "ProgressReports",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InspectorReviewedAt",
                table: "ProgressReports",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedByInspectorId",
                table: "ProgressReports",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InspectorRecommendation",
                table: "ProgressReports");

            migrationBuilder.DropColumn(
                name: "InspectorRemarks",
                table: "ProgressReports");

            migrationBuilder.DropColumn(
                name: "InspectorReviewedAt",
                table: "ProgressReports");

            migrationBuilder.DropColumn(
                name: "ReviewedByInspectorId",
                table: "ProgressReports");
        }
    }
}
