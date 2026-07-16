using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VendorService.Persistence;
using VendorService.Entities;

namespace VendorService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VendorCategoriesController : ControllerBase
{
    private readonly VendorDbContext _context;

    public VendorCategoriesController(VendorDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.VendorCategories.ToListAsync();
        return Ok(categories);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddCategory([FromBody] VendorCategory category)
    {
        if (string.IsNullOrWhiteSpace(category.Name))
            return BadRequest("Category name is required.");

        _context.VendorCategories.Add(category);
        await _context.SaveChangesAsync();
        return Ok(category);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var category = await _context.VendorCategories.FindAsync(id);
        if (category == null) return NotFound();

        _context.VendorCategories.Remove(category);
        await _context.SaveChangesAsync();
        return Ok();
    }
}
