using System;
using Microsoft.EntityFrameworkCore;

namespace PostTenderSystem.Tests.Helpers;

/// <summary>
/// Builds a throwaway in-memory DbContext. Each call gets a uniquely named database
/// so tests never share state, which lets them run in parallel safely.
/// Every service context in this solution exposes a (DbContextOptions&lt;T&gt;) constructor,
/// which is what Activator resolves here.
/// </summary>
public static class TestDb
{
    public static TContext Create<TContext>() where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = (TContext)Activator.CreateInstance(typeof(TContext), options)!;
        context.Database.EnsureCreated();
        return context;
    }
}
