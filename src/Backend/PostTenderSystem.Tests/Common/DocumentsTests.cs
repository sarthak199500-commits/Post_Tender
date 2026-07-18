using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CommonService.Controllers;
using CommonService.Entities;
using CommonService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Common;

/// <summary>
/// POST /api/documents 404'd, so every file uploaded via /api/files/upload was written to
/// disk with no DB record — orphaned. These cover the record path and its tenant scoping.
/// </summary>
public class DocumentsTests
{
    private static DocumentsController Build(CommonServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new DocumentsController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    [Fact]
    public async Task Create_StampsVendorFromClaim_AndDefaultsPending()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var me = Guid.NewGuid();
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.Create(new DocumentsController.CreateDocumentDto
        {
            Name = "insurance.pdf", Type = "Compliance", Size = "1.2 MB", Url = "/api/files/abc.pdf"
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.ContractDocuments);
        Assert.Equal(me, saved.VendorId);
        Assert.Equal("Pending", saved.Status);
        Assert.NotEqual(default, saved.UploadedAt);
    }

    [Fact]
    public async Task Create_RequiresNameAndUrl()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        Assert.IsType<BadRequestObjectResult>(await controller.Create(
            new DocumentsController.CreateDocumentDto { Name = "", Url = "/x" }));
        Assert.IsType<BadRequestObjectResult>(await controller.Create(
            new DocumentsController.CreateDocumentDto { Name = "x", Url = "" }));
        Assert.Empty(ctx.ContractDocuments);
    }

    [Fact]
    public async Task Create_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var controller = Build(ctx, "Vendor", null);

        var result = await controller.Create(new DocumentsController.CreateDocumentDto { Name = "x", Url = "/x" });

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(ctx.ContractDocuments);
    }

    [Fact]
    public async Task Get_AsVendor_ReturnsOnlyOwn()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var mine = Guid.NewGuid();
        ctx.ContractDocuments.Add(new ContractDocument { Id = Guid.NewGuid(), VendorId = mine, Name = "mine", UploadedAt = DateTime.UtcNow });
        ctx.ContractDocuments.Add(new ContractDocument { Id = Guid.NewGuid(), VendorId = Guid.NewGuid(), Name = "theirs", UploadedAt = DateTime.UtcNow });
        ctx.SaveChanges();
        var controller = Build(ctx, "Vendor", mine);

        var ok = Assert.IsType<OkObjectResult>(await controller.Get());
        var docs = Assert.IsAssignableFrom<IEnumerable<ContractDocument>>(ok.Value);
        Assert.Equal("mine", Assert.Single(docs).Name);
    }

    [Fact]
    public async Task Get_AsAdmin_ReturnsAll()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        ctx.ContractDocuments.Add(new ContractDocument { Id = Guid.NewGuid(), VendorId = Guid.NewGuid(), Name = "a", UploadedAt = DateTime.UtcNow });
        ctx.ContractDocuments.Add(new ContractDocument { Id = Guid.NewGuid(), VendorId = Guid.NewGuid(), Name = "b", UploadedAt = DateTime.UtcNow });
        ctx.SaveChanges();
        var controller = Build(ctx, "Admin", null);

        var ok = Assert.IsType<OkObjectResult>(await controller.Get());
        Assert.Equal(2, Assert.IsAssignableFrom<IEnumerable<ContractDocument>>(ok.Value).Count());
    }

    [Fact]
    public async Task Delete_OwnDocument_Removes()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var me = Guid.NewGuid();
        var doc = new ContractDocument { Id = Guid.NewGuid(), VendorId = me, Name = "d", UploadedAt = DateTime.UtcNow };
        ctx.ContractDocuments.Add(doc);
        ctx.SaveChanges();
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.Delete(doc.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(ctx.ContractDocuments);
    }

    [Fact]
    public async Task Delete_AnotherVendorsDocument_IsNotFound()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var doc = new ContractDocument { Id = Guid.NewGuid(), VendorId = Guid.NewGuid(), Name = "d", UploadedAt = DateTime.UtcNow };
        ctx.ContractDocuments.Add(doc);
        ctx.SaveChanges();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Delete(doc.Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Single(ctx.ContractDocuments);
    }
}
