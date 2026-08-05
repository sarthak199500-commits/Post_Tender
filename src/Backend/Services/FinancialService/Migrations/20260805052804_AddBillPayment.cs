using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinancialService.Migrations
{
    /// <inheritdoc />
    public partial class AddBillPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BillPayments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    BillId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                    VoucherNo = table.Column<string>(type: "TEXT", nullable: false),
                    Reference = table.Column<string>(type: "TEXT", nullable: true),
                    PaidByUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillPayments_Bills_BillId",
                        column: x => x.BillId,
                        principalTable: "Bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BillPayments_BillId",
                table: "BillPayments",
                column: "BillId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillPayments");
        }
    }
}
