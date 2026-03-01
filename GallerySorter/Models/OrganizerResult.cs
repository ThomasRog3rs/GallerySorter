namespace GallerySorter.Models;

public sealed record OrganizerResult(
    int ProcessedFiles,
    int SkippedFiles,
    int FailedFiles);
