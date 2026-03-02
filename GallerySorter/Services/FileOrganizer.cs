using GallerySorter.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Png;
using System.Globalization;
using System.Text.RegularExpressions;
using HeyRed.ImageSharp.Heif.Formats.Heif;

namespace GallerySorter.Services;

public sealed class FileOrganizer(IMetadataDateReader metadataDateReader) : IFileOrganizer
{
    private static readonly Regex[] FileNameDatePatterns =
    [
        new(@"\b(?<y>\d{4})(?<m>\d{2})(?<d>\d{2})\b", RegexOptions.Compiled),
        new(@"\b(?<y>\d{4})[-_.](?<m>\d{2})[-_.](?<d>\d{2})\b", RegexOptions.Compiled),
        new(@"\b(?<d>\d{2})[-_.](?<m>\d{2})[-_.](?<y>\d{4})\b", RegexOptions.Compiled)
    ];

    private static readonly HashSet<string> HeicLikeExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".heic",
        ".heif",
        ".heics",
        ".heifs",
        ".hif"
    };

    private static readonly DecoderOptions HeicDecoderOptions = new DecoderOptions
    {
        Configuration = new Configuration(new HeifConfigurationModule())
    };

    public Task<OrganizerResult> OrganizeAsync(OrganizerOptions options)
    {
        var sourceFullPath = Path.GetFullPath(options.SourceDirectory);
        var outputFullPath = Path.GetFullPath(options.OutputDirectory);

        var searchOption = options.Recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        var files = Directory.EnumerateFiles(sourceFullPath, "*", searchOption).ToList();
        var totalFiles = files.Count;
        Console.WriteLine($"[info] Found {totalFiles} file(s) to evaluate.");

        var processed = 0;
        var skipped = 0;
        var failed = 0;
        var index = 0;

        foreach (var filePath in files)
        {
            index++;
            Console.WriteLine($"[info] [{index}/{totalFiles}] Working on: {filePath}");

            try
            {
                if (ShouldSkipFile(filePath, sourceFullPath, outputFullPath, options.Recursive))
                {
                    Console.WriteLine($"[skip] [{index}/{totalFiles}] Inside output scope, skipping.");
                    skipped++;
                    continue;
                }

                var bestDate = ResolveBestDateUtc(filePath);

                if (!bestDate.HasValue)
                {
                    Console.WriteLine($"[skip] [{index}/{totalFiles}] Unable to determine date for: {filePath}");
                    skipped++;
                    continue;
                }

                var localDate = bestDate.Value.ToLocalTime();
                var destinationDirectory = Path.Combine(
                    outputFullPath,
                    localDate.Year.ToString("0000"),
                    localDate.Month.ToString("00"));

                var shouldConvertToPng = ShouldConvertToPng(filePath);
                var destinationPath = ResolveDestinationPath(destinationDirectory, filePath, shouldConvertToPng);
                if (IsSamePath(filePath, destinationPath))
                {
                    Console.WriteLine($"[skip] [{index}/{totalFiles}] Source and destination are the same path.");
                    skipped++;
                    continue;
                }

                if (options.DryRun)
                {
                    var action = shouldConvertToPng
                        ? (options.MoveFiles ? "convert+move" : "convert+copy")
                        : (options.MoveFiles ? "move" : "copy");
                    Console.WriteLine($"[dry-run] [{index}/{totalFiles}] {action} '{filePath}' -> '{destinationPath}'");
                    processed++;
                    continue;
                }

                Directory.CreateDirectory(destinationDirectory);

                if (shouldConvertToPng)
                {
                    ConvertToPng(filePath, destinationPath);
                    if (options.MoveFiles)
                    {
                        File.Delete(filePath);
                    }
                }
                else if (options.MoveFiles)
                {
                    File.Move(filePath, destinationPath);
                }
                else
                {
                    File.Copy(filePath, destinationPath);
                }

                var completedAction = shouldConvertToPng
                    ? (options.MoveFiles ? "converted+moved" : "converted+copied")
                    : (options.MoveFiles ? "moved" : "copied");
                Console.WriteLine($"[ok] [{index}/{totalFiles}] {completedAction} '{filePath}' -> '{destinationPath}'");
                processed++;
            }
            catch (Exception ex) when (ex is IOException
                                       or UnauthorizedAccessException
                                       or UnknownImageFormatException
                                       or InvalidImageContentException
                                       or NotSupportedException)
            {
                Console.Error.WriteLine($"[error] [{index}/{totalFiles}] {filePath}: {ex.Message}");
                failed++;
            }
        }

        return Task.FromResult(new OrganizerResult(processed, skipped, failed));
    }

    private DateTime? ResolveBestDateUtc(string filePath)
    {
        var fileNameDate = TryParseDateFromFileNameUtc(filePath);
        if (fileNameDate.HasValue)
        {
            return fileNameDate;
        }

        var candidateDates = new List<DateTime>();

        var metadataDate = metadataDateReader.TryReadDateTakenUtc(filePath);
        if (IsReasonableDate(metadataDate))
        {
            candidateDates.Add(metadataDate!.Value);
        }

        var fileSystemDates = TryGetFileSystemDates(filePath);
        foreach (var date in fileSystemDates)
        {
            if (IsReasonableDate(date))
            {
                candidateDates.Add(date);
            }
        }

        return candidateDates.Count == 0 ? null : candidateDates.Min();
    }

    private static DateTime? TryParseDateFromFileNameUtc(string filePath)
    {
        var fileName = Path.GetFileNameWithoutExtension(filePath);
        foreach (var pattern in FileNameDatePatterns)
        {
            var match = pattern.Match(fileName);
            if (!match.Success)
            {
                continue;
            }

            if (!int.TryParse(match.Groups["y"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var year) ||
                !int.TryParse(match.Groups["m"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var month) ||
                !int.TryParse(match.Groups["d"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var day))
            {
                continue;
            }

            if (!DateTime.TryParseExact(
                    $"{year:0000}-{month:00}-{day:00}",
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeLocal,
                    out var localDate))
            {
                continue;
            }

            var utc = DateTime.SpecifyKind(localDate, DateTimeKind.Local).ToUniversalTime();
            if (IsReasonableDate(utc))
            {
                return utc;
            }
        }

        return null;
    }

    private static List<DateTime> TryGetFileSystemDates(string filePath)
    {
        var results = new List<DateTime>();

        try
        {
            var creation = File.GetCreationTimeUtc(filePath);
            if (creation > DateTime.UnixEpoch)
            {
                results.Add(creation);
            }
        }
        catch
        {
            // Ignore unavailable creation time.
        }

        try
        {
            var lastWrite = File.GetLastWriteTimeUtc(filePath);
            if (lastWrite > DateTime.UnixEpoch)
            {
                results.Add(lastWrite);
            }
        }
        catch
        {
            // Ignore unavailable last write time.
        }

        return results;
    }

    private static bool IsReasonableDate(DateTime? value)
    {
        if (!value.HasValue)
        {
            return false;
        }

        var utc = value.Value.Kind == DateTimeKind.Utc
            ? value.Value
            : value.Value.ToUniversalTime();

        return utc > DateTime.UnixEpoch && utc <= DateTime.UtcNow.AddDays(1);
    }

    private static bool ShouldSkipFile(string filePath, string sourceFullPath, string outputFullPath, bool recursive)
    {
        if (!recursive)
        {
            return false;
        }

        if (string.Equals(sourceFullPath, outputFullPath, StringComparison.OrdinalIgnoreCase))
        {
            var relativePath = Path.GetRelativePath(sourceFullPath, filePath);
            var segmentCount = relativePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Length;
            return segmentCount > 1;
        }

        return filePath.StartsWith(outputFullPath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveDestinationPath(string destinationDirectory, string sourceFilePath, bool usePngExtension)
    {
        var fileName = Path.GetFileName(sourceFilePath);
        var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
        var extension = usePngExtension ? ".png" : Path.GetExtension(fileName);

        var candidate = Path.Combine(destinationDirectory, $"{fileNameWithoutExtension}{extension}");
        var suffix = 1;
        while (File.Exists(candidate))
        {
            candidate = Path.Combine(destinationDirectory, $"{fileNameWithoutExtension}_{suffix}{extension}");
            suffix++;
        }

        return candidate;
    }

    private static bool IsSamePath(string pathA, string pathB)
    {
        var fullA = Path.GetFullPath(pathA).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var fullB = Path.GetFullPath(pathB).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return string.Equals(fullA, fullB, StringComparison.OrdinalIgnoreCase);
    }

    private static bool ShouldConvertToPng(string filePath)
    {
        var extension = Path.GetExtension(filePath);
        return HeicLikeExtensions.Contains(extension);
    }

    private static void ConvertToPng(string sourceFilePath, string destinationPath)
    {
        using var image = Image.Load(HeicDecoderOptions, sourceFilePath);
        image.Save(destinationPath, new PngEncoder());
    }
}
