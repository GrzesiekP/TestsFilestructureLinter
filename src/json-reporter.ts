import { AnalysisResult, AnalysisError, AnalysisErrorType } from './types';
import * as path from 'node:path';

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
  const errorCounts = countErrorTypes(results);
  const filesWithIssues = createFileIssuesList(results);
  const issueRate = totalFiles > 0 ? (results.length / totalFiles) * 100 : 0;

  const report: JsonReport = {
    summary: {
      totalFilesAnalyzed: totalFiles,
      totalFilesWithIssues: results.length,
      issueRate: Number.parseFloat(issueRate.toFixed(1)),
      errorCounts,
    },
    filesWithIssues,
  };

  return JSON.stringify(report, null, 2);
}

function countErrorTypes(results: AnalysisResult[]): {
  directoryStructure: number;
  filename: number;
  missingTests: number;
} {
  const counts = {
    directoryStructure: 0,
    filename: 0,
    missingTests: 0,
  };

  for (const result of results) {
    for (const error of result.errors) {
      switch (error.type) {
        case AnalysisErrorType.InvalidDirectoryStructure:
          counts.directoryStructure++;
          break;
        case AnalysisErrorType.InvalidFileName:
          counts.filename++;
          break;
        case AnalysisErrorType.MissingTest:
          counts.missingTests++;
          break;
      }
    }
  }

  return counts;
}

function createFileIssuesList(results: AnalysisResult[]): JsonReportError[] {
  const issues: JsonReportError[] = [];

  for (const result of results) {
    for (const error of result.errors) {
      const errorEntry = createErrorEntry(result.testFile, error);
      issues.push(errorEntry);
    }
  }

  return issues;
}

function createErrorEntry(testFile: string, error: AnalysisError): JsonReportError {
  const errorEntry: JsonReportError = {
    testName: testFile,
    issueType: error.type,
  };

  addCurrentTestFile(errorEntry, error);
  addSourceFiles(errorEntry, error);
  addExpectedTestFile(errorEntry, error);

  return errorEntry;
}

function addCurrentTestFile(errorEntry: JsonReportError, error: AnalysisError): void {
  if (error.actualTestPath) {
    errorEntry.currentTestFile = formatToStandardPath(error.actualTestPath, 'tests');
  }
}

function addSourceFiles(errorEntry: JsonReportError, error: AnalysisError): void {
  if (!error.sourceFilePath) {
    return;
  }

  if (error.sourceFilePath.includes(',')) {
    const sourceFiles = error.sourceFilePath.split(',').map((p: string) => p.trim());
    errorEntry.sourceFiles = sourceFiles
      .map((sourcePath: string) => formatToStandardPath(sourcePath, 'src'))
      .join(', ');
  } else {
    errorEntry.sourceFiles = formatToStandardPath(error.sourceFilePath, 'src');
  }
}

function addExpectedTestFile(errorEntry: JsonReportError, error: AnalysisError): void {
  if (error.expectedTestPath) {
    errorEntry.expectedTestFile = formatToStandardPath(error.expectedTestPath, 'tests');
  }
}

// Helper function to format paths consistently (copied from console-reporter.ts)
function formatToStandardPath(filePath: string, rootDir: 'src' | 'tests'): string {
  // If path already starts with ./src or ./tests, return it
  if (filePath.startsWith('./src/') || filePath.startsWith('./tests/')) {
    return filePath;
  }

  // For paths with src or tests directories
  const srcTestRegex = /(.*?)[/](src|tests)[/](.*)/;
  const srcTestMatch = srcTestRegex.exec(filePath);
  if (srcTestMatch) {
    // Convert backslashes to forward slashes
    const remainingPath = srcTestMatch[3].replaceAll(/\\/g, '/');
    return `./${srcTestMatch[2]}/${remainingPath}`;
  }

  // If we couldn't extract using the regex but the path contains 'test-data'
  if (filePath.includes('test-data')) {
    // This is likely a test path
    const parts = filePath.split(/[\/\\]tests[\/\\]/);
    if (parts.length > 1) {
      return `./tests/${parts[1].replaceAll(/\\/g, '/')}`;
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
    .replaceAll(/\\/g, '/') // Convert backslashes to forward slashes
    .replaceAll(/\/\//g, '/'); // Remove any double slashes

  // Remove duplicate src or tests directories
  result = result.replace(`/${rootDir}/${rootDir}/`, `/${rootDir}/`);
  return result;
}
