namespace GallerySorter.Services;

public interface IMetadataDateReader
{
    DateTime? TryReadDateTakenUtc(string filePath);
}
