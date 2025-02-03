export interface AnalysisResult {
    testFile: string;
    testFilePath: string;
    errors: AnalysisError[];
}

export interface AnalysisError {
    type: AnalysisErrorType;
    message: string;
    suggestion?: string;
}

export enum AnalysisErrorType {
    InvalidFileName = 'InvalidFileName',
    InvalidDirectoryStructure = 'InvalidDirectoryStructure',
    MissingTest = 'MissingTest'
}

export interface AnalyzerOptions {
    srcRoot: string;
    testRoot: string;
    fileExtension: string;
    testFileSuffixes: string[];
    testProjectSuffix: string;
    ignoredDirectories: string[];
    excludedTestFiles: string[];
    enableMissingTestValidation: boolean;
}

export const DEFAULT_OPTIONS: AnalyzerOptions = {
    srcRoot: 'src',
    testRoot: 'tests',
    fileExtension: '.cs',
    testFileSuffixes: ['Tests'],
    testProjectSuffix: '.Tests',
    ignoredDirectories: ['bin', 'obj'],
    excludedTestFiles: [],
    enableMissingTestValidation: false
}; 