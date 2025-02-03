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
    validateFileName: boolean;
    validateDirectoryStructure: boolean;
    validateMissingTests: boolean;
    testFileSuffix: string;
}

export const DEFAULT_OPTIONS: AnalyzerOptions = {
    srcRoot: 'src',
    testRoot: 'tests',
    fileExtension: '.cs',
    validateFileName: true,
    validateDirectoryStructure: true,
    validateMissingTests: true,
    testFileSuffix: 'Tests'
}; 