using System;
using System.Net.Http;
using Microsoft.AspNetCore.Http;

namespace PostTenderSystem.Tests.Helpers;

/// <summary>
/// Supplies the AuditLogger that ProgressReportsController, BillsController and
/// WorkOrdersController take as their second constructor argument.
///
/// AuditLogger is a concrete class whose LogAsync is not virtual, so Moq cannot
/// intercept it. It does not need mocking: LogAsync wraps its whole body in
/// try/catch and swallows every failure by design ("never fail the caller because
/// the audit sink is unavailable"), so a real instance pointed at a dead address
/// is inert in tests.
///
/// The three AuditLogger types are structurally identical but live in different
/// assemblies and namespaces, hence one factory each.
/// </summary>
public static class TestAudit
{
    private static HttpClient DeadClient() =>
        new HttpClient { BaseAddress = new Uri("http://localhost:1") };

    public static ExecutionService.Services.AuditLogger ForExecution() =>
        new ExecutionService.Services.AuditLogger(DeadClient(), new HttpContextAccessor());

    public static FinancialService.Services.AuditLogger ForFinancial() =>
        new FinancialService.Services.AuditLogger(DeadClient(), new HttpContextAccessor());

    public static TenderService.Services.AuditLogger ForTender() =>
        new TenderService.Services.AuditLogger(DeadClient(), new HttpContextAccessor());
}
