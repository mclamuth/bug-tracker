namespace BugTracker.Domain;

/// <summary>Whether a ticket reports a problem or asks for something new.</summary>
public enum TicketType : byte
{
    Defect = 1,
    Enhancement = 2,
}

/// <summary>How badly a defect affects people. Enhancements have no severity.</summary>
public enum Severity : byte
{
    Critical = 1,
    High = 2,
    Medium = 3,
    Low = 4,
}

/// <summary>How soon the team should work on a ticket. P1 is the most urgent.</summary>
public enum Priority : byte
{
    P1Urgent = 1,
    P2High = 2,
    P3Normal = 3,
    P4Low = 4,
}

/// <summary>Where a defect was found.</summary>
public enum TicketEnvironment : byte
{
    Production = 1,
    Test = 2,
    Development = 3,
}

/// <summary>Why a ticket was closed.</summary>
public enum Resolution : byte
{
    Fixed = 1,
    Implemented = 2,
    WontFix = 3,
    Duplicate = 4,
    CannotReproduce = 5,
    ByDesign = 6,
}

/// <summary>Delivery state of a queued email.</summary>
public enum EmailStatus : byte
{
    Pending = 1,
    Sent = 2,
    Failed = 3,
}
