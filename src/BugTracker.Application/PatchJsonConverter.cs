using System.Text.Json;
using System.Text.Json.Serialization;
using BugTracker.Application.Tickets;

namespace BugTracker.Application;

/// <summary>Reads <see cref="Optional{T}"/> request properties: present in the JSON means HasValue, absent means unchanged.</summary>
public sealed class PatchJsonConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) =>
        typeToConvert.IsGenericType && typeToConvert.GetGenericTypeDefinition() == typeof(Patch<>);

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var valueType = typeToConvert.GetGenericArguments()[0];
        return (JsonConverter)Activator.CreateInstance(typeof(PatchConverter<>).MakeGenericType(valueType))!;
    }

    private sealed class PatchConverter<T> : JsonConverter<Patch<T>>
    {
        // Lets "null" reach Read, so { "dueDate": null } means "clear it".
        public override bool HandleNull => true;

        public override Patch<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            new(JsonSerializer.Deserialize<T>(ref reader, options)!);

        public override void Write(Utf8JsonWriter writer, Patch<T> value, JsonSerializerOptions options) =>
            JsonSerializer.Serialize(writer, value.Value, options);
    }
}
