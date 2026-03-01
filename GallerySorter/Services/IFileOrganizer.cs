using GallerySorter.Models;

namespace GallerySorter.Services;

public interface IFileOrganizer
{
    Task<OrganizerResult> OrganizeAsync(OrganizerOptions options);
}
