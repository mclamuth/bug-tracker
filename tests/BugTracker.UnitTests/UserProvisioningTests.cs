using BugTracker.Application;
using BugTracker.Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace BugTracker.UnitTests;

public sealed class UserProvisioningTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly BugTrackerDbContext _db;
    private readonly FixedClock _clock = new(new DateTime(2026, 10, 19, 16, 0, 0, DateTimeKind.Utc));

    public UserProvisioningTests()
    {
        _connection.Open();
        _db = new BugTrackerDbContext(new DbContextOptionsBuilder<BugTrackerDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
    }

    [Fact]
    public async Task First_entra_sign_in_links_the_seeded_person_by_email()
    {
        var oid = Guid.NewGuid();
        var sut = new UserProvisioning(_db, _clock);

        var user = await sut.ResolveAsync(oid, "MLamuth@CTA.org", "Michael Lamuth", CancellationToken.None);

        Assert.Equal(SeedData.MichaelLamuth, user.Id);
        Assert.Equal(oid, user.EntraObjectId);
        Assert.Equal(_clock.UtcNow, user.LastSignInAt);
    }

    [Fact]
    public async Task Later_sign_ins_match_by_object_id()
    {
        var oid = Guid.NewGuid();
        var sut = new UserProvisioning(_db, _clock);
        await sut.ResolveAsync(oid, "kfukumoto@cta.org", "Ken Fukumoto", CancellationToken.None);

        var again = await sut.ResolveAsync(oid, "renamed@cta.org", "Ken F.", CancellationToken.None);

        Assert.Equal(SeedData.KenFukumoto, again.Id);
    }

    [Fact]
    public async Task Someone_new_gets_a_user_row_with_no_roles()
    {
        var sut = new UserProvisioning(_db, _clock);

        var user = await sut.ResolveAsync(Guid.NewGuid(), "New.Person@cta.org", "New Person", CancellationToken.None);

        Assert.True(user.Id > SeedData.KenFukumoto);
        Assert.Equal("new.person@cta.org", user.Email);
        Assert.False(user.IsDeveloper || user.IsIca || user.IsSupervisor);
    }

    [Theory]
    [InlineData("Max Caber", "MC")]
    [InlineData("Shyamal Gurazada", "SG")]
    [InlineData("Cher", "C")]
    [InlineData("Mary Ann van Dyke", "MD")]
    public void Initials_use_first_and_last_names(string name, string expected)
    {
        Assert.Equal(expected, DirectoryService.Initials(name));
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private sealed class FixedClock(DateTime now) : IClock
    {
        public DateTime UtcNow { get; } = now;
    }
}
