using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FinancialService.Controllers;
using FinancialService.Entities;
using FinancialService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Financial;

/// <summary>
/// POST /api/bills did not exist, so SubmitBillModal.tsx 404'd — a vendor could never
/// submit a bill, which is why Finance had nothing to approve or pay.
/// </summary>
public class BillsTests
{
    private static BillsController Build(FinancialServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new BillsController(ctx, TestAudit.ForFinancial());
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    private static List<Bill> BillsIn(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsAssignableFrom<IEnumerable<Bill>>(ok.Value).ToList();
    }

    [Fact]
    public async Task Create_StampsVendorIdFromClaim_IgnoringBody()
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var myVendor = Guid.NewGuid();
        var controller = Build(ctx, "Vendor", myVendor);

        var result = await controller.Create(new BillsController.CreateBillDto
        {
            WorkOrderId = Guid.NewGuid(),
            BillNo = "RA-001",
            Type = "RA",
            Amount = 100000,
            TaxAmount = 18000
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.Bills);
        Assert.Equal(myVendor, saved.VendorId);   // claim wins
        Assert.Equal("Submitted", saved.Status);
        Assert.Equal(118000, saved.TotalAmount);
    }

    [Fact]
    public async Task Create_AsNonVendor_IsForbidden()
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var controller = Build(ctx, "Finance", null);

        var result = await controller.Create(new BillsController.CreateBillDto
        {
            WorkOrderId = Guid.NewGuid(), Amount = 5000
        });

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(ctx.Bills);
    }

    [Fact]
    public async Task Create_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var controller = Build(ctx, "Vendor", null);

        var result = await controller.Create(new BillsController.CreateBillDto
        {
            WorkOrderId = Guid.NewGuid(), Amount = 5000
        });

        Assert.IsType<ForbidResult>(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-500)]
    public async Task Create_RejectsNonPositiveAmount(decimal amount)
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Create(new BillsController.CreateBillDto
        {
            WorkOrderId = Guid.NewGuid(), Amount = amount
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Bills);
    }

    [Fact]
    public async Task Create_RequiresWorkOrderId()
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Create(new BillsController.CreateBillDto
        {
            WorkOrderId = Guid.Empty, Amount = 5000
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Create_RejectsUnknownType()
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Create(new BillsController.CreateBillDto
        {
            WorkOrderId = Guid.NewGuid(), Amount = 5000, Type = "Bogus"
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Get_AsVendor_ReturnsOnlyOwnBills()
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        var mine = Guid.NewGuid();
        ctx.Bills.AddRange(
            new Bill { VendorId = mine, WorkOrderId = Guid.NewGuid(), BillNo = "MINE", Amount = 1 },
            new Bill { VendorId = Guid.NewGuid(), WorkOrderId = Guid.NewGuid(), BillNo = "THEIRS", Amount = 1 });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx, "Vendor", mine);

        var bills = BillsIn(await controller.Get());
        Assert.Single(bills);
        Assert.Equal("MINE", bills[0].BillNo);
    }

    [Theory]
    [InlineData("Finance")]
    [InlineData("Department")]
    [InlineData("Admin")]
    public async Task Get_AsReviewer_ReturnsAllBills(string role)
    {
        using var ctx = TestDb.Create<FinancialServiceDbContext>();
        ctx.Bills.AddRange(
            new Bill { VendorId = Guid.NewGuid(), WorkOrderId = Guid.NewGuid(), BillNo = "A", Amount = 1 },
            new Bill { VendorId = Guid.NewGuid(), WorkOrderId = Guid.NewGuid(), BillNo = "B", Amount = 1 });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx, role, null);

        Assert.Equal(2, BillsIn(await controller.Get()).Count);
    }
}
