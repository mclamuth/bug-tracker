using System.Text.Json;
using BugTracker.Application;
using BugTracker.Application.Tickets;
using BugTracker.Domain;

namespace BugTracker.UnitTests;

public sealed class MentionParserTests
{
    private static readonly User[] People =
    [
        new() { Id = 1, DisplayName = "Max Caber", Email = "m" },
        new() { Id = 6, DisplayName = "Elyse Orris", Email = "e" },
        new() { Id = 10, DisplayName = "Greg Gee", Email = "g" },
    ];

    [Theory]
    [InlineData("@Elyse Orris please retest", new[] { 6 })]
    [InlineData("Thanks @max caber and @Greg Gee.", new[] { 1, 10 })]
    [InlineData("(@Greg Gee)", new[] { 10 })]
    [InlineData("email elyse@Elyse Orris.org", new int[0])] // Part of a word, not a mention.
    [InlineData("@Greg Geeks", new int[0])]
    [InlineData("No mentions here", new int[0])]
    public void Finds_full_name_mentions_only(string body, int[] expected)
    {
        Assert.Equal(expected.Order(), MentionParser.FindMentionedUserIds(body, People).Order());
    }
}

public sealed class SafeFileNameTests
{
    [Theory]
    [InlineData("report.pdf", "report.pdf")]
    [InlineData("../../etc/passwd.txt", "passwd.txt")]
    [InlineData(@"C:\Users\max\Desktop\screen shot.png", "screen shot.png")]
    [InlineData("what?.csv", "what.csv")]
    [InlineData("...", "file")]
    public void Keeps_just_a_safe_file_name(string input, string expected)
    {
        Assert.Equal(expected, AttachmentService.SafeFileName(input));
    }
}

public sealed class PatchJsonTests
{
    private sealed record Edit
    {
        public Patch<string?> Name { get; init; }
        public Patch<int> Count { get; init; }
    }

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { Converters = { new PatchJsonConverterFactory() } };

    [Fact]
    public void Absent_null_and_values_are_told_apart()
    {
        var absent = JsonSerializer.Deserialize<Edit>("{}", Options)!;
        var nulled = JsonSerializer.Deserialize<Edit>("""{"name":null}""", Options)!;
        var set = JsonSerializer.Deserialize<Edit>("""{"name":"Max","count":3}""", Options)!;

        Assert.False(absent.Name.HasValue);
        Assert.True(nulled.Name.HasValue);
        Assert.Null(nulled.Name.Value);
        Assert.Equal("Max", set.Name.Value);
        Assert.Equal(3, set.Count.Value);
    }
}
