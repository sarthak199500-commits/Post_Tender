using System;
using System.Linq;
using System.Threading.Tasks;
using IdentityService.Contracts;
using IdentityService.Entities;
using IdentityService.Persistence;
using IdentityService.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IdentityDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(IdentityDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim().ToLower();
        var user = _context.Users.FirstOrDefault(u => u.Email.ToLower() == email);

        if (user == null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials.");

        var token = TokenIssuer.Issue(user, _configuration["Jwt:Key"]!);

        return Ok(new
        {
            token,
            user = new {
                id = user.Id,
                email = user.Email,
                name = user.Name,
                role = user.Role.ToString(),
                vendorId = user.VendorId,
                mustChangePassword = user.MustChangePassword
            }
        });
    }

    // Called by VendorService when an Admin/PMU provisions a vendor. The caller's bearer
    // token is forwarded, so the role check below is enforced against the real acting user.
    // NOTE: AuthController deliberately has no class-level [Authorize] — that would lock
    // everyone out of Login. This method-level attribute is what guards registration.
    [HttpPost("register")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Email and password are required.");

        if (request.Password.Length < 8)
            return BadRequest("Password must be at least 8 characters.");

        if (!Enum.TryParse<Role>(request.Role, out var role))
            return BadRequest($"Unknown role '{request.Role}'.");

        var email = request.Email.Trim().ToLowerInvariant();

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
            return Conflict($"A user with email '{email}' already exists.");

        var user = new User
        {
            Name = request.Name,
            Email = email,
            Role = role,
            VendorId = role == Role.Vendor ? request.VendorId : null,
            PasswordHash = PasswordHasher.Hash(request.Password)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { userId = user.Id, email = user.Email, role = user.Role.ToString() });
    }

    // Internal staff accounts (everything except Vendor logins, which have their own
    // directory, and Inspectors, which are managed under Inspection). Password hashes
    // are never projected out. Admin/PMU only.
    [HttpGet("users")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> GetInternalUsers()
    {
        var internalRoles = new[] { Role.Admin, Role.PMU, Role.Finance, Role.Department };

        var users = await _context.Users
            .Where(u => internalRoles.Contains(u.Role))
            .OrderBy(u => u.Name)
            .Select(u => new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                role = u.Role.ToString(),
                createdAt = u.CreatedAt,
                mustChangePassword = u.MustChangePassword
            })
            .ToListAsync();

        return Ok(users);
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    /// <summary>
    /// Minimum length only. Deliberately not a composition rule (upper/digit/symbol):
    /// length is what actually resists guessing, and composition rules push people
    /// toward predictable substitutions.
    /// </summary>
    private const int MinPasswordLength = 8;

    // Any signed-in user changes their own password. Proving knowledge of the current one
    // is what stops a borrowed session from locking the real owner out.
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (request is null) return BadRequest("Request body is required.");
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < MinPasswordLength)
            return BadRequest($"The new password must be at least {MinPasswordLength} characters.");

        var callerId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(callerId, out var userId)) return Forbid();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return NotFound("User not found.");

        if (!PasswordHasher.Verify(request.CurrentPassword ?? string.Empty, user.PasswordHash))
            return BadRequest("The current password is incorrect.");

        if (PasswordHasher.Verify(request.NewPassword, user.PasswordHash))
            return BadRequest("The new password must be different from the current one.");

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
        user.MustChangePassword = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password changed." });
    }

    public class ResetPasswordRequest
    {
        /// <summary>Optional. When omitted the server generates one and returns it.</summary>
        public string? TemporaryPassword { get; set; }
    }

    // Admin-initiated reset. There is no email sender in this system, so the temporary
    // password is returned in the response for the admin to hand over out-of-band rather
    // than mailed. It is returned exactly once and stored only as a hash.
    [HttpPost("users/{id}/reset-password")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest? request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound("User not found.");

        var temporary = request?.TemporaryPassword;
        if (string.IsNullOrWhiteSpace(temporary))
            temporary = GenerateTemporaryPassword();
        else if (temporary.Length < MinPasswordLength)
            return BadRequest($"The temporary password must be at least {MinPasswordLength} characters.");

        user.PasswordHash = PasswordHasher.Hash(temporary);
        user.MustChangePassword = true;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Password reset. Give this temporary password to the user — it is not shown again.",
            temporaryPassword = temporary,
            mustChangePassword = true
        });
    }

    // Cryptographically random, and drawn from an alphabet with no 0/O or 1/l/I so it
    // survives being read aloud or written down.
    private static string GenerateTemporaryPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(12);
        return new string(bytes.Select(b => alphabet[b % alphabet.Length]).ToArray());
    }
}
