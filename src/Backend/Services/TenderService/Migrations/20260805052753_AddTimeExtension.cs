using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TenderService.Migrations
{
    /// <inheritdoc />
    public partial class AddTimeExtension : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "WorkOrders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "Tenders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TimeExtensions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    VendorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OriginalEndDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RequestedEndDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ApprovedEndDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Reason = table.Column<string>(type: "TEXT", nullable: false),
                    DocumentUrl = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    DecisionRemarks = table.Column<string>(type: "TEXT", nullable: true),
                    DecidedByUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimeExtensions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TimeExtensions_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TimeExtensions_WorkOrderId",
                table: "TimeExtensions",
                column: "WorkOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TimeExtensions");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "Tenders");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "Projects");
        }
    }
}
