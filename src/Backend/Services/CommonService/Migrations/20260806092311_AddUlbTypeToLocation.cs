using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CommonService.Migrations
{
    /// <inheritdoc />
    public partial class AddUlbTypeToLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UlbType",
                table: "Locations",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UlbType",
                table: "Locations");
        }
    }
}
