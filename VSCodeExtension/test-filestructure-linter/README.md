# Test Structure Linter

A VS Code extension that analyzes and validates test file structure in .NET projects. It helps maintain consistent test organization by validating file names, references, and directory structure.

## Features

The extension validates the following aspects of your test files:

1. **File Names**: Ensures test file names match their class names and have the "Tests" suffix.
   - Example: If testing `FooMapper.cs`, the test file should be named `FooMapperTests.cs`
   - The test class name inside the file must match the file name

2. **Class References**: Verifies that test files reference their tested classes.
   - Example: `FooMapperTests.cs` should contain a reference to the `FooMapper` class

3. **Directory Structure**: Ensures test files are in correct directories matching source file structure.
   - Example: If source file is at `src/Application/Mappers/FooMapper.cs`
   - Test file should be at `tests/Application.Tests/Mappers/FooMapperTests.cs`

## Usage

1. Open your .NET solution in VS Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS) to open the command palette
3. Type "Analyze Test Structure" and select the command
4. The extension will analyze your test files and show results in:
   - The Problems panel (press `Ctrl+Shift+M` to open)
   - The Output panel (select "Test Structure Analyzer" from the dropdown)
   - Notifications for overall results

## Requirements

- Visual Studio Code 1.96.0 or higher
- A .NET solution with test projects (projects ending with ".Tests")

## Extension Settings

The extension supports the following settings:

* `testFilestructureLinter.ignoredDirectories`: Array of directory names to ignore during analysis (default: ["bin", "obj"])
* `testFilestructureLinter.testFileSuffixes`: Array of valid test file suffixes (default: ["Tests"]). Case insensitive.
* `testFilestructureLinter.testProjectSuffix`: Suffix used to identify test projects (default: ".Tests"). Case sensitive.
* `testFilestructureLinter.sourceRoot`: Path from repository root to source code folder (default: "src"). Case sensitive.
* `testFilestructureLinter.testRoot`: Path from repository root to test folder (default: "tests"). Case sensitive.

Other default settings:
- Source files must have ".cs" extension

You can modify these settings in VS Code's settings.json file or through the Settings UI (File > Preferences > Settings).

Example configuration in settings.json:
```json
{
    "testFilestructureLinter.ignoredDirectories": [
        "bin",
        "obj",
        "node_modules",
        "packages"
    ],
    "testFilestructureLinter.testFileSuffixes": [
        "Tests",
        "Test",
        "Fixture"
    ],
    "testFilestructureLinter.testProjectSuffix": ".UnitTests",
    "testFilestructureLinter.sourceRoot": "app/src",
    "testFilestructureLinter.testRoot": "test/unit"
}
```

## Known Issues

- The extension currently only supports C# (.cs) files
- Only works with test projects that follow the ".Tests" naming convention
- Simple class name detection might not work with complex class definitions

## Release Notes

### 0.0.1

Initial release with basic functionality:
- File name validation
- Class reference validation
- Directory structure validation

**Enjoy!**
