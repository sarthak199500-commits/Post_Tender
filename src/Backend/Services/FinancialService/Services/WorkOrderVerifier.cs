using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace FinancialService.Services;

/// <summary>Outcome of validating a bill against the work order it claims against.</summary>
public class WorkOrderCheckResult
{
    /// <summary>Null when the check passed; otherwise the reason to hand back to the caller.</summary>
    public string? Error { get; init; }

    // Carried back alongside a successful check so the caller (BillsController) can price
    // an advance cap and a liquidated-damages deduction without a second round trip.
    public decimal TotalValue { get; init; }
    public DateTime? EndDate { get; init; }
    public string? WorkOrderStatus { get; init; }

    public bool Ok => Error is null;

    public static WorkOrderCheckResult Fail(string reason) => new() { Error = reason };
}

/// <summary>
/// Checks the facts a bill depends on that FinancialService cannot see for itself: who owns
/// the work order (TenderService), whether the claimed milestones are actually complete
/// (ExecutionService), and the work order's contract value / schedule status (used to cap an
/// advance request and to price an overdue work order's liquidated-damages deduction).
///
/// Without this, Create trusted the WorkOrderId in the request body: a vendor could bill
/// against another vendor's work order, and could claim a milestone that had never been
/// completed. The "only Completed milestones are billable" rule existed solely in the React
/// modal, which is not a control — anything can POST to the API directly.
///
/// Unlike <see cref="AuditLogger"/> this fails CLOSED. Audit is best-effort because losing a
/// log entry must not block a payment; an ownership check is the opposite — if it cannot be
/// answered, the safe outcome is to refuse the bill and let the vendor retry.
/// </summary>
public class WorkOrderVerifier
{
    private readonly HttpClient _http;
    private readonly IHttpContextAccessor _accessor;

    public WorkOrderVerifier(HttpClient http, IHttpContextAccessor accessor)
    {
        _http = http;
        _accessor = accessor;
    }

    public async Task<WorkOrderCheckResult> ValidateAsync(Guid workOrderId, Guid vendorId, IReadOnlyCollection<Guid> milestoneIds)
    {
        JsonElement workOrder;
        try
        {
            workOrder = await GetAsync($"/api/workorders/{workOrderId}");
        }
        catch (Exception)
        {
            return WorkOrderCheckResult.Fail("The work order could not be verified right now. Please try submitting again shortly.");
        }

        if (workOrder.ValueKind != JsonValueKind.Object)
            return WorkOrderCheckResult.Fail("That work order does not exist.");

        if (!TryGetGuid(workOrder, "vendorId", out var owner))
            return WorkOrderCheckResult.Fail("That work order has no vendor assigned, so it cannot be billed against.");

        if (owner != vendorId)
            return WorkOrderCheckResult.Fail("That work order belongs to another vendor.");

        var totalValue = workOrder.TryGetProperty("totalValue", out var tv) && tv.TryGetDecimal(out var tvNum) ? tvNum : 0m;
        var endDate = workOrder.TryGetProperty("endDate", out var ed) && ed.ValueKind == JsonValueKind.String
            && DateTime.TryParse(ed.GetString(), out var edVal) ? edVal : (DateTime?)null;
        var woStatus = workOrder.TryGetProperty("status", out var st) ? st.GetString() : null;

        if (milestoneIds.Count > 0)
        {
            JsonElement milestones;
            try
            {
                milestones = await GetAsync($"/api/execution/milestones?workOrderId={workOrderId}");
            }
            catch (Exception)
            {
                return WorkOrderCheckResult.Fail("The milestones could not be verified right now. Please try submitting again shortly.");
            }

            if (milestones.ValueKind != JsonValueKind.Array)
                return WorkOrderCheckResult.Fail("The milestones for that work order could not be read.");

            var byId = new Dictionary<Guid, JsonElement>();
            foreach (var m in milestones.EnumerateArray())
                if (TryGetGuid(m, "id", out var mid)) byId[mid] = m;

            foreach (var id in milestoneIds)
            {
                if (!byId.TryGetValue(id, out var milestone))
                    return WorkOrderCheckResult.Fail($"Milestone {id} does not belong to that work order.");

                var status = milestone.TryGetProperty("status", out var s) ? s.GetString() : null;
                if (!string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase))
                    return WorkOrderCheckResult.Fail($"Milestone '{Title(milestone) ?? id.ToString()}' is {status ?? "not completed"} — only a completed milestone can be billed.");
            }
        }

        return new WorkOrderCheckResult { TotalValue = totalValue, EndDate = endDate, WorkOrderStatus = woStatus };
    }

    private static string? Title(JsonElement milestone) =>
        milestone.TryGetProperty("title", out var t) ? t.GetString() : null;

    private static bool TryGetGuid(JsonElement element, string property, out Guid value)
    {
        value = Guid.Empty;
        if (!element.TryGetProperty(property, out var raw)) return false;
        var text = raw.ValueKind == JsonValueKind.String ? raw.GetString() : null;
        return Guid.TryParse(text, out value) && value != Guid.Empty;
    }

    // Routed through the gateway so this service does not need to know where each other
    // service lives, and so the caller's own token is what authorises the lookup.
    private async Task<JsonElement> GetAsync(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);

        var auth = _accessor.HttpContext?.Request.Headers["Authorization"].ToString();
        if (!string.IsNullOrEmpty(auth))
            request.Headers.TryAddWithoutValidation("Authorization", auth);

        var response = await _http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"GET {path} returned {(int)response.StatusCode}");

        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
