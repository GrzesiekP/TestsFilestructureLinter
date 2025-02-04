# Test Filestructure Linter CLI

A command-line interface for analyzing and fixing test file structure in .NET solutions.

## Installation

```bash
npm install -g test-filestructure-linter
```

## Usage

```bash
test-filestructure-linter [options]
```

## Options

```
Options:
  -s, --src-root <path>           Source files root directory
  -t, --test-root <path>          Test files root directory
  -e, --file-extension <ext>      File extension to analyze (default: ".cs")
  --validate-filename             Enable filename validation
  --validate-directory            Enable directory structure validation
  --validate-missing              Enable validation of missing test files
  --test-suffix <suffix>          Test file suffix (default: "Tests")
  --test-project-suffix <suffix>  Test project suffix (default: ".Tests")
  --fix-all                       Fix all directory structure issues by moving files
  --fix <path>                    Fix a specific test file
  -i, --interactive              Interactive mode - select files to fix
  -h, --help                     Display help
  -V, --version                  Display version
```

## Examples

```bash
# Basic analysis (no validations enabled)
test-filestructure-linter -s ./src -t ./tests

# Enable specific validations
test-filestructure-linter -s ./src -t ./tests --validate-directory
test-filestructure-linter -s ./src -t ./tests --validate-filename
test-filestructure-linter -s ./src -t ./tests --validate-missing

# Enable all validations
test-filestructure-linter -s ./src -t ./tests --validate-directory --validate-filename --validate-missing

# Fix all directory structure issues
test-filestructure-linter -s ./src -t ./tests --validate-directory --fix-all

# Fix specific file
test-filestructure-linter -s ./src -t ./tests --validate-directory --fix ./tests/Wrong/Path/MyTests.cs

# Interactive mode
test-filestructure-linter -s ./src -t ./tests --validate-directory -i

# Custom file extension and suffixes
test-filestructure-linter -s ./src -t ./tests -e .vb --test-suffix Spec --test-project-suffix .Specs

# Using relative or absolute paths
test-filestructure-linter -s ../../MyProject/src -t ../../MyProject/tests
test-filestructure-linter -s C:/Projects/MyApp/src -t C:/Projects/MyApp/tests
```

## Validation Types

### File Name Validation
When enabled with `--validate-filename`, checks if:
- Test files end with the configured suffix (default: "Tests.cs")
- File names match their contained test class names

### Directory Structure Validation
When enabled with `--validate-directory`, verifies that:
- Test files are in directories matching their source file structure
- Example: If source is at `src/Project/Feature/Class.cs`, test should be at `tests/Project.Tests/Feature/ClassTests.cs`

### Missing Test Validation
When enabled with `--validate-missing`, checks for:
- Source files that don't have corresponding test files

## Fix Modes

### Fix All
```bash
--fix-all
```
- Automatically moves all test files to their correct locations
- Creates necessary directories if they don't exist

### Fix Specific File
```bash
--fix <path>
```
- Moves a single test file to its correct location
- Validates if the file can be fixed before attempting
- Reports error if fix is not possible

### Interactive Mode
```bash
-i, --interactive
```
- Displays a list of fixable files with:
  - 📄 Source file paths
  - 🧪 Current test file paths
  - ✨ Expected test file paths
- Allows selecting multiple files using checkboxes
- Shows fix operation results

## Exit Codes
- 0: Success (no issues found or all fixes applied successfully)
- 1: Failure (validation errors or fix operation failed)

## Notes
- All validations are opt-in and must be explicitly enabled
- Fix operations require directory structure validation to be enabled
- The tool will create necessary directories when fixing file locations
- Works with both relative and absolute paths
- Supports Windows and Unix-style paths 