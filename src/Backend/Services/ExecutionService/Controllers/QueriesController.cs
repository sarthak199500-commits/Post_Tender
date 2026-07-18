using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExecutionService.Entities;
using ExecutionService.Persistence;
using ExecutionService.Security;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ExecutionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class QueriesController : ControllerBase
{
    private readonly ExecutionServiceDbContext _context;

    public QueriesController(ExecutionServiceDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        // .Include is required: without it every query returns an empty Messages list
        // and both the vendor and admin threads render blank.
        var query = _context.Queries.Include(q => q.Messages).AsQueryable();

        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(q => q.VendorId == me);
        }

        return Ok(await query.OrderByDescending(q => q.CreatedAt).ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateQueryDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Subject))
            return BadRequest("Subject is required.");

        var now = DateTime.UtcNow;
        var query = new Query
        {
            VendorId = vendorId.Value,
            Subject = dto.Subject.Trim(),
            Status = "Open",
            CreatedAt = now
        };

        foreach (var m in dto.Messages.Where(m => !string.IsNullOrWhiteSpace(m.Content)))
            query.Messages.Add(BuildMessage(m.Content, now));

        _context.Queries.Add(query);
        await _context.SaveChangesAsync();
        return Ok(query);
    }

    [HttpPost("{id}/message")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] CreateMessageDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Content is required.");

        var query = await _context.Queries.FirstOrDefaultAsync(q => q.Id == id);
        if (query is null) return NotFound("Query not found.");

        if (CallerContext.IsVendor(User) && CallerContext.VendorId(User) != query.VendorId)
            return Forbid();

        var message = BuildMessage(dto.Content, DateTime.UtcNow);
        message.QueryId = query.Id;
        _context.QueryMessages.Add(message);

        if (query.Status == "Open")
            query.Status = "In Progress";

        await _context.SaveChangesAsync();

        // Reload with the full thread for the response.
        var full = await _context.Queries.Include(q => q.Messages)
                                         .FirstOrDefaultAsync(q => q.Id == id);
        return Ok(full);
    }

    private QueryMessage BuildMessage(string content, DateTime at) => new()
    {
        Content = content.Trim(),
        Timestamp = at,
        SenderRole = User.FindFirstValue(ClaimTypes.Role) ?? "Unknown",
        SenderName = User.FindFirstValue("Name") ?? string.Empty
    };

    public class CreateQueryDto
    {
        public string Subject { get; set; } = string.Empty;
        public List<CreateMessageDto> Messages { get; set; } = new();
    }

    public class CreateMessageDto
    {
        public string Content { get; set; } = string.Empty;
    }
}
