using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InspectionService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DefectCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DefectCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inspections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    InspectorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    InspectionDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Remarks = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    EvidenceUrl = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inspections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inspectors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    Mobile = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    CompanyName = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inspectors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InspectionDefect",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Severity = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    ReworkReportUrl = table.Column<string>(type: "TEXT", nullable: true),
                    RectifiedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    InspectionId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InspectionDefect", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InspectionDefect_Inspections_InspectionId",
                        column: x => x.InspectionId,
                        principalTable: "Inspections",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "InspectionVisits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    InspectorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ActualVisitDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Purpose = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Remarks = table.Column<string>(type: "TEXT", nullable: true),
                    AttachmentUrl = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InspectionVisits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InspectionVisits_Inspectors_InspectorId",
                        column: x => x.InspectorId,
                        principalTable: "Inspectors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InspectionDefect_InspectionId",
                table: "InspectionDefect",
                column: "InspectionId");

            migrationBuilder.CreateIndex(
                name: "IX_InspectionVisits_InspectorId",
                table: "InspectionVisits",
                column: "InspectorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DefectCategories");

            migrationBuilder.DropTable(
                name: "InspectionDefect");

            migrationBuilder.DropTable(
                name: "InspectionVisits");

            migrationBuilder.DropTable(
                name: "Inspections");

            migrationBuilder.DropTable(
                name: "Inspectors");
        }
    }
}
