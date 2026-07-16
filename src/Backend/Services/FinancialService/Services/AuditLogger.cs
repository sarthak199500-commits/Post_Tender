using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace FinancialService.Services;

/// <summary>
/// Best-effort forwarder that records an audit entry in CommonService's central audit
/// sink. Failures are swallowed so audit logging can never break the primary operation.
/// The caller's JWT is forwarded so CommonService can attribute the acting user.
/// </summary>
public class AuditLogger
{
    private readonly HttpClient _http;
    private readonly IHttpContextAccessor _accessor;

    public AuditLogger(HttpClient http, IHttpContextAccessor accessor)
    {
        _http = http;
        _accessor = accessor;
    }

    public async Task LogAsync(string entityName, string recordId, string action, string changesInfo = "")
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/auditlogs")
            {
                Content = JsonContent.Create(new { entityName, recordId, action, changesInfo })
            };

            var auth = _accessor.HttpContext?.Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrEmpty(auth))
                request.Headers.TryAddWithoutValidation("Authorization", auth);

            await _http.SendAsync(request);
        }
        catch
        {
            // Best-effort: never fail the caller because the audit sink is unavailable.
        }
    }
}
