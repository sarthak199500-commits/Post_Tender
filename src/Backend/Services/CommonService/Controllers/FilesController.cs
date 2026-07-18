using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using System;
using System.IO;
using System.Threading.Tasks;

namespace CommonService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public FilesController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private string UploadsDir => Path.Combine(_env.ContentRootPath, "UploadedFiles");

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        Directory.CreateDirectory(UploadsDir);

        // Store under a unique, filesystem-safe name; keep the original name for display.
        var storedName = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        var fullPath = Path.Combine(UploadsDir, storedName);

        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new { url = $"/api/files/{storedName}", name = file.FileName });
    }

    // Requires authentication (inherits the class-level [Authorize]) — these are confidential
    // contract/agreement/bill documents and must not be world-readable by anyone with the URL.
    // Callers must fetch with the bearer token and open the response as a blob rather than a
    // plain <a target="_blank"> navigation (which cannot attach the token).
    [HttpGet("{name}")]
    public IActionResult Download(string name)
    {
        // Guard against path traversal — only a bare file name is accepted.
        if (string.IsNullOrWhiteSpace(name) || name.Contains("..") ||
            name.Contains('/') || name.Contains('\\'))
            return BadRequest("Invalid file name.");

        var fullPath = Path.Combine(UploadsDir, name);
        if (!System.IO.File.Exists(fullPath))
            return NotFound();

        if (!new FileExtensionContentTypeProvider().TryGetContentType(name, out var contentType))
            contentType = "application/octet-stream";

        return PhysicalFile(fullPath, contentType);
    }

    // Deletes a stored file. The frontend passes the public url (e.g. /api/files/{stored}),
    // so accept either that form or a bare name. Guard hard against path traversal: reject
    // anything with ".." or a rooted path, and confirm the resolved path stays inside the
    // uploads directory before deleting.
    [HttpDelete]
    public IActionResult Delete([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest("url is required.");

        // Reject anything that even looks like traversal on the raw input, before reducing
        // it to a file name.
        if (url.Contains(".."))
            return BadRequest("Invalid file reference.");

        var name = url.Split('/')[^1];   // /api/files/{stored} -> {stored}

        if (name.Contains("..") || name.Contains('/') || name.Contains('\\') ||
            Path.IsPathRooted(name))
            return BadRequest("Invalid file reference.");

        var uploads = Path.GetFullPath(UploadsDir);
        var fullPath = Path.GetFullPath(Path.Combine(uploads, name));

        // Defence in depth: the resolved path must live under the uploads directory.
        if (!fullPath.StartsWith(uploads + Path.DirectorySeparatorChar, StringComparison.Ordinal) &&
            !fullPath.StartsWith(uploads, StringComparison.Ordinal))
            return BadRequest("Invalid file reference.");

        if (System.IO.File.Exists(fullPath))
            System.IO.File.Delete(fullPath);

        return Ok(new { message = "File removed" });
    }
}
