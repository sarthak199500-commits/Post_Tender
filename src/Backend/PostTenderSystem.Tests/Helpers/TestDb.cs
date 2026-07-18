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
        => Create<TContext>(Guid.NewGuid().ToString());

    /// <summary>
    /// Opens a context over a named in-memory database. Passing the same name twice yields
    /// two contexts backed by the same store, which models the real world where each HTTP
    /// request gets a fresh DbContext — seed in one, act in another. This also sidesteps an
    /// InMemory quirk where updating a tracked parent while adding a child on the same
    /// context throws a spurious DbUpdateConcurrencyException.
    /// </summary>
    public static TContext Create<TContext>(string databaseName) where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseInMemoryDatabase(databaseName: databaseName)
            .Options;

        var context = (TContext)Activator.CreateInstance(typeof(TContext), options)!;
        context.Database.EnsureCreated();
        return context;
    }
}
