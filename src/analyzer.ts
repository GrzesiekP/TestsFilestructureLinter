import * as path from 'node:path';
import { glob } from 'glob';
import {
  AnalysisResult,
  AnalysisError,
  AnalysisErrorType,
  AnalyzerOptions,
  DEFAULT_OPTIONS,
} from './types';
import * as fs from 'node:fs';

export class Analyzer {
  async analyzeProject(options: Partial<AnalyzerOptions> = {}): Promise<{
    results: AnalysisResult[];
    totalFiles: number;
  }> {
    const mergedOptions: AnalyzerOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
      srcRoot: path.resolve(options.srcRoot ?? DEFAULT_OPTIONS.srcRoot),
      testRoot: path.resolve(options.testRoot ?? DEFAULT_OPTIONS.testRoot),
      ignoreDirectories: options.ignoreDirectories ?? DEFAULT_OPTIONS.ignoreDirectories,
      ignoreFiles: options.ignoreFiles ?? DEFAULT_OPTIONS.ignoreFiles,
    };

      const normalizedIgnoreFiles = new Set(mergedOptions.ignoreFiles.map((f) => f.toLowerCase()));
    // Find all test files - always pass the ignore configurations
    const testFiles = await this.findTestFiles(
      mergedOptions.testRoot,
      mergedOptions.fileExtension,
      mergedOptions.testFileSuffix,
      mergedOptions.ignoreDirectories,
      normalizedIgnoreFiles,
      mergedOptions.testProjectSuffix,
    );

    const sourceFiles = await this.findSourceFiles(
      mergedOptions.srcRoot,
      mergedOptions.fileExtension,
      mergedOptions.ignoreDirectories,
      normalizedIgnoreFiles,
    );

    const results: AnalysisResult[] = [];

    // Process all test files
    for (const testFile of testFiles) {
      const testFileName = path.basename(testFile, mergedOptions.fileExtension);
      const sourceFileName = testFileName.replace(
        new RegExp(`${mergedOptions.testFileSuffix}$`),
        '',
      );
      const matchingSourceFiles = await this.findMatchingSourceFiles(
        sourceFiles,
        sourceFileName,
        mergedOptions.fileExtension,
      );

      const result: AnalysisResult = {
        testFile: path.basename(testFile),
        testFilePath: path.resolve(testFile),
        errors: [],
      };

      if (matchingSourceFiles.length === 0) {
        result.errors.push({
          type: AnalysisErrorType.InvalidDirectoryStructure,
          message: `Source file not found: ${sourceFileName}${mergedOptions.fileExtension}`,
          actualTestPath: testFile,
        });
      } else if (matchingSourceFiles.length > 1) {
        // Try to find a matching source file based on subdirectory structure
        const relativeTestPath = path.relative(mergedOptions.testRoot, testFile);
        const testDirPath = path.dirname(relativeTestPath);
        const testDirSegments = testDirPath.split(/[/\\]/);
        const testProjectDirSegment = testDirSegments[0];
        const testPathAfterProjectDir = testDirSegments.slice(1).join(path.sep);

        // Try to find a source file with matching directory structure
        const matchingSourceByDir = matchingSourceFiles.find((file) => {
          const relativeSourcePath = path.relative(mergedOptions.srcRoot, file);
          const sourceDirPath = path.dirname(relativeSourcePath);
          const sourceDirSegments = sourceDirPath.split(/[/\\]/);
          const sourceProjectDirSegment = sourceDirSegments[0];
          const sourcePathAfterProjectDir = sourceDirSegments.slice(1).join(path.sep);

          const isMatching =
            sourceProjectDirSegment ===
              testProjectDirSegment.replace(mergedOptions.testProjectSuffix, '') &&
            sourcePathAfterProjectDir === testPathAfterProjectDir;
          return isMatching;
        });

        if (matchingSourceByDir) {
          // We found a matching source file based on directory - check if the test file is in the expected location
          const expectedTestPath = this.calculateExpectedTestPath(
            matchingSourceByDir,
            mergedOptions,
          );

          // Use case-sensitive comparison to detect case-only differences (important on Windows)
          if (testFile !== expectedTestPath) {
            // Extract directory and filename components
            const actualDir = path.dirname(testFile);
            const expectedDir = path.dirname(expectedTestPath);
            const expectedFileName = path.basename(expectedTestPath);

            // Compare directories (case-insensitive for cross-platform compatibility)
            if (path.normalize(actualDir) === path.normalize(expectedDir)) {
              // Same directory, different filename (including case-only differences)
              result.errors.push({
                type: AnalysisErrorType.InvalidFileName,
                message: `Test file has incorrect name. Expected: ${expectedFileName}`,
                sourceFilePath: matchingSourceByDir,
                actualTestPath: testFile,
                expectedTestPath: expectedTestPath,
              });
            } else {
              // Different directory
              result.errors.push({
                type: AnalysisErrorType.InvalidDirectoryStructure,
                message: 'Test file is in wrong directory',
                sourceFilePath: matchingSourceByDir,
                actualTestPath: testFile,
                expectedTestPath: expectedTestPath,
              });
            }
          }
          // No error if the subdirectory matching source file corresponds to the correct test location
        } else {
          // No matching subdirectory - report multiple source files
          result.errors.push({
            type: AnalysisErrorType.InvalidDirectoryStructure,
            message: `Multiple matching source files found (${matchingSourceFiles.length}). Unable to determine correct source file`,
            sourceFilePath: matchingSourceFiles.join(', '),
            actualTestPath: testFile,
          });
        }
      } else {
        const sourcePath = matchingSourceFiles[0];
        const expectedTestPath = this.calculateExpectedTestPath(sourcePath, mergedOptions);

        // Use case-sensitive comparison to detect case-only differences (important on Windows)
        if (testFile !== expectedTestPath) {
          // Extract directory and filename components
          const actualDir = path.dirname(testFile);
          const expectedDir = path.dirname(expectedTestPath);
          const expectedFileName = path.basename(expectedTestPath);

          // Compare directories (case-insensitive for cross-platform compatibility)
          if (path.normalize(actualDir) === path.normalize(expectedDir)) {
            // Same directory, different filename (including case-only differences)
            result.errors.push({
              type: AnalysisErrorType.InvalidFileName,
              message: `Test file has incorrect name. Expected: ${expectedFileName}`,
              sourceFilePath: sourcePath,
              actualTestPath: testFile,
              expectedTestPath: expectedTestPath,
            });
          } else {
            // Different directory
            result.errors.push({
              type: AnalysisErrorType.InvalidDirectoryStructure,
              message: 'Test file is in wrong directory',
              sourceFilePath: sourcePath,
              actualTestPath: testFile,
              expectedTestPath: expectedTestPath,
            });
          }
        }
      }

      if (result.errors.length > 0) {
        results.push(result);
      }
    }

    if (mergedOptions.validateMissingTests) {
      const missingTestResults = await this.analyzeMissingTests(
        sourceFiles,
        testFiles,
        mergedOptions,
      );
      results.push(...missingTestResults);
    }

    // Final step: Always filter out any results for ignored files or files in ignored directories
    const filteredResults = results.filter((result) => {
      const normalizedPath = path.normalize(result.testFilePath);

      // Skip results for files in ignored directories
      for (const ignoreDir of mergedOptions.ignoreDirectories) {
        // Check if path contains the directory with proper path separators
        // Handle various positions: start, middle, end of path
        const normalizedIgnoreDir = ignoreDir.replace(/[/\\]/g, path.sep);

        // Check for ignored directory in path
        if (
          normalizedPath.includes(`${path.sep}${normalizedIgnoreDir}${path.sep}`) || // Middle
          normalizedPath.endsWith(`${path.sep}${normalizedIgnoreDir}`) || // End
          normalizedPath.startsWith(`${normalizedIgnoreDir}${path.sep}`) // Start
        ) {
          return false;
        }
      }

      // Skip results for ignored files
      for (const ignoreFile of mergedOptions.ignoreFiles) {
        if (path.basename(normalizedPath).toLowerCase() === ignoreFile.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    return {
      results: filteredResults,
      totalFiles: testFiles.length + sourceFiles.length,
    };
  }

  async findTestFiles(
    dir: string,
    extension: string,
    testFileSuffix: string,
    ignoreDirectories: string[] = [],
    normalizedIgnoreFiles: Set<string> = new Set<string>(),
    testProjectSuffix: string = '.Tests',
  ): Promise<string[]> {
    try {
      // Create glob ignore patterns including ignoreDirectories
      const globIgnorePatterns = ['node_modules/**', ...ignoreDirectories.map((d) => `**/${d}/**`)];

      const files = await new Promise<string[]>((resolve, reject) => {
        glob(
          `${dir}/**/*${extension}`,
          {
            ignore: globIgnorePatterns,
          },
          (err, files) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(files);
          },
        );
      });

      return files
        .map((f: string) => path.resolve(f))
        .filter((f: string) => {
          // Skip non-existing files
          if (!fs.existsSync(f)) {
            return false;
          }

          // Skip directories
          const stats = fs.statSync(f);
          if (stats.isDirectory()) {
            return false;
          }

          // Skip files that don't have the test suffix in their filename
          const fileName = path.basename(f);
          const fileNameWithoutExt = path.basename(fileName, extension);
          if (!fileNameWithoutExt.endsWith(testFileSuffix)) {
            return false;
          }

          // Skip ignored files - case insensitive comparison
          if (normalizedIgnoreFiles.has(fileName.toLowerCase())) {
            return false;
          }

          // Get the path relative to the test root to check for ignored directories
          const relativePath = path.relative(dir, f);
          const pathSegments = relativePath.split(/[/\\]/);

          // Only include files from projects with the exact test project suffix
          if (pathSegments.length > 0) {
            const projectName = pathSegments[0];
            // Check if the project name ends with the exact test project suffix
            // Not just any project containing "Tests" in the name
            if (!projectName.endsWith(testProjectSuffix)) {
              return false;
            }

            // Additional check to exclude Tests.* projects that aren't proper test projects
            // e.g., Tests.Helpers
            if (projectName.startsWith('Tests.')) {
              return false;
            }
          }

          return true;
        });
    } catch (error) {
      console.error('Error finding test files:', error);
      return [];
    }
  }

  async findSourceFiles(
    dir: string,
    extension: string,
    ignoreDirectories: string[] = [],
    normalizedIgnoreFiles: Set<string> = new Set<string>(),
  ): Promise<string[]> {
    try {
      // Create glob ignore patterns from ignore directories and files
      const ignorePatterns = ['node_modules/**', ...ignoreDirectories.map((d) => `**/${d}/**`)];

      const files = await new Promise<string[]>((resolve, reject) => {
        glob(
          `${dir}/**/*${extension}`,
          {
            ignore: ignorePatterns,
          },
          (err, files) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(files);
          },
        );
      });

      return files
        .map((f: string) => path.resolve(f))
        .filter((f: string) => {
          // Skip non-existing files
          if (!fs.existsSync(f)) {
            return false;
          }

          // Skip directories
          const stats = fs.statSync(f);
          if (stats.isDirectory()) {
            return false;
          }

          // Skip ignored files - case insensitive comparison
          const fileName = path.basename(f);
          if (normalizedIgnoreFiles.has(fileName.toLowerCase())) {
            return false;
          }

          return true;
        });
    } catch (error) {
      console.error('Error finding source files:', error);
      return [];
    }
  }

  createSourceFileMap(sourceFiles: string[], extension: string): Map<string, string[]> {
    const sourceMap = new Map<string, string[]>();

    for (const file of sourceFiles) {
      const baseName = path.basename(file, extension).toLowerCase();
      const existingPaths = sourceMap.get(baseName) || [];
      sourceMap.set(baseName, [...existingPaths, file]);
    };

    return sourceMap;
  }

  async findMatchingSourceFiles(
    sourceFiles: string[],
    baseName: string,
    extension: string,
  ): Promise<string[]> {
    return sourceFiles.filter((file) => {
      const fileBaseName = path.basename(file, extension);
      return fileBaseName.toLowerCase() === baseName.toLowerCase();
    });
  }

  async validateFileName(filePath: string, suffix: string): Promise<AnalysisError | null> {
    const fileName = path.basename(filePath, path.extname(filePath));
    if (!fileName.endsWith(suffix)) {
      return {
        type: AnalysisErrorType.InvalidFileName,
        message: `Test file name '${fileName}' does not end with '${suffix}'`,
      };
    }
    return null;
  }

  validateDirectoryStructure(
    testFilePath: string,
    options: AnalyzerOptions,
    sourceFiles: string[],
  ): AnalysisError | null {
    try {
      const testFileName = path.basename(testFilePath, path.extname(testFilePath));
      const sourceFileName = testFileName
        .replace(new RegExp(`${options.testFileSuffix}$`), '')
        .toLowerCase();

      // Find all source files with matching base name
      const matchingSourceFiles = sourceFiles.filter((file) => {
        const fileBaseName = path.basename(file, options.fileExtension);
        return fileBaseName.toLowerCase() === sourceFileName.toLowerCase();
      });

      if (matchingSourceFiles.length === 0) {
        return {
          type: AnalysisErrorType.InvalidDirectoryStructure,
          message: `Source file not found: ${sourceFileName}${options.fileExtension}`,
        };
      }

      if (matchingSourceFiles.length > 1) {
        // Get the relative path of the test file
        const relativeTestPath = path.relative(options.testRoot, testFilePath);
        const testDirPath = path.dirname(relativeTestPath);
        const testDirSegments = testDirPath.split(/[/\\]/);
        const lastTestDirSegment = testDirSegments.at(-1);

        // Try to find a source file with matching subdirectory structure
        const matchingSourceByDir = matchingSourceFiles.find((file) => {
          const relativeSourcePath = path.relative(options.srcRoot, file);
          const sourceDirPath = path.dirname(relativeSourcePath);
          const sourceDirSegments = sourceDirPath.split(/[/\\]/);
          const lastSourceDirSegment = sourceDirSegments.at(-1);

          return (
            lastSourceDirSegment &&
            lastTestDirSegment &&
            lastSourceDirSegment.toLowerCase() === lastTestDirSegment.toLowerCase()
          );
        });

        if (matchingSourceByDir) {
          // We found a match based on directory structure, check if it's in the right location
          const expectedTestPath = this.calculateExpectedTestPath(matchingSourceByDir, options);
          if (path.normalize(testFilePath) !== path.normalize(expectedTestPath)) {
            // Test file is in the wrong directory
            return {
              type: AnalysisErrorType.InvalidDirectoryStructure,
              message: 'Test file is in wrong directory',
              sourceFilePath: path.join(
                './src',
                path.relative(options.srcRoot, matchingSourceByDir),
              ),
              actualTestPath: path.join('./tests', relativeTestPath),
              expectedTestPath: path.join(
                './tests',
                path.relative(options.testRoot, expectedTestPath),
              ),
            };
          }
          // No error if the subdirectory matches and the test file is in the correct location
          return null;
        }

        // Convert absolute paths to relative paths for display
        const relativePaths = matchingSourceFiles.map((file) => {
          const relativePath = path.relative(options.srcRoot, file);
          return path.join('./src', relativePath);
        });

        return {
          type: AnalysisErrorType.InvalidDirectoryStructure,
          message: `Multiple matching source files found (${matchingSourceFiles.length}). Unable to determine correct source file`,
          sourceFilePath: relativePaths.join(', '),
          actualTestPath: path.join('./tests', relativeTestPath),
        };
      }

      const sourceFilePath = matchingSourceFiles[0];
      const expectedTestPath = this.calculateExpectedTestPath(sourceFilePath, options);

      if (path.normalize(testFilePath) !== path.normalize(expectedTestPath)) {
        // Convert absolute paths to relative paths for display
        const relativeSourcePath = path.relative(options.srcRoot, sourceFilePath);
        const relativeTestPath = path.relative(options.testRoot, testFilePath);
        const relativeExpectedPath = path.relative(options.testRoot, expectedTestPath);

        return {
          type: AnalysisErrorType.InvalidDirectoryStructure,
          message: 'Test file is in wrong directory',
          sourceFilePath: path.join('./src', relativeSourcePath),
          actualTestPath: path.join('./tests', relativeTestPath),
          expectedTestPath: path.join('./tests', relativeExpectedPath),
        };
      }

      return null;
    } catch (error) {
      console.error('Error in validateDirectoryStructure:', error);
      return {
        type: AnalysisErrorType.InvalidDirectoryStructure,
        message: `Error validating directory structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  findFirstIncorrectSegment(
    actualPath: string,
    expectedPath: string,
    options: AnalyzerOptions,
  ): string | null {
    const actualRelative = path.relative(options.testRoot, actualPath);
    const expectedRelative = path.relative(options.testRoot, expectedPath);

    const actualSegments = actualRelative.split(/[\\/]/).filter((s) => s !== '');
    const expectedSegments = expectedRelative.split(/[\\/]/).filter((s) => s !== '');

    // Compare each segment
    for (let i = 0; i < Math.min(actualSegments.length, expectedSegments.length); i++) {
      if (actualSegments[i] !== expectedSegments[i]) {
        // If this is an extra directory segment that shouldn't be there
        if (!expectedSegments.includes(actualSegments[i])) {
          return actualSegments[i];
        }
      }
    }

    // If we get here and lengths are different, the last segment of the longer path is incorrect
    if (actualSegments.length > expectedSegments.length) {
      return actualSegments[expectedSegments.length];
    }

    return null;
  }

  calculateExpectedTestPath(sourceFilePath: string, options: AnalyzerOptions): string {
    // Get the relative path from source root
    const relativePath = path.relative(options.srcRoot, sourceFilePath);
    const sourceSegments = relativePath.split(/[/\\]/);

    // Get the project name (first segment) and add test suffix
    const projectName = sourceSegments[0];
    const testProjectName = projectName + options.testProjectSuffix;

    // Get the remaining path segments (excluding the project name and file name)
    const remainingPath = sourceSegments.slice(1, -1);

    // Get the source file name and convert it to test file name
    const sourceFileName = path.basename(sourceFilePath);
    const testFileName =
      sourceFileName.replace(path.extname(sourceFileName), '') +
      options.testFileSuffix +
      path.extname(sourceFileName);

    // Construct the expected test path
    return path.join(options.testRoot, testProjectName, ...remainingPath, testFileName);
  }

  async analyzeMissingTests(
    sourceFiles: string[],
    testFiles: string[],
    options: AnalyzerOptions,
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const testFileMap = new Map<string, string>();

    // Create a map of test base names (without suffix) to their full paths
    for (const testFile of testFiles) {
      const baseName = path
        .basename(testFile, path.extname(testFile))
        .replace(new RegExp(`${options.testFileSuffix}$`), '');
      testFileMap.set(baseName, testFile);
    }

    for (const sourceFile of sourceFiles) {
      const sourceBaseName = path.basename(sourceFile, path.extname(sourceFile));
      const expectedTestFile = testFileMap.get(sourceBaseName);

      if (!expectedTestFile) {
        const expectedTestPath = this.calculateExpectedTestPath(sourceFile, options);

        results.push({
          testFile: path.basename(expectedTestPath),
          testFilePath: path.resolve(expectedTestPath),
          errors: [
            {
              type: AnalysisErrorType.MissingTest,
              message: `Missing test file for source file: ${path.resolve(sourceFile)}`,
            },
          ],
        });
      }
    }

    return results;
  }
}
