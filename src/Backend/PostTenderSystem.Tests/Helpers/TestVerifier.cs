using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using FinancialService.Services;
using Microsoft.AspNetCore.Http;

namespace PostTenderSystem.Tests.Helpers;

/// <summary>
/// Builds the <see cref="WorkOrderVerifier"/> that BillsController takes as its third
/// constructor argument.
///
/// Unlike <see cref="TestAudit"/>, this one cannot be pointed at a dead address and
/// ignored: the verifier fails CLOSED on purpose, so an unreachable transport rejects
/// every bill with "could not be verified right now". Tests therefore stub the HTTP
/// layer rather than the class, which keeps the real ownership and milestone-status
/// logic under test instead of mocking it away.
/// </summary>
public static class TestVerifier
{
    /// <summary>
    /// The id of the single milestone the stub reports. Not Guid.Empty: the verifier treats
    /// an empty guid as "no id present" and would report the milestone as missing.
    /// </summary>
    public static readonly Guid StubMilestoneId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    /// <summary>
    /// A verifier that answers as though the work order belongs to <paramref name="ownerVendorId"/>
    /// and every milestone on it is Completed — the happy path.
    /// </summary>
    public static WorkOrderVerifier OwnedBy(Guid ownerVendorId, decimal totalValue = 10_000_000m) =>
        Build(ownerVendorId, totalValue, milestoneStatus: "Completed");

    /// <summary>A verifier whose milestones come back in a non-billable state.</summary>
    public static WorkOrderVerifier WithIncompleteMilestones(Guid ownerVendorId) =>
        Build(ownerVendorId, 10_000_000m, milestoneStatus: "Pending");

    /// <summary>A verifier that cannot reach the other services, to exercise fail-closed.</summary>
    public static WorkOrderVerifier Unreachable() =>
        new(new HttpClient(new UnreachableHandler()) { BaseAddress = new Uri("http://localhost:1") },
            new HttpContextAccessor());

    private static WorkOrderVerifier Build(Guid ownerVendorId, decimal totalValue, string milestoneStatus)
    {
        var handler = new StubHandler(ownerVendorId, totalValue, milestoneStatus);
        return new WorkOrderVerifier(
            new HttpClient(handler) { BaseAddress = new Uri("http://localhost") },
            new HttpContextAccessor());
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Guid _ownerVendorId;
        private readonly decimal _totalValue;
        private readonly string _milestoneStatus;

        public StubHandler(Guid ownerVendorId, decimal totalValue, string milestoneStatus)
        {
            _ownerVendorId = ownerVendorId;
            _totalValue = totalValue;
            _milestoneStatus = milestoneStatus;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath;

            // Far-future end date so the liquidated-damages calculator stays out of the way
            // of tests that are not about LD.
            var json = path.Contains("/milestones", StringComparison.OrdinalIgnoreCase)
                ? $"[{{\"id\":\"{StubMilestoneId}\",\"title\":\"Stub\",\"status\":\"{_milestoneStatus}\"}}]"
                : $"{{\"id\":\"{Guid.NewGuid()}\",\"vendorId\":\"{_ownerVendorId}\",\"totalValue\":{_totalValue},"
                  + "\"endDate\":\"2099-12-31T00:00:00\",\"status\":\"Accepted\"}";

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
            });
        }
    }

    private sealed class UnreachableHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            throw new HttpRequestException("stubbed: service unreachable");
    }
}
