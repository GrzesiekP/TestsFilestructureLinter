export interface AnalysisResult {
    testFile: string;
    testFilePath: string;
    testRoot?: string;
    errors: AnalysisError[];
}

export interface AnalysisError {
    type: AnalysisErrorType;
    message: string;
    sourceFilePath?: string;
    actualTestPath?: string;
    expectedTestPath?: string;
}

export enum AnalysisErrorType {
    InvalidFileName = 'Invalid File Name',
    InvalidDirectoryStructure = 'Invalid Directory Structure',
    MissingTest = 'Missing Test File'
}

export interface AnalyzerOptions {
    srcRoot: string;
    testRoot: string;
    fileExtension: string;
    validateFileName: boolean;
    validateDirectoryStructure: boolean;
    validateMissingTests: boolean;
    testFileSuffix: string;
    testProjectSuffix: string;
}

export const DEFAULT_OPTIONS: AnalyzerOptions = {
    srcRoot: 'src',
    testRoot: 'tests',
    fileExtension: '.cs',
    validateFileName: true,
    validateDirectoryStructure: true,
    validateMissingTests: true,
    testFileSuffix: 'Tests',
    testProjectSuffix: '.Tests'
}; 