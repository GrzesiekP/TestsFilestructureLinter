import { AnalysisResult, AnalysisErrorType } from './types';
import * as path from 'path';

interface JsonReportError {
  testName: string;
  issueType: string;
  sourceFiles?: string;
  currentTestFile?: string;
  expectedTestFile?: string;
}

interface JsonReportSummary {
  totalFilesAnalyzed: number;
  totalFilesWithIssues: number;
  issueRate: number;
  errorCounts: {
    directoryStructure: number;
    filename: number;
    missingTests: number;
  };
}

interface JsonReport {
  summary: JsonReportSummary;
  filesWithIssues: JsonReportError[];
}

export function generateJsonReport(results: AnalysisResult[], totalFiles: number): string {
  // Count error types
  const errorCounts = {
    directoryStructure: 0,
    filename: 0,
    missingTests: 0,
  };

  const filesWithIssues: JsonReportError[] = [];

  for (const result of results) {
    for (const error of result.errors) {
      // Count error types
      if (error.type === AnalysisErrorType.InvalidDirectoryStructure) {
        errorCounts.directoryStructure++;
      } else if (error.type === AnalysisErrorType.InvalidFileName) {
        errorCounts.filename++;
      } else if (error.type === AnalysisErrorType.MissingTest) {
        errorCounts.missingTests++;
      }

      // Create error entry
      const errorEntry: JsonReportError = {
        testName: result.testFile,
        issueType: error.type,
      };

      // Add current test file path - always include if available
      if (error.actualTestPath) {
        errorEntry.currentTestFile = formatToStandardPath(error.actualTestPath, 'tests');
      }

      // Add source files if available
      if (error.sourceFilePath) {
        // Handle multiple source files (comma-separated)
        if (error.sourceFilePath.includes(',')) {
          const sourceFiles = error.sourceFilePath.split(',').map((p) => p.trim());
          errorEntry.sourceFiles = sourceFiles
            .map((sourcePath) => formatToStandardPath(sourcePath, 'src'))
            .join(', ');
        } else {
          errorEntry.sourceFiles = formatToStandardPath(error.sourceFilePath, 'src');
        }
      }

      // Add expected test file path
      if (error.expectedTestPath) {
        errorEntry.expectedTestFile = formatToStandardPath(error.expectedTestPath, 'tests');
      }

      filesWithIssues.push(errorEntry);
    }
  }

  // Calculate summary
  const issueRate = totalFiles > 0 ? (results.length / totalFiles) * 100 : 0;

  const report: JsonReport = {
    summary: {
      totalFilesAnalyzed: totalFiles,
      totalFilesWithIssues: results.length,
      issueRate: parseFloat(issueRate.toFixed(1)),
      errorCounts,
    },
    filesWithIssues,
  };

  return JSON.stringify(report, null, 2);
}

// Helper function to format paths consistently (copied from console-reporter.ts)
function formatToStandardPath(filePath: string, rootDir: 'src' | 'tests'): string {
  // If path already starts with ./src or ./tests, return it
  if (filePath.startsWith('./src/') || filePath.startsWith('./tests/')) {
    return filePath;
  }

  // For paths with src or tests directories
  const srcTestRegex = new RegExp(`(.*?)[\\\/](src|tests)[\\\/](.*)`);
  const srcTestMatch = srcTestRegex.exec(filePath);
  if (srcTestMatch) {
    // Convert backslashes to forward slashes
    const remainingPath = srcTestMatch[3].replace(/\\/g, '/');
    return `./${srcTestMatch[2]}/${remainingPath}`;
  }

  // If we couldn't extract using the regex but the path contains 'test-data'
  if (filePath.includes('test-data')) {
    // This is likely a test path
    const parts = filePath.split(/[\/\\]tests[\/\\]/);
    if (parts.length > 1) {
      return `./tests/${parts[1].replace(/\\/g, '/')}`;
    }
  }

  // For absolute paths that don't contain src or tests markers
  const fileName = path.basename(filePath);
  // Try to identify more directory parts
  const dirParts = path.dirname(filePath).split(path.sep);
  // Take the last 3 directory parts or as many as available
  const relevantDirParts = dirParts.slice(Math.max(0, dirParts.length - 3));

  // Create the path and ensure we don't have duplicate src/src or tests/tests
  let result = `./${rootDir}/${relevantDirParts.join('/')}/${fileName}`
    .replace(/\\/g, '/') // Convert backslashes to forward slashes
    .replace(/\/\//g, '/'); // Remove any double slashes

  // Remove duplicate src or tests directories
  result = result.replace(`/${rootDir}/${rootDir}/`, `/${rootDir}/`);
  return result;
}