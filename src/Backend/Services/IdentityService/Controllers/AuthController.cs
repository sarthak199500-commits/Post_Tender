using IdentityService.Entities;
using IdentityService.Persistence;
using IdentityService.Security;
using Microsoft.AspNetCore.Mvc;

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
}
