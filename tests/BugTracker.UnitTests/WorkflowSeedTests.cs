using BugTracker.Domain;
using BugTracker.Infrastructure.Data;

namespace BugTracker.UnitTests;

/// <summary>Guards the seeded workflow against accidental edits that would break the agreed design.</summary>
public sealed class WorkflowSeedTests
{
    private static bool Allowed(int from, int to) =>
        SeedData.Transitions.Any(t => t.FromStatusId == from && t.ToStatusId == to);

    private static StatusTransition Rule(int from, int to) =>
        SeedData.Transitions.Single(t => t.FromStatusId == from && t.ToStatusId == to);

    [Fact]
    public void Triage_can_assign_in_one_step()
    {
        Assert.True(Allowed(StatusIds.New, StatusIds.Assigned));
        Assert.True(Rule(StatusIds.New, StatusIds.Assigned).RequiresAssignee);
    }

    [Fact]
    public void Tickets_close_only_after_verification()
    {
        var intoClosed = SeedData.Transitions.Where(t => t.ToStatusId == StatusIds.Closed).ToList();

        var only = Assert.Single(intoClosed);
        Assert.Equal(StatusIds.Verified, only.FromStatusId);
    }

    [Theory]
    [InlineData(StatusIds.New)]
    [InlineData(StatusIds.Triaged)]
    [InlineData(StatusIds.InProgress)]
    public void Wont_fix_needs_a_comment_and_a_resolution(int from)
    {
        var rule = Rule(from, StatusIds.WontFix);

        Assert.True(rule.RequiresComment);
        Assert.True(rule.RequiresResolution);
    }

    [Theory]
    [InlineData(StatusIds.ReadyForTest)]
    [InlineData(StatusIds.Closed)]
    [InlineData(StatusIds.WontFix)]
    public void Reopening_needs_a_comment(int from)
    {
        Assert.True(Rule(from, StatusIds.Reopened).RequiresComment);
    }

    [Fact]
    public void Ready_for_test_cannot_be_closed_as_wont_fix()
    {
        Assert.False(Allowed(StatusIds.ReadyForTest, StatusIds.WontFix));
    }

    [Fact]
    public void Every_status_has_a_way_forward()
    {
        foreach (var status in SeedData.Statuses)
        {
            Assert.True(SeedData.Transitions.Any(t => t.FromStatusId == status.Id), $"{status.Name} is a dead end.");
        }
    }

    [Fact]
    public void Only_closed_and_wont_fix_are_closed_statuses()
    {
        var closed = SeedData.Statuses.Where(s => s.IsClosed).Select(s => s.Id).Order().ToArray();

        Assert.Equal([StatusIds.Closed, StatusIds.WontFix], closed);
    }
}
