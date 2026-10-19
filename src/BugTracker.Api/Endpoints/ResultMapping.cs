using BugTracker.Application;

namespace BugTracker.Api.Endpoints;

/// <summary>Turns service results into HTTP responses with RFC 9457 Problem Details for errors.</summary>
public static class ResultMapping
{
    public static IResult ToHttp<T>(this AppResult<T> result, Func<T, IResult>? onSuccess = null) =>
        result.IsSuccess
            ? onSuccess?.Invoke(result.Value!) ?? TypedResults.Ok(result.Value)
            : result.Error!.ToHttp();

    public static IResult ToHttp(this AppError error) => error.Kind switch
    {
        ErrorKind.Validation => TypedResults.ValidationProblem(
            error.Errors ?? new Dictionary<string, string[]>(), title: error.Title),
        ErrorKind.NotFound => TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: error.Title),
        ErrorKind.Forbidden => TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: error.Title),
        ErrorKind.Conflict => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: error.Title),
        _ => TypedResults.Problem(statusCode: StatusCodes.Status500InternalServerError),
    };
}
