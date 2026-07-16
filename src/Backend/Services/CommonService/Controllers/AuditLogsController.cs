using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CommonService.Persistence;
using CommonService.Entities;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace CommonService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuditLogsController : ControllerBase
{
    private readonly CommonServiceDbContext _context;

    public AuditLogsController(CommonServiceDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        return Ok(await _context.AuditLogs.OrderByDescending(l => l.Timestamp).Take(20).ToListAsync());
    }

    // Central audit sink. Other services POST here (forwarding the caller's JWT) after an
    // auditable action; the acting user is taken from that token, not the request body.
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] AuditLogEntryDto dto)
    {
        if (dto == null) return BadRequest("Audit entry is required.");

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid? userId = Guid.TryParse(userIdStr, out var uid) ? uid : (Guid?)null;

        var log = new AuditLog
        {
            EntityName = dto.EntityName,
            RecordId = dto.RecordId,
            Action = dto.Action,
            ChangesInfo = dto.ChangesInfo ?? string.Empty,
            UserId = userId
        };

        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync();
        return Ok(log);
    }

    public class AuditLogEntryDto
    {
        public string EntityName { get; set; } = string.Empty;
        public string RecordId { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? ChangesInfo { get; set; }
    }
}
