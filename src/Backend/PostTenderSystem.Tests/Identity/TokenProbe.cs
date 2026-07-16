using IdentityService.Entities;
using IdentityService.Security;

namespace PostTenderSystem.Tests.Identity;

internal static class TokenProbe
{
    private const string TestKey = "test-signing-key-at-least-32-chars-long!!";

    public static string Issue(User user) => TokenIssuer.Issue(user, TestKey);
}
