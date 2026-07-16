var builder = WebApplication.CreateBuilder(args);

// Allow the SPA (Vite dev server) to call the gateway cross-origin.
// Origins are configurable via "Cors:AllowedOrigins" in appsettings.json.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://localhost:5174" };

const string CorsPolicy = "SpaCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

// Applying a named policy here runs CORS for every request flowing through the
// gateway (including preflight), which is what the reverse-proxied APIs need.
app.UseCors(CorsPolicy);

app.MapReverseProxy();

app.Run();
