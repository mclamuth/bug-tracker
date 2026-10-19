using BugTracker.Domain;

namespace BugTracker.Application.Tickets;

/// <summary>
/// Finds @mentions in comment text. The comment box inserts "@Display Name", so a mention is an @
/// followed by a team member's full name, not followed by another letter or digit.
/// </summary>
public static class MentionParser
{
    public static IReadOnlySet<int> FindMentionedUserIds(string body, IEnumerable<User> people)
    {
        var found = new HashSet<int>();
        if (string.IsNullOrEmpty(body) || !body.Contains('@', StringComparison.Ordinal))
        {
            return found;
        }

        // Longest names first, so "@Max Caber" isn't also read as a shorter name that shares its start.
        foreach (var person in people.OrderByDescending(p => p.DisplayName.Length))
        {
            var token = "@" + person.DisplayName;
            var index = 0;
            while ((index = body.IndexOf(token, index, StringComparison.OrdinalIgnoreCase)) >= 0)
            {
                var end = index + token.Length;
                var startsCleanly = index == 0 || !char.IsLetterOrDigit(body[index - 1]);
                var endsCleanly = end == body.Length || !char.IsLetterOrDigit(body[end]);
                if (startsCleanly && endsCleanly)
                {
                    found.Add(person.Id);
                    break;
                }
                index = end;
            }
        }

        return found;
    }
}
