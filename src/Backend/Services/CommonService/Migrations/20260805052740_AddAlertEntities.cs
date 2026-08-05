using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CommonService.Migrations
{
    /// <inheritdoc />
    public partial class AddAlertEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Alerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    TargetRole = table.Column<string>(type: "TEXT", nullable: true),
                    TargetUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    TargetVendorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    EntityName = table.Column<string>(type: "TEXT", nullable: true),
                    RecordId = table.Column<string>(type: "TEXT", nullable: true),
                    Link = table.Column<string>(type: "TEXT", nullable: true),
                    RaisedByUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Alerts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AlertReads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AlertId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertReads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AlertReads_Alerts_AlertId",
                        column: x => x.AlertId,
                        principalTable: "Alerts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlertReads_AlertId_UserId",
                table: "AlertReads",
                columns: new[] { "AlertId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlertReads");

            migrationBuilder.DropTable(
                name: "Alerts");
        }
    }
}
