$jobs = @()

$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\IdentityService; dotnet run --no-launch-profile --urls http://localhost:5001 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\VendorService; dotnet run --no-launch-profile --urls http://localhost:5002 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\TenderService; dotnet run --no-launch-profile --urls http://localhost:5003 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\ExecutionService; dotnet run --no-launch-profile --urls http://localhost:5004 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\InspectionService; dotnet run --no-launch-profile --urls http://localhost:5005 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\FinancialService; dotnet run --no-launch-profile --urls http://localhost:5006 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\Services\CommonService; dotnet run --no-launch-profile --urls http://localhost:5007 } -ArgumentList $PWD
$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Backend\PostTenderSystem.Gateway; dotnet run --no-launch-profile --urls http://localhost:5249 } -ArgumentList $PWD

$jobs += Start-Job -ScriptBlock { cd $args[0]; cd src\Frontend; npm run dev -- --host --port 5174 } -ArgumentList $PWD

Wait-Job $jobs
