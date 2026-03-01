using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using System.Globalization;
using MetadataDirectory = MetadataExtractor.Directory;

namespace GallerySorter.Services;

public sealed class MetadataDateReader : IMetadataDateReader
{
    private static readonly string[] PreferredDateTagNames =
    [
        "Date/Time Original",
        "Create Date",
        "Creation Date",
        "Date/Time"
    ];

    private static readonly string[] SupportedDateFormats =
    [
        "yyyy:MM:dd HH:mm:ss",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-ddTHH:mm:ss",
        "yyyy-MM-ddTHH:mm:ssZ",
        "yyyy-MM-ddTHH:mm:sszzz"
    ];

    public DateTime? TryReadDateTakenUtc(string filePath)
    {
        try
        {
            var directories = ImageMetadataReader.ReadMetadata(filePath).ToList();
            var exifDate = TryReadExifDate(directories);
            if (exifDate.HasValue)
            {
                return DateTime.SpecifyKind(exifDate.Value, DateTimeKind.Local).ToUniversalTime();
            }

            var genericDate = TryReadFromDirectoryTags(directories);
            if (genericDate.HasValue)
            {
                return DateTime.SpecifyKind(genericDate.Value, DateTimeKind.Local).ToUniversalTime();
            }
        }
        catch
        {
            // Metadata parsing can fail for unsupported or malformed files.
        }

        return null;
    }

    private static DateTime? TryReadExifDate(IEnumerable<MetadataDirectory> directories)
    {
        var exif = directories.OfType<ExifSubIfdDirectory>().FirstOrDefault();
        if (exif is null)
        {
            return null;
        }

        var value = exif.GetDescription(ExifDirectoryBase.TagDateTimeOriginal)
            ?? exif.GetDescription(ExifDirectoryBase.TagDateTimeDigitized)
            ?? exif.GetDescription(ExifDirectoryBase.TagDateTime);

        return TryParseDate(value);
    }

    private static DateTime? TryReadFromDirectoryTags(IEnumerable<MetadataDirectory> directories)
    {
        foreach (var tagName in PreferredDateTagNames)
        {
            var tag = directories
                .SelectMany(directory => directory.Tags)
                .FirstOrDefault(t => string.Equals(t.Name, tagName, StringComparison.OrdinalIgnoreCase));

            if (tag is null)
            {
                continue;
            }

            var parsed = TryParseDate(tag.Description);
            if (parsed.HasValue)
            {
                return parsed;
            }
        }

        return null;
    }

    private static DateTime? TryParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateTime.TryParseExact(
            value,
            SupportedDateFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal,
            out var parsedExact))
        {
            return parsedExact;
        }

        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsedAny)
            ? parsedAny
            : null;
    }
}
