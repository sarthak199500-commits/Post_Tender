using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CommonService.Entities;
using CommonService.Persistence;
using CommonService.Security;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CommonService.Controllers;

/// <summary>
/// Durable, per-user notifications.
///
/// The bell menu still derives *state* ("3 bills awaiting approval") client-side, because
/// that is always current by construction. This endpoint covers *events* — things that
/// happened once and need to stay visible with a read/unread mark even after the record
/// they refer to has moved on.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly CommonServiceDbContext _context;

    public AlertsController(CommonServiceDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Alerts addressed to the caller: broadcasts (no target at all), ones for their role,
    /// their vendor, or them by name. Read state is resolved per user, so one person
    /// dismissing a broadcast does not clear it for anyone else.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] bool unreadOnly = false, [FromQuery] int limit = 100)
    {
        var userId = CallerContext.UserId(User);
        if (userId is null) return Forbid();

        var role = CallerContext.Role(User);
        var vendorId = CallerContext.VendorId(User);

        var alerts = await _context.Alerts
            .Where(a =>
                (a.TargetRole == null && a.TargetUserId == null && a.TargetVendorId == null)
                || (a.TargetRole != null && a.TargetRole == role)
                || (a.TargetUserId != null && a.TargetUserId == userId)
                || (a.TargetVendorId != null && vendorId != null && a.TargetVendorId == vendorId))
            .OrderByDescending(a => a.CreatedAt)
            .Take(Math.Clamp(limit, 1, 500))
            .Select(a => new
            {
                a.Id,
                a.Type,
                a.Title,
                a.Message,
                a.EntityName,
                a.RecordId,
                a.Link,
                a.CreatedAt,
                IsRead = a.Reads.Any(r => r.UserId == userId)
            })
            .ToListAsync();

        return Ok(unreadOnly ? alerts.Where(a => !a.IsRead).ToList() : alerts);
    }

    public class CreateAlertDto
    {
        public string Type { get; set; } = "info";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;

        /// <summary>Null/empty targets everyone.</summary>
        public string? TargetRole { get; set; }
        public Guid? TargetUserId { get; set; }
        public Guid? TargetVendorId { get; set; }

        public string? EntityName { get; set; }
        public string? RecordId { get; set; }
        public string? Link { get; set; }
    }

    private static readonly string[] AllowedTypes = { "critical", "warning", "info", "success" };

    /// <summary>
    /// Raise an alert. Admin/PMU use this to broadcast; the other services post here to
    /// announce an event, forwarding the acting user's token the same way audit logging does.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,PMU,Department,Finance,Inspector")]
    public async Task<IActionResult> Create([FromBody] CreateAlertDto dto)
    {
        if (dto is null) return BadRequest("Request body is required.");
        if (string.IsNullOrWhiteSpace(dto.Title)) return BadRequest("A title is required.");
        if (string.IsNullOrWhiteSpace(dto.Message)) return BadRequest("A message is required.");

        var type = string.IsNullOrWhiteSpace(dto.Type) ? "info" : dto.Type.Trim().ToLowerInvariant();
        if (!AllowedTypes.Contains(type))
            return BadRequest($"'{dto.Type}' is not a valid alert type. Use one of: {string.Join(", ", AllowedTypes)}.");

        var alert = new Alert
        {
            Type = type,
            Title = dto.Title.Trim(),
            Message = dto.Message.Trim(),
            TargetRole = string.IsNullOrWhiteSpace(dto.TargetRole) ? null : dto.TargetRole.Trim(),
            TargetUserId = dto.TargetUserId,
            TargetVendorId = dto.TargetVendorId,
            EntityName = dto.EntityName,
            RecordId = dto.RecordId,
            Link = dto.Link,
            RaisedByUserId = CallerContext.UserId(User)
        };

        _context.Alerts.Add(alert);
        await _context.SaveChangesAsync();

        return Ok(alert);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var userId = CallerContext.UserId(User);
        if (userId is null) return Forbid();

        if (!await _context.Alerts.AnyAsync(a => a.Id == id))
            return NotFound("Alert not found.");

        // Idempotent: marking an already-read alert read again is a no-op, not a duplicate.
        if (await _context.AlertReads.AnyAsync(r => r.AlertId == id && r.UserId == userId))
            return Ok(new { message = "Already read." });

        _context.AlertReads.Add(new AlertRead { AlertId = id, UserId = userId.Value });
        await _context.SaveChangesAsync();
        return Ok(new { message = "Marked as read." });
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = CallerContext.UserId(User);
        if (userId is null) return Forbid();

        var role = CallerContext.Role(User);
        var vendorId = CallerContext.VendorId(User);

        // Only alerts the caller can actually see, and only ones not already marked.
        var unreadIds = await _context.Alerts
            .Where(a =>
                ((a.TargetRole == null && a.TargetUserId == null && a.TargetVendorId == null)
                 || (a.TargetRole != null && a.TargetRole == role)
                 || (a.TargetUserId != null && a.TargetUserId == userId)
                 || (a.TargetVendorId != null && vendorId != null && a.TargetVendorId == vendorId))
                && !a.Reads.Any(r => r.UserId == userId))
            .Select(a => a.Id)
            .ToListAsync();

        foreach (var alertId in unreadIds)
            _context.AlertReads.Add(new AlertRead { AlertId = alertId, UserId = userId.Value });

        if (unreadIds.Count > 0) await _context.SaveChangesAsync();

        return Ok(new { message = $"{unreadIds.Count} alert(s) marked as read.", count = unreadIds.Count });
    }
}
