$ErrorActionPreference = 'Stop'
Write-Host "Starting all Microservices, Gateway, and Frontend using Start-Process..."

# --no-launch-profile ignores launchSettings.json, so ASPNETCORE_ENVIRONMENT would
# otherwise default to Production. The services read their dev Jwt:Key from
# appsettings.Development.json and fail fast when it is absent, so without this every
# service exits on startup with "Jwt:Key is missing or shorter than 32 characters"
# and only the Gateway (which has no auth of its own) stays up.
# Child processes inherit this from the current session.
$env:ASPNETCORE_ENVIRONMENT = "Development"

$services = @(
    @{ Name = "IdentityService"; Path = "src\Backend\Services\IdentityService"; Port = 5001 }
    @{ Name = "VendorService"; Path = "src\Backend\Services\VendorService"; Port = 5002 }
    @{ Name = "TenderService"; Path = "src\Backend\Services\TenderService"; Port = 5003 }
    @{ Name = "ExecutionService"; Path = "src\Backend\Services\ExecutionService"; Port = 5004 }
    @{ Name = "InspectionService"; Path = "src\Backend\Services\InspectionService"; Port = 5005 }
    @{ Name = "FinancialService"; Path = "src\Backend\Services\FinancialService"; Port = 5006 }
    @{ Name = "CommonService"; Path = "src\Backend\Services\CommonService"; Port = 5007 }
    @{ Name = "Gateway"; Path = "src\Backend\PostTenderSystem.Gateway"; Port = 5249 }
)

foreach ($service in $services) {
    Write-Host "Starting $($service.Name) on Port $($service.Port)..."
    Start-Process -FilePath "dotnet" -ArgumentList "run","--environment","Development","--no-launch-profile","--urls","http://localhost:$($service.Port)" -WorkingDirectory (Join-Path $PWD $service.Path) -WindowStyle Hidden
}

Write-Host "Starting Frontend (Vite) on Port 5174..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","--host","--port","5174" -WorkingDirectory (Join-Path $PWD "src\Frontend") -WindowStyle Hidden

Write-Host "All processes have been started!"
Write-Host "Gateway running on: http://localhost:5249"
Write-Host "Frontend running on: http://localhost:5174"
