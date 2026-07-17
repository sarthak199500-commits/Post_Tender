using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace VendorService.Clients;

public class IdentityClient : IIdentityClient
{
    private readonly HttpClient _http;
    private readonly IHttpContextAccessor _accessor;

    public IdentityClient(HttpClient http, IHttpContextAccessor accessor)
    {
        _http = http;
        _accessor = accessor;
    }

    public async Task<Guid> RegisterVendorAsync(string name, string email, string password,
                                                Guid vendorId, CancellationToken ct = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/register")
        {
            Content = JsonContent.Create(new { name, email, password, role = "Vendor", vendorId })
        };

        // Forward the caller's bearer token so IdentityService enforces its own
        // [Authorize(Roles="Admin,PMU")] against the real acting user rather than
        // trusting VendorService.
        var auth = _accessor.HttpContext?.Request.Headers["Authorization"].ToString();
        if (!string.IsNullOrWhiteSpace(auth))
            request.Headers.TryAddWithoutValidation("Authorization", auth);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException($"IdentityService is unreachable: {ex.Message}", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"Identity registration failed ({(int)response.StatusCode}): {body}");
        }

        var payload = await response.Content.ReadFromJsonAsync<RegisterResponse>(cancellationToken: ct);
        if (payload is null || payload.UserId == Guid.Empty)
            throw new InvalidOperationException("Identity returned no userId.");

        return payload.UserId;
    }

    private class RegisterResponse
    {
        public Guid UserId { get; set; }
    }
}
