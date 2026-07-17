using System;
using System.Threading;
using System.Threading.Tasks;

namespace VendorService.Clients;

/// <summary>
/// Cross-service seam to IdentityService. Exists as an interface so vendor provisioning
/// can be tested without an HTTP round trip.
/// </summary>
public interface IIdentityClient
{
    /// <summary>
    /// Creates the Vendor login in IdentityService and returns the new User.Id.
    /// Throws InvalidOperationException when Identity rejects the request (e.g. duplicate email).
    /// </summary>
    Task<Guid> RegisterVendorAsync(string name, string email, string password,
                                   Guid vendorId, CancellationToken ct = default);
}
