using System.CommandLine;
using Microsoft.Extensions.Configuration;
using GallerySorter.Models;
using GallerySorter.Services;

namespace GallerySorter;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var defaultSource = config["GallerySorter:SourcePath"];
        var defaultOutput = config["GallerySorter:OutputPath"];

        var sourceOption = new Option<DirectoryInfo?>("--source")
        {
            Description = "Source directory containing files to organize."
        };

        var outputOption = new Option<DirectoryInfo?>("--output")
        {
            Description = "Output base directory (default: from config)."
        };

        var dryRunOption = new Option<bool>("--dry-run")
        {
            Description = "Preview operations without file changes."
        };
        var moveOption = new Option<bool>("--move")
        {
            Description = "Move files instead of copying."
        };
        var recursiveOption = new Option<bool>("--recursive")
        {
            Description = "Include subdirectories."
        };

        var rootCommand = new RootCommand("Sort media files into year/month folders.");
        rootCommand.Add(sourceOption);
        rootCommand.Add(outputOption);
        rootCommand.Add(dryRunOption);
        rootCommand.Add(moveOption);
        rootCommand.Add(recursiveOption);

        rootCommand.SetAction(async parseResult =>
        {
            var sourcePath = parseResult.GetValue(sourceOption);
            var outputPath = parseResult.GetValue(outputOption);
            var dryRun = parseResult.GetValue(dryRunOption);
            var move = parseResult.GetValue(moveOption);
            var recursive = parseResult.GetValue(recursiveOption);

            sourcePath ??= !string.IsNullOrEmpty(defaultSource) ? new DirectoryInfo(defaultSource) : null;
            outputPath ??= !string.IsNullOrEmpty(defaultOutput) ? new DirectoryInfo(defaultOutput) : null;

            if (sourcePath == null)
            {
                Console.Error.WriteLine("Source directory is required. Set GallerySorter:SourcePath in appsettings.json or pass --source.");
                return 1;
            }

            return await RunAsync(sourcePath, outputPath, dryRun, move, recursive);
        });

        var invocationArgs = new string[args.Length + 1];
        invocationArgs[0] = RootCommand.ExecutableName;
        Array.Copy(args, 0, invocationArgs, 1, args.Length);

        return await rootCommand.Parse(invocationArgs).InvokeAsync();
    }

    private static async Task<int> RunAsync(
        DirectoryInfo sourcePath,
        DirectoryInfo? outputPath,
        bool dryRun,
        bool move,
        bool recursive)
    {
        if (!sourcePath.Exists)
        {
            Console.Error.WriteLine($"Source directory does not exist: {sourcePath.FullName}");
            return 1;
        }

        var options = new OrganizerOptions(
            sourcePath.FullName,
            outputPath?.FullName ?? sourcePath.FullName,
            dryRun,
            move,
            recursive);

        var metadataReader = new MetadataDateReader();
        var organizer = new FileOrganizer(metadataReader);
        var result = await organizer.OrganizeAsync(options);

        Console.WriteLine(
            $"Processed: {result.ProcessedFiles}, {result.SkippedFiles} skipped, {result.FailedFiles} failed.");
        return 0;
    }
}
