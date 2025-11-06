import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AnalysisResult, AnalysisError, AnalysisErrorType, AnalyzerOptions } from './types';

export interface FixOptions {
  createMissingFiles: boolean;
  renameInvalidFiles: boolean;
  moveFiles: boolean;
}

export const DEFAULT_FIX_OPTIONS: FixOptions = {
  createMissingFiles: false,
  renameInvalidFiles: false,
  moveFiles: false,
};

export interface FixableResult {
  isFixable: boolean;
  error?: string;
  fix?: () => Promise<FixResult>;
}

interface FixResult {
  from: string;
  to: string;
}

export class Fixer {
  async applyFixes(
    results: AnalysisResult[],
    options: FixOptions = DEFAULT_FIX_OPTIONS,
  ): Promise<void> {
    for (const result of results) {
      for (const error of result.errors) {
        await this.handleErrorFix(error, result.testFilePath, options);
      }
    }
  }

  private async handleErrorFix(
    error: AnalysisError,
    testFilePath: string,
    options: FixOptions,
  ): Promise<void> {
    switch (error.type) {
      case AnalysisErrorType.MissingTest:
        if (options.createMissingFiles) {
          await this.createMissingTestFile(testFilePath);
        }
        break;
      case AnalysisErrorType.InvalidFileName:
        if (options.renameInvalidFiles) {
          await this.renameInvalidTestFile(error, []);
        }
        break;
      case AnalysisErrorType.InvalidDirectoryStructure:
        if (options.moveFiles) {
          await this.moveTestFile(error, []);
        }
        break;
    }
  }

  private createMissingTestFile(sourcePath: string): Promise<void> {
    // Implementation for creating missing test files
    throw new Error('Not implemented');
  }

  private async renameInvalidTestFile(
    error: AnalysisError,
    fixedFiles: FixResult[],
  ): Promise<void> {
    if (!error.actualTestPath || !error.expectedTestPath) {
      console.log('[DEBUG] Missing paths, returning early');
      return;
    }

    const actualPath = error.actualTestPath;
    const expectedPath = error.expectedTestPath;

    // Check if paths differ only in case (case-sensitive rename needed on Windows)
    if (actualPath.toLowerCase() === expectedPath.toLowerCase()) {
      // Two-step rename for case-only changes
      const tempPath = path.join(
        path.dirname(actualPath),
        `temp_${Date.now()}_${path.basename(expectedPath)}`,
      );
      await fs.rename(actualPath, tempPath);
      await fs.rename(tempPath, expectedPath);
    } else {
      // Direct rename
      await fs.rename(actualPath, expectedPath);
    }

    console.log(`Renamed: ${error.actualTestPath} → ${error.expectedTestPath}`);

    fixedFiles.push({
      from: actualPath,
      to: expectedPath,
    });
  }

  async isFixable(testFilePath: string, results: AnalysisResult[]): Promise<FixableResult> {
    // Find the result for this file
    const result = results.find((r) => r.testFilePath === testFilePath);
    if (!result) {
      return {
        isFixable: false,
        error: 'File not found in analysis results',
      };
    }

    // Check if it has a directory structure or filename error that can be fixed
    const error = result.errors.find(
      (e) =>
        (e.type === AnalysisErrorType.InvalidDirectoryStructure ||
         e.type === AnalysisErrorType.InvalidFileName) &&
        e.actualTestPath &&
        e.expectedTestPath &&
        e.sourceFilePath,
    );

    if (!error) {
      return {
        isFixable: false,
        error: 'File has no fixable directory structure or filename issues',
      };
    }

    return {
      isFixable: true,
      fix: async () => {
        const fixedFiles: FixResult[] = [];
        if (error.type === AnalysisErrorType.InvalidFileName) {
          await this.renameInvalidTestFile(error, fixedFiles);
        } else {
          await this.moveTestFile(error, fixedFiles);
        }
        return fixedFiles[0];
      },
    };
  }

  async fixDirectoryStructure(
    results: AnalysisResult[],
    options: AnalyzerOptions,
  ): Promise<FixResult[]> {
    const fixedFiles: FixResult[] = [];

    for (const result of results) {
      for (const error of result.errors) {
        await this.tryFixDirectoryError(error, fixedFiles);
      }
    }

    return fixedFiles;
  }

  private async tryFixDirectoryError(
    error: AnalysisError,
    fixedFiles: FixResult[],
  ): Promise<void> {
    if (error.type !== AnalysisErrorType.InvalidDirectoryStructure) {
      return;
    }

    if (!error.actualTestPath || !error.expectedTestPath || !error.sourceFilePath) {
      return;
    }

    try {
      await this.moveTestFile(error, fixedFiles);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to fix ${error.actualTestPath}: ${errorMessage}`);
    }
  }

  async moveTestFile(error: AnalysisError, fixedFiles: FixResult[]): Promise<void> {
    if (!error.actualTestPath || !error.expectedTestPath) return;

    const actualPath = error.actualTestPath;
    const expectedPath = error.expectedTestPath;

    // Read the test file content
    const content = await fs.readFile(actualPath, 'utf8');

    // Update namespace if needed
    const updatedContent = this.updateNamespace(content, actualPath, expectedPath);

    // Create directories as needed
    const dir = path.dirname(expectedPath);
    await fs.mkdir(dir, {
      recursive: true,
    });

    // Write the file to its new location
    await fs.writeFile(expectedPath, updatedContent);

    // Delete the original file
    await fs.unlink(actualPath);

    fixedFiles.push({
      from: actualPath,
      to: expectedPath,
    });
  }

  private updateNamespace(content: string, actualPath: string, expectedPath: string): string {
    // Extract namespaces from paths
    const actualNamespace = this.extractNamespaceFromPath(actualPath);
    const expectedNamespace = this.extractNamespaceFromPath(expectedPath);

    if (actualNamespace && expectedNamespace && actualNamespace !== expectedNamespace) {
      // Replace namespace in the file
      const namespaceRegex = new RegExp(
        `namespace\\s+${this.escapeRegExp(actualNamespace)}\\b`,
        'g',
      );
      return content.replace(namespaceRegex, `namespace ${expectedNamespace}`);
    }

    return content;
  }

  private extractNamespaceFromPath(filePath: string): string | null {
    const parts = path.dirname(filePath).split(path.sep);
    const testIndex = parts.findIndex((p) => p.endsWith('.Tests'));

    if (testIndex >= 0) {
      return parts.slice(testIndex).join('.');
    }

    return null;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  }
}
