using GallerySorter.Models;

namespace GallerySorter.Services;

public sealed class FileOrganizer(IMetadataDateReader metadataDateReader) : IFileOrganizer
{
    public Task<OrganizerResult> OrganizeAsync(OrganizerOptions options)
    {
        var sourceFullPath = Path.GetFullPath(options.SourceDirectory);
        var outputFullPath = Path.GetFullPath(options.OutputDirectory);

        var searchOption = options.Recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        var files = Directory.EnumerateFiles(sourceFullPath, "*", searchOption);

        var processed = 0;
        var skipped = 0;
        var failed = 0;

        foreach (var filePath in files)
        {
            try
            {
                if (ShouldSkipFile(filePath, sourceFullPath, outputFullPath, options.Recursive))
                {
                    skipped++;
                    continue;
                }

                var bestDate = metadataDateReader.TryReadDateTakenUtc(filePath)
                    ?? TryGetFileSystemDate(filePath);

                if (!bestDate.HasValue)
                {
                    Console.WriteLine($"[skip] Unable to determine date for: {filePath}");
                    skipped++;
                    continue;
                }

                var localDate = bestDate.Value.ToLocalTime();
                var destinationDirectory = Path.Combine(
                    outputFullPath,
                    localDate.Year.ToString("0000"),
                    localDate.Month.ToString("00"));

                var destinationPath = ResolveDestinationPath(destinationDirectory, filePath);
                if (IsSamePath(filePath, destinationPath))
                {
                    skipped++;
                    continue;
                }

                if (options.DryRun)
                {
                    Console.WriteLine($"[dry-run] {(options.MoveFiles ? "move" : "copy")} '{filePath}' -> '{destinationPath}'");
                    processed++;
                    continue;
                }

                Directory.CreateDirectory(destinationDirectory);

                if (options.MoveFiles)
                {
                    File.Move(filePath, destinationPath);
                }
                else
                {
                    File.Copy(filePath, destinationPath);
                }

                processed++;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Console.Error.WriteLine($"[error] {filePath}: {ex.Message}");
                failed++;
            }
        }

        return Task.FromResult(new OrganizerResult(processed, skipped, failed));
    }

    private static DateTime? TryGetFileSystemDate(string filePath)
    {
        try
        {
            var creation = File.GetCreationTimeUtc(filePath);
            if (creation > DateTime.UnixEpoch)
            {
                return creation;
            }
        }
        catch
        {
            // Fall back to last write below.
        }

        try
        {
            var lastWrite = File.GetLastWriteTimeUtc(filePath);
            return lastWrite > DateTime.UnixEpoch ? lastWrite : null;
        }
        catch
        {
            return null;
        }
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

    private static string ResolveDestinationPath(string destinationDirectory, string sourceFilePath)
    {
        var fileName = Path.GetFileName(sourceFilePath);
        var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
        var extension = Path.GetExtension(fileName);

        var candidate = Path.Combine(destinationDirectory, fileName);
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
}
