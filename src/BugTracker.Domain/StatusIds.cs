namespace BugTracker.Domain;

/// <summary>
/// Fixed identifiers of the nine workflow statuses. The Statuses table is seeded
/// with these ids so code can refer to a status without a lookup.
/// </summary>
public static class StatusIds
{
    public const int New = 1;
    public const int Triaged = 2;
    public const int Assigned = 3;
    public const int InProgress = 4;
    public const int ReadyForTest = 5;
    public const int Verified = 6;
    public const int Closed = 7;
    public const int Reopened = 8;
    public const int WontFix = 9;
}
