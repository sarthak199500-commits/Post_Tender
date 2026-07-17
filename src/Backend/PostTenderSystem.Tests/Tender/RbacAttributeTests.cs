using System.Linq;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using TenderService.Controllers;
using VendorService.Controllers;
using Xunit;

namespace PostTenderSystem.Tests.Tender;

/// <summary>
/// PMU is Admin-equivalent per the PTMS design doc ("Only Admin / PMU users can create and
/// manage tenders", "Vendors are registered centrally by the Admin or PMU"), and App.tsx
/// already grants PMU every Admin route. These controllers were Admin-only, so a PMU user
/// saw the pages in their own nav and got 403 on every action.
///
/// [Authorize] is not evaluated when a controller method is called directly, so these
/// assert on the attribute metadata rather than on a response.
/// </summary>
public class RbacAttributeTests
{
    private static string[] RolesOn<TController>(string methodName)
    {
        var attr = typeof(TController).GetMethod(methodName)!.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.False(string.IsNullOrWhiteSpace(attr!.Roles), $"{methodName} has [Authorize] but no roles.");
        return attr.Roles!.Split(',').Select(r => r.Trim()).ToArray();
    }

    [Theory]
    [InlineData(nameof(TendersController.GetAllTenders))]
    [InlineData(nameof(TendersController.AddTender))]
    [InlineData(nameof(TendersController.UpdateTender))]
    [InlineData(nameof(TendersController.DeleteTender))]
    public void TenderWrites_AllowPmu(string methodName)
    {
        Assert.Contains("PMU", RolesOn<TendersController>(methodName));
    }

    [Fact]
    public void AwardedTenders_AllowPmu_AlongsideAdminAndDepartment()
    {
        var roles = RolesOn<TendersController>(nameof(TendersController.GetAwardedTenders));

        Assert.Contains("Admin", roles);
        Assert.Contains("Department", roles);
        Assert.Contains("PMU", roles);
    }

    [Theory]
    [InlineData(nameof(VendorsController.AddVendor))]
    [InlineData(nameof(VendorsController.UpdateVendorStatus))]
    [InlineData(nameof(VendorsController.DeleteVendor))]
    public void VendorWrites_AllowPmu(string methodName)
    {
        Assert.Contains("PMU", RolesOn<VendorsController>(methodName));
    }

    [Theory]
    [InlineData(nameof(VendorCategoriesController.AddCategory))]
    [InlineData(nameof(VendorCategoriesController.DeleteCategory))]
    public void VendorCategoryWrites_AllowPmu(string methodName)
    {
        Assert.Contains("PMU", RolesOn<VendorCategoriesController>(methodName));
    }

    [Theory]
    [InlineData(nameof(TendersController.AddTender))]
    [InlineData(nameof(VendorsController.AddVendor))]
    [InlineData(nameof(VendorCategoriesController.AddCategory))]
    public void PrivilegedWrites_StillExcludeVendor(string methodName)
    {
        // Widening to PMU must not accidentally open these to everyone.
        var controller = methodName == nameof(TendersController.AddTender)
            ? RolesOn<TendersController>(methodName)
            : methodName == nameof(VendorsController.AddVendor)
                ? RolesOn<VendorsController>(methodName)
                : RolesOn<VendorCategoriesController>(methodName);

        Assert.DoesNotContain("Vendor", controller);
    }
}
