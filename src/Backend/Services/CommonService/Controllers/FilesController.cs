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
}
