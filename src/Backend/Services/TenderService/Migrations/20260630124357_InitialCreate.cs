using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TenderService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tenders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TenderNo = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    TenderType = table.Column<string>(type: "TEXT", nullable: false),
                    Budget = table.Column<decimal>(type: "TEXT", nullable: false),
                    EMDAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                    Portal = table.Column<string>(type: "TEXT", nullable: false),
                    DocumentUrl = table.Column<string>(type: "TEXT", nullable: false),
                    PublishDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CloseDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenderTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenderTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenderAllotments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TenderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    L1VendorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    L2VendorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    L3VendorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenderAllotments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenderAllotments_Tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "Tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TenderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    VendorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    InspectorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    WorkOrderNo = table.Column<string>(type: "TEXT", nullable: false),
                    TotalValue = table.Column<decimal>(type: "TEXT", nullable: false),
                    StartDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ScopeDescription = table.Column<string>(type: "TEXT", nullable: false),
                    PaymentTerms = table.Column<string>(type: "TEXT", nullable: false),
                    LiquidatedDamagesTerms = table.Column<string>(type: "TEXT", nullable: false),
                    AgreementDocumentUrl = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrders_Tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "Tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Budget = table.Column<decimal>(type: "TEXT", nullable: false),
                    Progress = table.Column<decimal>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Latitude = table.Column<double>(type: "REAL", nullable: false),
                    Longitude = table.Column<double>(type: "REAL", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Projects_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Projects_WorkOrderId",
                table: "Projects",
                column: "WorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_TenderAllotments_TenderId",
                table: "TenderAllotments",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_TenderId",
                table: "WorkOrders",
                column: "TenderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Projects");

            migrationBuilder.DropTable(
                name: "TenderAllotments");

            migrationBuilder.DropTable(
                name: "TenderTypes");

            migrationBuilder.DropTable(
                name: "WorkOrders");

            migrationBuilder.DropTable(
                name: "Tenders");
        }
    }
}
