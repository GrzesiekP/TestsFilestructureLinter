import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { AnalysisResult, AnalysisError, AnalysisErrorType, AnalyzerOptions, DEFAULT_OPTIONS } from './types';

export async function analyzeProject(options: Partial<AnalyzerOptions> = {}): Promise<AnalysisResult[]> {
    const mergedOptions: AnalyzerOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
        // Ensure paths are absolute
        srcRoot: path.resolve(options.srcRoot || DEFAULT_OPTIONS.srcRoot),
        testRoot: path.resolve(options.testRoot || DEFAULT_OPTIONS.testRoot)
    };
    const results: AnalysisResult[] = [];
    
    const testFiles = await findTestFiles(mergedOptions.testRoot, mergedOptions.fileExtension);
    const sourceFiles = await findSourceFiles(mergedOptions.srcRoot, mergedOptions.fileExtension);
    
    for (const testFile of testFiles) {
        const result = await analyzeTestFile(path.resolve(testFile), mergedOptions);
        if (result.errors.length > 0) {
            results.push(result);
        }
    }
    
    if (mergedOptions.validateMissingTests) {
        const missingTestResults = await analyzeMissingTests(
            sourceFiles.map(f => path.resolve(f)),
            testFiles.map(f => path.resolve(f)),
            mergedOptions
        );
        results.push(...missingTestResults);
    }
    
    return results;
}

async function findTestFiles(dir: string, extension: string): Promise<string[]> {
    try {
        const files = await glob(`${dir}/**/*${extension}`);
        return files.map(f => path.resolve(f));
    } catch (error) {
        console.error('Error finding test files:', error);
        return [];
    }
}

async function findSourceFiles(dir: string, extension: string): Promise<string[]> {
    try {
        const files = await glob(`${dir}/**/*${extension}`);
        return files.map(f => path.resolve(f));
    } catch (error) {
        console.error('Error finding source files:', error);
        return [];
    }
}

async function analyzeTestFile(testFilePath: string, options: AnalyzerOptions): Promise<AnalysisResult> {
    const result: AnalysisResult = {
        testFile: path.basename(testFilePath),
        testFilePath: path.resolve(testFilePath),
        errors: []
    };
    
    if (options.validateFileName) {
        const fileNameError = validateFileName(testFilePath, options.testFileSuffix);
        if (fileNameError) {
            result.errors.push(fileNameError);
        }
    }
    
    if (options.validateDirectoryStructure) {
        const structureError = validateDirectoryStructure(testFilePath, options);
        if (structureError) {
            result.errors.push(structureError);
        }
    }
    
    return result;
}

function validateFileName(filePath: string, suffix: string): AnalysisError | null {
    const fileName = path.basename(filePath, path.extname(filePath));
    if (!fileName.endsWith(suffix)) {
        return {
            type: AnalysisErrorType.InvalidFileName,
            message: `Test file name '${fileName}' does not end with '${suffix}'`
        };
    }
    return null;
}

function validateDirectoryStructure(testFilePath: string, options: AnalyzerOptions): AnalysisError | null {
    const testDir = path.dirname(testFilePath);
    const relativePath = path.relative(options.testRoot, testDir);
    const expectedSourceDir = path.join(options.srcRoot, relativePath);
    
    try {
        if (!existsSync(expectedSourceDir)) {
            return {
                type: AnalysisErrorType.InvalidDirectoryStructure,
                message: `Test file directory structure does not match source directory structure at: ${path.resolve(testFilePath)}`
            };
        }
    } catch (error) {
        console.error('Error validating directory structure:', error);
    }
    
    return null;
}

async function analyzeMissingTests(sourceFiles: string[], testFiles: string[], options: AnalyzerOptions): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    for (const sourceFile of sourceFiles) {
        const expectedTestFile = sourceFile
            .replace(options.srcRoot, options.testRoot)
            .replace(path.extname(sourceFile), `${options.testFileSuffix}${path.extname(sourceFile)}`);
            
        if (!testFiles.includes(expectedTestFile)) {
            results.push({
                testFile: path.basename(expectedTestFile),
                testFilePath: path.resolve(expectedTestFile),
                errors: [{
                    type: AnalysisErrorType.MissingTest,
                    message: `Missing test file for source file: ${path.resolve(sourceFile)}`
                }]
            });
        }
    }
    
    return results;
} 