using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace PostTenderSystem.Tests.Common;

/// <summary>
/// Every controller must be reachable through the gateway.
///
/// The gateway lists routes one by one — there is no `/api/{**catch-all}` wildcard, and
/// there cannot be a single one for `/api/masters/*` either, because that namespace is
/// split across five different services with no rule mapping a master's name to its owner
/// (departments→identity, locations→common, defectcategories→inspection,
/// milestonetemplates→execution, taxconfigurations+billingpolicy→financial).
///
/// So adding a controller without adding a gateway route produces an endpoint that works
/// perfectly when called directly and 404s through the gateway — which is how every client
/// calls it. That has now happened twice (billingpolicy, timeextensions). This test turns
/// the omission into a build failure instead of a runtime mystery.
/// </summary>
public class GatewayRouteCoverageTests
{
    /// <summary>Route prefixes the gateway intentionally does not expose.</summary>
    private static readonly string[] NotExposed = Array.Empty<string>();

    [Fact]
    public void Every_controller_route_has_a_matching_gateway_route()
    {
        var gatewayPaths = LoadGatewayRoutePrefixes();
        Assert.NotEmpty(gatewayPaths);

        var missing = new List<string>();

        foreach (var controller in AllControllers())
        {
            var template = RouteTemplateFor(controller);
            if (template is null) continue;
            if (NotExposed.Contains(template, StringComparer.OrdinalIgnoreCase)) continue;

            // A controller is covered when some gateway route's prefix matches its own.
            var covered = gatewayPaths.Any(p => string.Equals(p, template, StringComparison.OrdinalIgnoreCase));
            if (!covered) missing.Add($"{controller.Name} -> /{template}");
        }

        Assert.True(missing.Count == 0,
            "These controllers have no gateway route, so they will 404 through the gateway. " +
            "Add a route to PostTenderSystem.Gateway/appsettings.json:" +
            Environment.NewLine + string.Join(Environment.NewLine, missing.Select(m => "  " + m)));
    }

    private static IEnumerable<Type> AllControllers()
    {
        // The test project references all seven services, so their assemblies are loadable
        // by name. Touching one known type per service forces the assembly to load before
        // we enumerate — otherwise a service with no other test would be invisible here.
        var anchors = new[]
        {
            typeof(IdentityService.Controllers.AuthController),
            typeof(VendorService.Controllers.VendorsController),
            typeof(TenderService.Controllers.TendersController),
            typeof(ExecutionService.Controllers.ExecutionController),
            typeof(InspectionService.Controllers.InspectionsController),
            typeof(FinancialService.Controllers.BillsController),
            typeof(CommonService.Controllers.AuditLogsController),
        };

        return anchors
            .Select(a => a.Assembly)
            .Distinct()
            .SelectMany(a => a.GetTypes())
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);
    }

    /// <summary>
    /// Resolves a controller's [Route] template with [controller] substituted, lowercased —
    /// e.g. "api/masters/billingpolicy". Returns null when the controller has no route.
    /// </summary>
    private static string? RouteTemplateFor(Type controller)
    {
        var route = controller.GetCustomAttribute<RouteAttribute>();
        if (route?.Template is null) return null;

        var name = controller.Name.EndsWith("Controller", StringComparison.Ordinal)
            ? controller.Name[..^"Controller".Length]
            : controller.Name;

        return route.Template
            .Replace("[controller]", name, StringComparison.OrdinalIgnoreCase)
            .Trim('/')
            .ToLowerInvariant();
    }

    /// <summary>
    /// Reads the gateway's configured route paths, stripping the catch-all suffix so
    /// "/api/bills/{**catch-all}" compares as "api/bills".
    /// </summary>
    private static List<string> LoadGatewayRoutePrefixes()
    {
        var settingsPath = FindGatewayAppSettings();
        using var doc = JsonDocument.Parse(File.ReadAllText(settingsPath));

        var routes = doc.RootElement.GetProperty("ReverseProxy").GetProperty("Routes");

        var paths = new List<string>();
        foreach (var route in routes.EnumerateObject())
        {
            if (!route.Value.TryGetProperty("Match", out var match)) continue;
            if (!match.TryGetProperty("Path", out var path)) continue;

            var value = path.GetString();
            if (value is null) continue;

            var slash = value.IndexOf("/{", StringComparison.Ordinal);
            if (slash >= 0) value = value[..slash];

            paths.Add(value.Trim('/').ToLowerInvariant());
        }

        return paths;
    }

    private static string FindGatewayAppSettings()
    {
        // Walk up from the test binaries to the Backend folder, wherever it is built.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "PostTenderSystem.Gateway", "appsettings.json");
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        throw new FileNotFoundException(
            "Could not locate PostTenderSystem.Gateway/appsettings.json by walking up from " + AppContext.BaseDirectory);
    }
}
