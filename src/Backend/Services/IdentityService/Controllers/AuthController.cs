using System;
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
                vendorId = user.VendorId
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
}
