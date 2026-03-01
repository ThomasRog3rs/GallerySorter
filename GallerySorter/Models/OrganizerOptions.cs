namespace GallerySorter.Models;

public sealed record OrganizerOptions(
    string SourceDirectory,
    string OutputDirectory,
    bool DryRun,
    bool MoveFiles,
    bool Recursive);
