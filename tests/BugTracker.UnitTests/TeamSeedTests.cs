using BugTracker.Infrastructure.Data;

namespace BugTracker.UnitTests;

public sealed class TeamSeedTests
{
    [Fact]
    public void Team_has_five_developers_six_icas_and_one_supervisor()
    {
        Assert.Equal(5, SeedData.Users.Count(u => u.IsDeveloper));
        Assert.Equal(6, SeedData.Users.Count(u => u.IsIca));
        Assert.Equal(1, SeedData.Users.Count(u => u.IsSupervisor));
    }

    [Fact]
    public void Michael_is_both_developer_and_ica()
    {
        var michael = SeedData.Users.Single(u => u.Id == SeedData.MichaelLamuth);

        Assert.True(michael.IsDeveloper);
        Assert.True(michael.IsIca);
    }

    [Fact]
    public void Emails_are_stored_lower_case()
    {
        Assert.All(SeedData.Users, u => Assert.Equal(u.Email.ToLowerInvariant(), u.Email));
    }

    [Fact]
    public void Every_application_defaults_to_a_developer()
    {
        var developerIds = SeedData.Users.Where(u => u.IsDeveloper).Select(u => u.Id).ToHashSet();

        Assert.Equal(22, SeedData.Applications.Length);
        Assert.All(SeedData.Applications, a => Assert.Contains(a.DefaultAssigneeId!.Value, developerIds));
    }
}
