using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinancialService.Migrations
{
    /// <inheritdoc />
    public partial class AddRetentionAdvanceAndDeductionsToBill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AdvanceRecovered",
                table: "Bills",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RetainedAmount",
                table: "Bills",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RetentionPercentage",
                table: "Bills",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "RetentionReleased",
                table: "Bills",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RetentionReleasedAt",
                table: "Bills",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BillDeductions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    BillId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                    IsSystemGenerated = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillDeductions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillDeductions_Bills_BillId",
                        column: x => x.BillId,
                        principalTable: "Bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingPolicies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    RetentionPercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                    AdvanceRecoveryPercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                    MaxAdvancePercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingPolicies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BillDeductions_BillId",
                table: "BillDeductions",
                column: "BillId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillDeductions");

            migrationBuilder.DropTable(
                name: "BillingPolicies");

            migrationBuilder.DropColumn(
                name: "AdvanceRecovered",
                table: "Bills");

            migrationBuilder.DropColumn(
                name: "RetainedAmount",
                table: "Bills");

            migrationBuilder.DropColumn(
                name: "RetentionPercentage",
                table: "Bills");

            migrationBuilder.DropColumn(
                name: "RetentionReleased",
                table: "Bills");

            migrationBuilder.DropColumn(
                name: "RetentionReleasedAt",
                table: "Bills");
        }
    }
}
