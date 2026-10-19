namespace BugTracker.Application;

/// <summary>Why an operation could not be done. The API turns each kind into an HTTP status.</summary>
public enum ErrorKind
{
    /// <summary>400: the request has missing or invalid values.</summary>
    Validation,

    /// <summary>403: the signed-in person may not do this (e.g. edit someone else's comment).</summary>
    Forbidden,

    /// <summary>404: the ticket, comment or attachment doesn't exist.</summary>
    NotFound,

    /// <summary>409: not allowed in the ticket's current state, or someone else changed it first.</summary>
    Conflict,
}

public sealed record AppError(ErrorKind Kind, string Title, IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static AppError NotFound(string what) => new(ErrorKind.NotFound, $"{what} was not found.");

    public static AppError Forbidden(string why) => new(ErrorKind.Forbidden, why);

    public static AppError Conflict(string why) => new(ErrorKind.Conflict, why);

    /// <summary>Someone else saved the ticket after this person loaded it.</summary>
    public static AppError StaleTicket() =>
        new(ErrorKind.Conflict, "Someone else updated this ticket. Reload to see the latest changes.");

    public static AppError Invalid(string field, string message) =>
        new(ErrorKind.Validation, "Please correct the highlighted fields.", new Dictionary<string, string[]> { [field] = [message] });

    public static AppError Invalid(IReadOnlyDictionary<string, string[]> errors) =>
        new(ErrorKind.Validation, "Please correct the highlighted fields.", errors);
}

/// <summary>Either a value or an error, so services never throw for expected failures.</summary>
[System.Diagnostics.CodeAnalysis.SuppressMessage("Design", "CA1000", Justification = "Ok/Fail factories read naturally on the result type.")]
public readonly struct AppResult<T>
{
    private AppResult(T? value, AppError? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }
    public AppError? Error { get; }
    public bool IsSuccess => Error is null;

    public static AppResult<T> Ok(T value) => new(value, null);

    public static AppResult<T> Fail(AppError error) => new(default, error);

    public static implicit operator AppResult<T>(T value) => Ok(value);

    public static implicit operator AppResult<T>(AppError error) => Fail(error);
}

/// <summary>Collects field errors and turns them into one validation error.</summary>
public sealed class ValidationErrors
{
    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.OrdinalIgnoreCase);

    public bool Any => _errors.Count > 0;

    public void Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list))
        {
            list = [];
            _errors[field] = list;
        }
        list.Add(message);
    }

    public AppError ToError() => AppError.Invalid(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));
}
