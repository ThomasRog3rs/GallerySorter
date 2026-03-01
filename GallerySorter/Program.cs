using GallerySorter.Models;
using GallerySorter.Services;

namespace GallerySorter;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        if (!TryParseArguments(args, out var parsed))
        {
            PrintUsage();
            return 1;
        }

        var sourcePath = new DirectoryInfo(parsed.SourcePath);
        if (!sourcePath.Exists)
        {
            Console.Error.WriteLine($"Source directory does not exist: {sourcePath.FullName}");
            return 1;
        }

        var options = new OrganizerOptions(
            sourcePath.FullName,
            parsed.OutputPath ?? sourcePath.FullName,
            parsed.DryRun,
            parsed.Move,
            parsed.Recursive);

        var metadataReader = new MetadataDateReader();
        var organizer = new FileOrganizer(metadataReader);
        var result = await organizer.OrganizeAsync(options);

        Console.WriteLine(
            $"Processed: {result.ProcessedFiles}, {result.SkippedFiles} skipped, {result.FailedFiles} failed.");
        return 0;
    }

    private static bool TryParseArguments(string[] args, out ParsedArgs parsed)
    {
        parsed = new ParsedArgs();
        if (args.Length == 0 || args.Contains("--help", StringComparer.OrdinalIgnoreCase) || args.Contains("-h"))
        {
            return false;
        }

        parsed.SourcePath = args[0];
        for (var i = 1; i < args.Length; i++)
        {
            var arg = args[i];
            switch (arg)
            {
                case "--output":
                    if (i + 1 >= args.Length)
                    {
                        Console.Error.WriteLine("Missing value for --output.");
                        return false;
                    }

                    parsed.OutputPath = args[++i];
                    break;
                case "--dry-run":
                    parsed.DryRun = true;
                    break;
                case "--move":
                    parsed.Move = true;
                    break;
                case "--recursive":
                    parsed.Recursive = true;
                    break;
                default:
                    Console.Error.WriteLine($"Unknown option: {arg}");
                    return false;
            }
        }

        return true;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("Usage: GallerySorter <source-path> [options]");
        Console.WriteLine();
        Console.WriteLine("Options:");
        Console.WriteLine("  --output <path>  Output base directory (default: source)");
        Console.WriteLine("  --dry-run        Preview operations without file changes");
        Console.WriteLine("  --move           Move files instead of copying");
        Console.WriteLine("  --recursive      Include subdirectories");
        Console.WriteLine("  -h, --help       Show usage");
    }

    private sealed class ParsedArgs
    {
        public string SourcePath { get; set; } = string.Empty;
        public string? OutputPath { get; set; }
        public bool DryRun { get; set; }
        public bool Move { get; set; }
        public bool Recursive { get; set; }
    }
}
