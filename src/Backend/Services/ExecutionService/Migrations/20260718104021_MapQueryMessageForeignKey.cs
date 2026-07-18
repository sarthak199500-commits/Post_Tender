using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExecutionService.Migrations
{
    /// <inheritdoc />
    public partial class MapQueryMessageForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_QueryMessage_Queries_QueryId",
                table: "QueryMessage");

            migrationBuilder.DropPrimaryKey(
                name: "PK_QueryMessage",
                table: "QueryMessage");

            migrationBuilder.RenameTable(
                name: "QueryMessage",
                newName: "QueryMessages");

            migrationBuilder.RenameIndex(
                name: "IX_QueryMessage_QueryId",
                table: "QueryMessages",
                newName: "IX_QueryMessages_QueryId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_QueryMessages",
                table: "QueryMessages",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_QueryMessages_Queries_QueryId",
                table: "QueryMessages",
                column: "QueryId",
                principalTable: "Queries",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_QueryMessages_Queries_QueryId",
                table: "QueryMessages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_QueryMessages",
                table: "QueryMessages");

            migrationBuilder.RenameTable(
                name: "QueryMessages",
                newName: "QueryMessage");

            migrationBuilder.RenameIndex(
                name: "IX_QueryMessages_QueryId",
                table: "QueryMessage",
                newName: "IX_QueryMessage_QueryId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_QueryMessage",
                table: "QueryMessage",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_QueryMessage_Queries_QueryId",
                table: "QueryMessage",
                column: "QueryId",
                principalTable: "Queries",
                principalColumn: "Id");
        }
    }
}
