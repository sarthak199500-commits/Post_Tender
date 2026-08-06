using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TenderService.Migrations
{
    /// <inheritdoc />
    public partial class AddUlbLocationToTenderWorkOrderProject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UlbId",
                table: "WorkOrders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WardId",
                table: "WorkOrders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ZoneId",
                table: "WorkOrders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UlbId",
                table: "Tenders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WardId",
                table: "Tenders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ZoneId",
                table: "Tenders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UlbId",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WardId",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ZoneId",
                table: "Projects",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UlbId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "WardId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "ZoneId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "UlbId",
                table: "Tenders");

            migrationBuilder.DropColumn(
                name: "WardId",
                table: "Tenders");

            migrationBuilder.DropColumn(
                name: "ZoneId",
                table: "Tenders");

            migrationBuilder.DropColumn(
                name: "UlbId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "WardId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ZoneId",
                table: "Projects");
        }
    }
}
