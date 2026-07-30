# --no-launch-profile ignores launchSettings.json, so ASPNETCORE_ENVIRONMENT would
# otherwise default to Production. The services read their dev Jwt:Key from
# appsettings.Development.json and fail fast when it is absent, so without this every
# service exits on startup with "Jwt:Key is missing or shorter than 32 characters"
# and only the Gateway (which has no auth of its own) stays up.
$env:ASPNETCORE_ENVIRONMENT = "Development"

$jobs = @()

$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\IdentityService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5001 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\VendorService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5002 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\TenderService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5003 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\ExecutionService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5004 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\InspectionService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5005 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\FinancialService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5006 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\CommonService; dotnet run --environment Development --no-launch-profile --urls http://localhost:5007 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\PostTenderSystem.Gateway; dotnet run --environment Development --no-launch-profile --urls http://localhost:5249 } -ArgumentList $PWD

$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Frontend; npm run dev -- --host --port 5174 } -ArgumentList $PWD

Wait-Job $jobs
