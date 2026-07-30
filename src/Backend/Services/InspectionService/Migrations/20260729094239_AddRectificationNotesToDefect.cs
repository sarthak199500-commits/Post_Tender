using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InspectionService.Migrations
{
    /// <inheritdoc />
    public partial class AddRectificationNotesToDefect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RectificationNotes",
                table: "InspectionDefect",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RectificationNotes",
                table: "InspectionDefect");
        }
    }
}
