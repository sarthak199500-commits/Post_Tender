using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IdentityService.Entities;
using Microsoft.IdentityModel.Tokens;

namespace IdentityService.Security;

public static class TokenIssuer
{
    public static string Issue(User user, string signingKey)
    {
        // Load-bearing message: the fail-fast guard added during the earlier security
        // work. Keep the wording so operators see the same guidance everywhere.
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
            throw new InvalidOperationException(
                "Jwt:Key is missing or shorter than 32 characters. Configure it via the Jwt__Key " +
                "environment variable (production) or appsettings.Development.json (local); never commit a production key.");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("Name", user.Name)
        };

        if (user.VendorId.HasValue)
            claims.Add(new Claim("vendorId", user.VendorId.Value.ToString()));

        // Encoding.ASCII (not UTF8): all seven services validate the token with
        // Encoding.ASCII.GetBytes(jwtKey). The two agree for a pure-ASCII key, so a
        // UTF8 issuer would pass every local test and then reject every token once a
        // production key contained a non-ASCII character.
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.ASCII.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
