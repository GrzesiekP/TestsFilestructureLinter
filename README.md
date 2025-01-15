# Tests Filestructure Linter

A PowerShell script that validates and fixes test file structure in a .NET solution, ensuring test files are properly named and located in directories matching their tested classes.

## Author
Grzegorz Pawlowski (kontakt@grzegorzpawlowski.pl)

## Repository
https://github.com/GrzesiekP/TestsFilestructureLinter

## Features

- Validates test file names match their class names
- Verifies test files reference their tested classes
- Ensures test files are in correct directories matching source file structure
- Automatically fixes found issues (optional)
- Generates CSV reports of validation results
- Uses Git for file operations to maintain history
- Configurable source and test folders
- Configurable file extension support
- Only analyzes projects that end with ".Tests" (e.g. "Project.Tests")

## Requirements

- PowerShell
- Git
- .NET solution with test projects

## Installation

1. Clone the repository or copy the script to your solution's `scripts/tests` directory
2. Ensure the script has execution permissions

## Usage

```powershell
.\TestsFilestructureLinter.ps1 [options]
```

### Options

- `-SaveToCsv` (`-s`): Saves validation errors to a CSV file
- `-Fix` (`-f`): Automatically fixes found issues
- `-FixAndReport` (`-fr`): Fixes issues and saves report
- `-Help` (`-h`): Shows help message
- `-Verbose` (`-v`): Shows detailed progress
- `-SourceFolder` (`-sf`): Name of folder where source files are stored (default: "src")
- `-TestFolder` (`-tf`): Name of folder where test files are stored (default: "tests")
- `-FileExtension` (`-fe`): File extension to process (default: ".cs")

### Examples

```powershell
# Just validate
.\TestsFilestructureLinter.ps1

# Validate and save results
.\TestsFilestructureLinter.ps1 -s

# Fix issues
.\TestsFilestructureLinter.ps1 -f

# Fix and report
.\TestsFilestructureLinter.ps1 -fr

# Use custom folders and extension
.\TestsFilestructureLinter.ps1 -sf source -tf test -fe .vb

# Show help
.\TestsFilestructureLinter.ps1 -h
```

## Validation Rules

1. **File Names**
   - Test files must end with "Tests.cs"
   - File name must match the contained test class name

2. **Class References**
   - Test file must contain a reference to the class it's testing
   - Class name is derived by removing "Tests" suffix from test class name

3. **Directory Structure**
   - Test files must be in a directory structure matching their tested class
   - Example: If `src/Project/Feature/Class.cs` exists, test should be in `tests/Project.Tests/Feature/ClassTests.cs`

## Fix Operations

When run with `-Fix` or `-FixAndReport`, the script will:

1. Rename test files to match their class names
2. Move test files to correct directories
3. Create necessary directories if they don't exist
4. Use `git mv` to maintain file history

## Output

- Console output shows progress and summary
- CSV report (optional) includes:
  - Test file name
  - Test file path
  - Error description
  - Whether the error was fixed

## Notes

- The script uses Git for file operations to maintain history
- Verbose output helps diagnose issues
- CSV reports include timestamps
- Unrecognized arguments trigger help display
- If specified source or test folders do not exist in repository root directory, script will display warning and exit
