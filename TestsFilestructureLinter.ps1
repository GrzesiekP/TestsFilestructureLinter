[CmdletBinding(SupportsShouldProcess = $true)]
param (
    [Parameter()]
    [Alias('s')]
    [switch]$SaveToCsv,

    [Parameter()]
    [Alias('f')]
    [switch]$Fix,

    [Parameter()]
    [Alias('fr')]
    [switch]$FixAndReport,

    [Parameter()]
    [Alias('h')]
    [switch]$Help,

    [Parameter()]
    [Alias('sf')]
    [string]$SourceFolder = "src",

    [Parameter()]
    [Alias('tf')]
    [string]$TestFolder = "tests",

    [Parameter()]
    [Alias('fe')]
    [string]$FileExtension = ".cs"
)

function Show-Help {
    $helpText = @"
TestsFilestructureLinter.ps1
Version: 1.0
Author: Grzegorz Pawlowski (kontakt@grzegorzpawlowski.pl)
Repository: https://github.com/GrzesiekP/TestsFilestructureLinter

DESCRIPTION
    Validates and fixes test file structure in a .NET solution, ensuring test files
    are properly named and located in directories matching their tested classes.

SYNTAX
    TestsFilestructureLinter.ps1 [-SaveToCsv] [-Fix] [-FixAndReport] [-Help] [-Verbose]
        [-SourceFolder <string>] [-TestFolder <string>] [-FileExtension <string>]

PARAMETERS
    -SaveToCsv (-s)
        Saves validation errors to a CSV file in ValidationResults directory.

    -Fix (-f)
        Automatically fixes found issues:
        - Renames test files to match their class names
        - Moves test files to correct directories matching source file structure

    -FixAndReport (-fr)
        Combines -Fix and -SaveToCsv, additionally marking which errors were fixed.

    -Help (-h)
        Shows this help message.

    -SourceFolder (-sf)
        Name of folder where source files are stored.
        Default: "src"

    -TestFolder (-tf)
        Name of folder where test files are stored.
        Default: "tests"

    -FileExtension (-fe)
        File extension to process.
        Default: ".cs"

    -Verbose (-v)
        Shows detailed progress and error messages.

EXAMPLES
    # Just validate and show results
    .\ValidateTestsFilestructure.ps1

    # Validate and save results to CSV
    .\ValidateTestsFilestructure.ps1 -s

    # Validate and fix issues
    .\ValidateTestsFilestructure.ps1 -f

    # Validate, fix, and save report
    .\ValidateTestsFilestructure.ps1 -fr

    # Use custom folders and extension
    .\ValidateTestsFilestructure.ps1 -sf source -tf test -fe .vb

    # Show verbose output
    .\ValidateTestsFilestructure.ps1 -v
"@

    Write-Host $helpText
    exit 0
}

# Show help if -Help is specified or if any unrecognized arguments are passed
if ($Help -or $args.Count -gt 0) {
    Show-Help
}

# Function to safely execute git commands
function Invoke-GitCommand {
    param (
        [string]$Command,
        [string[]]$Arguments
    )

    try {
        # Convert Windows paths to Git-friendly format and quote them
        $Arguments = $Arguments | ForEach-Object {
            # Normalize path separators and remove any potential double slashes
            $path = $_ -replace '\\', '/' -replace '/+', '/'
            # Remove any 'n/' that might appear in the path
            $path = $path -replace '/n/', '/'
            $path
        }

        # Join arguments with proper quoting for the shell
        $quotedArgs = $Arguments | ForEach-Object { "'$_'" }
        Write-Verbose "Executing: git $Command $($quotedArgs -join ' ')"

        # Execute git command with arguments as separate items
        $output = & git $Command $Arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            $errorMessage = $output -join "`n"
            Write-Error "Git command failed: git $Command $($quotedArgs -join ' ')`nError: $errorMessage"
            return $false
        }
        return $true
    }
    catch {
        Write-Error "Failed to execute git command: $_"
        return $false
    }
}

# Function to ensure directory exists
function Ensure-GitDirectory {
    param (
        [string]$DirectoryPath
    )

    if (-not (Test-Path $DirectoryPath)) {
        # Create directory
        New-Item -ItemType Directory -Path $DirectoryPath -Force | Out-Null
    }
}

# Verify git is available
try {
    $null = git --version
}
catch {
    Write-Error "Git is not available. Please ensure Git is installed and accessible."
    exit 1
}

# Get the repository root path (assuming script is in scripts/tests directory)
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

# Verify source folder exists
$srcPath = Join-Path $repoRoot $SourceFolder
if (-not (Test-Path $srcPath)) {
    Write-Warning "Source folder '$SourceFolder' does not exist in repository root directory. Please verify the path and try again."
    exit 1
}

# Verify test folder exists
$testsPath = Join-Path $repoRoot $TestFolder
if (-not (Test-Path $testsPath)) {
    Write-Warning "Test folder '$TestFolder' does not exist in repository root directory. Please verify the path and try again."
    exit 1
}

Write-Host "`n🔍 " -NoNewline
Write-Host "Test Structure Validator" -ForegroundColor Cyan
Write-Host "Analyzing tests in: " -NoNewline
Write-Host "$testsPath" -ForegroundColor Yellow

# Start timing
$startTime = Get-Date

# Get all test files recursively from test directory, excluding non-test projects
$testFiles = Get-ChildItem -Path $testsPath -Directory |
    Where-Object { $_.Name.EndsWith(".Tests") } |
    ForEach-Object {
        Get-ChildItem -Path $_.FullName -Recurse -Filter "*$FileExtension"
    }

$totalFiles = ($testFiles | Where-Object { $_.Name.EndsWith("Tests$FileExtension") }).Count
Write-Host "`nFound " -NoNewline
Write-Host "$totalFiles" -ForegroundColor Green -NoNewline
Write-Host " test files to analyze`n"

$validatedFiles = 0
$fixedFiles = 0
$hasErrors = $false
$errors = @()
$currentFile = 0

foreach ($testFile in $testFiles) {
    # Skip files that don't end with "Tests.cs"
    if (-not $testFile.Name.EndsWith("Tests$FileExtension")) {
        continue
    }

    $currentFile++
    $percentComplete = [math]::Round(($currentFile / $totalFiles) * 100)

    # Create progress bar
    Write-Progress -Activity "Validating Test Files" -Status "$currentFile of $totalFiles files ($percentComplete%)" `
        -PercentComplete $percentComplete -CurrentOperation "Analyzing $($testFile.Name)"

    $fileHasError = $false
    $content = Get-Content $testFile.FullName -Raw
    $testFileName = $testFile.Name
    $testedClassName = $testFileName -replace "Tests$FileExtension$", ""
    $wasFixed = $false

    # Check 1: Verify if file name matches class name
    if (-not ($content -match "public\s+class\s+$testFileName" -replace "$FileExtension$", "")) {
        $errorMessage = "File name does not match class name"
        Write-Verbose "❌ Error in $($testFile.Name): $errorMessage"

        # Try to find actual class name
        if ($content -match "public\s+class\s+(\w+Tests)") {
            $actualClassName = $matches[1]
            if (($Fix -or $FixAndReport) -and $PSCmdlet.ShouldProcess($testFile.FullName, "Rename file to match class name '$actualClassName'")) {
                $newName = "$actualClassName$FileExtension"
                $newPath = Join-Path $testFile.Directory.FullName $newName
                $sourcePath = $testFile.FullName -replace '\\', '/'
                $targetPath = $newPath -replace '\\', '/'
                if (Invoke-GitCommand "mv" @($sourcePath, $targetPath)) {
                    Write-Verbose "✅ Fixed: Renamed file to $actualClassName$FileExtension"
                    $wasFixed = $true
                    $fixedFiles++
                }
                else {
                    Write-Warning "Failed to rename file using git mv"
                }
            }
        }

        $errors += [PSCustomObject]@{
            TestFileName = $testFileName
            TestFilePath = $testFile.FullName
            Error = $errorMessage
            Fixed = $wasFixed
        }
        $fileHasError = $true
        $hasErrors = $true
    }

    # Check 2: Verify if tested class name is present in file
    if (-not ($content -match $testedClassName -replace "Tests$", "")) {
        $errorMessage = "Could not find reference to tested class '$($testedClassName -replace 'Tests$', '')'"
        Write-Verbose "❌ Error in $($testFile.Name): $errorMessage"
        $errors += [PSCustomObject]@{
            TestFileName = $testFileName
            TestFilePath = $testFile.FullName
            Error = $errorMessage
            Fixed = $false # This error type cannot be automatically fixed
        }
        $fileHasError = $true
        $hasErrors = $true
    }

    # Check 3: Verify directory structure
    # Extract test project path and name based on the pattern: RepositoryRootPath/tests/TestProject
    $pathParts = $testFile.FullName -split "\\$TestFolder\\"
    if ($pathParts.Length -eq 2) {
        $testProjectName = $pathParts[1].Split('\')[0]  # First folder after 'tests'
        $testProjectPath = Join-Path $testsPath $testProjectName
        $mainProjectName = $testProjectName -replace "\.Tests$", ""

        # Get relative path within test project and remove leading backslash if present
        $relativePathInTestProject = $testFile.Directory.FullName.Substring($testProjectPath.Length).TrimStart('\')

        # Construct expected path for tested file
        $expectedTestedFilePath = Join-Path $repoRoot $SourceFolder $mainProjectName $relativePathInTestProject "$($testedClassName -replace 'Tests$', '')$FileExtension"

        if (-not (Test-Path $expectedTestedFilePath)) {
            $wasFixed = $false
            $errorMessage = "Could not find tested file at expected location: $expectedTestedFilePath"
            Write-Verbose "❌ Error in $($testFile.Name): $errorMessage"
            Write-Verbose "  Expected path: $expectedTestedFilePath"

            # Try to find the file recursively in src
            if ($Fix -or $FixAndReport) {
                $sourceFileName = "$($testedClassName -replace 'Tests$', '').cs"
                $foundFiles = Get-ChildItem -Path $srcPath -Recurse -Filter $sourceFileName

                if ($foundFiles.Count -eq 1) {
                    # Split source file path to get project name and relative path
                    $sourceParts = $foundFiles[0].FullName -split "\\src\\"
                    if ($sourceParts.Length -eq 2) {
                        # Get project name (first directory after src)
                        $sourceProjectPath = $sourceParts[1].Split('\')[0]
                        $correctTestProjectPath = Join-Path $testsPath "$sourceProjectPath.Tests"

                        # Get relative path from project root to file
                        $sourceFullProjectPath = Join-Path $srcPath $sourceProjectPath
                        $relativeSourcePath = $foundFiles[0].Directory.FullName.Substring($sourceFullProjectPath.Length).TrimStart('\')

                        # Construct the correct test file path
                        $correctTestPath = Join-Path $correctTestProjectPath $relativeSourcePath $testFile.Name

                        # Verify paths before moving
                        Write-Verbose "Source path: $($testFile.FullName)"
                        Write-Verbose "Target path: $correctTestPath"

                        if ($PSCmdlet.ShouldProcess($testFile.FullName, "Move test file to match source file structure at $correctTestPath")) {
                            # Create directory and ensure it's tracked in git
                            $targetDir = Split-Path $correctTestPath -Parent
                            if (-not [string]::IsNullOrWhiteSpace($targetDir)) {
                                Ensure-GitDirectory $targetDir
                            }

                            # Move the test file using git mv
                            if (Test-Path $correctTestPath) {
                                Write-Warning "Target path already exists: $correctTestPath"
                            }
                            else {
                                if (Invoke-GitCommand "mv" @($testFile.FullName, $correctTestPath)) {
                                    Write-Verbose "✅ Fixed: Moved test file to match source file structure"
                                    $wasFixed = $true
                                    $fixedFiles++
                                }
                                else {
                                    Write-Warning "Failed to move file using git mv. Source: $($testFile.FullName), Target: $correctTestPath"
                                }
                            }
                        }
                    }
                }
            }

            $errors += [PSCustomObject]@{
                TestFileName = $testFileName
                TestFilePath = $testFile.FullName
                Error = $errorMessage
                Fixed = $wasFixed
            }
            $fileHasError = $true
            $hasErrors = $true
        }
    }

    if (-not $fileHasError) {
        $validatedFiles++
    }
}

# Clear progress bar
Write-Progress -Activity "Validating Test Files" -Completed

# Calculate elapsed time
$endTime = Get-Date
$duration = $endTime - $startTime
$formattedDuration = "{0:mm}:{0:ss}.{0:fff}" -f $duration

# Display summary
Write-Host "`n📊 " -NoNewline
Write-Host "Validation Summary" -ForegroundColor Cyan
Write-Host "Time elapsed: " -NoNewline
Write-Host "$formattedDuration" -ForegroundColor Yellow
Write-Host "Total files analyzed: " -NoNewline
Write-Host "$totalFiles" -ForegroundColor Green
Write-Host "Files passing validation: " -NoNewline
Write-Host "$validatedFiles" -ForegroundColor Green
Write-Host "Files with errors: " -NoNewline
Write-Host "$($errors.Count)" -ForegroundColor $(if ($errors.Count -gt 0) { "Red" } else { "Green" })
if ($Fix -or $FixAndReport) {
    Write-Host "Files fixed: " -NoNewline
    Write-Host "$fixedFiles" -ForegroundColor $(if ($fixedFiles -gt 0) { "Green" } else { "Yellow" })
}

if (-not $hasErrors) {
    Write-Host "`n✅ " -NoNewline
    Write-Host "Validation completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  " -NoNewline
    Write-Host "Validation completed with errors." -ForegroundColor Yellow
    Write-Host "Run with -Verbose to see detailed error messages." -ForegroundColor DarkYellow
}

if (($SaveToCsv -or $FixAndReport) -and $errors.Count -gt 0) {
    # Create ValidationResults directory if it doesn't exist
    $resultsDir = Join-Path $PSScriptRoot "ValidationResults"
    if (-not (Test-Path $resultsDir)) {
        New-Item -ItemType Directory -Path $resultsDir | Out-Null
    }

    # Generate timestamp and filename
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $csvFileName = "ValidateTestsFilestructure_results_$timestamp.csv"
    $csvPath = Join-Path $resultsDir $csvFileName

    $errors | Export-Csv -Path $csvPath -NoTypeInformation
    Write-Host "`n💾 " -NoNewline
    Write-Host "Validation errors have been saved to: " -ForegroundColor Blue -NoNewline
    Write-Host "$csvPath" -ForegroundColor Yellow
}
