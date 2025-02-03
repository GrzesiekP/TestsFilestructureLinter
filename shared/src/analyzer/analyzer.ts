import * as path from 'path';
import { glob } from 'glob';
import { AnalysisResult, AnalysisError, AnalysisErrorType, AnalyzerOptions, DEFAULT_OPTIONS } from './types';

export async function analyzeProject(options: Partial<AnalyzerOptions> = {}): Promise<{ results: AnalysisResult[]; totalFiles: number }> {
    const mergedOptions: AnalyzerOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
        srcRoot: path.resolve(options.srcRoot || DEFAULT_OPTIONS.srcRoot),
        testRoot: path.resolve(options.testRoot || DEFAULT_OPTIONS.testRoot)
    };
    const results: AnalysisResult[] = [];
    
    const testFiles = await findTestFiles(
        mergedOptions.testRoot,
        mergedOptions.fileExtension,
        mergedOptions.testFileSuffix
    );
    const sourceFiles = await findSourceFiles(mergedOptions.srcRoot, mergedOptions.fileExtension);
    
    // Create a map of source file names to their full paths for quick lookup
    const sourceFileMap = new Map<string, string>();
    for (const sourceFile of sourceFiles) {
        const baseName = path.basename(sourceFile, path.extname(sourceFile));
        sourceFileMap.set(baseName, sourceFile);
    }
    
    for (const testFile of testFiles) {
        const result = await analyzeTestFile(path.resolve(testFile), mergedOptions, sourceFileMap);
        if (result.errors.length > 0) {
            results.push(result);
        }
    }
    
    if (mergedOptions.validateMissingTests) {
        const missingTestResults = await analyzeMissingTests(sourceFiles, testFiles, mergedOptions);
        results.push(...missingTestResults);
    }
    
    // Add test root to each result for reporting
    results.forEach(result => {
        result.testRoot = mergedOptions.testRoot;
    });
    
    return {
        results,
        totalFiles: testFiles.length + sourceFiles.length
    };
}

async function findTestFiles(dir: string, extension: string, testFileSuffix: string): Promise<string[]> {
    try {
        const files = await glob(`${dir}/**/*${extension}`);
        return files
            .map(f => path.resolve(f))
            .filter(f => {
                const fileName = path.basename(f, path.extname(f));
                return fileName.endsWith(testFileSuffix);
            });
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

async function analyzeTestFile(
    testFilePath: string,
    options: AnalyzerOptions,
    sourceFileMap: Map<string, string>
): Promise<AnalysisResult> {
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
        const structureError = validateDirectoryStructure(testFilePath, options, sourceFileMap);
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

function validateDirectoryStructure(
    testFilePath: string,
    options: AnalyzerOptions,
    sourceFileMap: Map<string, string>
): AnalysisError | null {
    const testFileName = path.basename(testFilePath, path.extname(testFilePath));
    const sourceFileName = testFileName.replace(new RegExp(`${options.testFileSuffix}$`), '');
    const sourceFilePath = sourceFileMap.get(sourceFileName);

    if (!sourceFilePath) {
        // Try to find source file with similar name in any directory
        const potentialSourceFiles = Array.from(sourceFileMap.entries())
            .filter(([name]) => name.toLowerCase() === sourceFileName.toLowerCase());

        if (potentialSourceFiles.length > 0) {
            const [, foundSourcePath] = potentialSourceFiles[0];
            const expectedTestPath = calculateExpectedTestPath(foundSourcePath, options);
            const firstIncorrectSegment = findFirstIncorrectSegment(testFilePath, expectedTestPath, options);

            return {
                type: AnalysisErrorType.InvalidDirectoryStructure,
                message: firstIncorrectSegment ? 
                    `Test file has incorrect path segment: '${firstIncorrectSegment}'` :
                    'Test file is in wrong directory',
                sourceFilePath: foundSourcePath,
                actualTestPath: testFilePath,
                expectedTestPath: expectedTestPath
            };
        }

        return {
            type: AnalysisErrorType.InvalidDirectoryStructure,
            message: `Source file not found`
        };
    }

    // Get the relative paths from their respective roots
    const expectedTestPath = calculateExpectedTestPath(sourceFilePath, options);
    const firstIncorrectSegment = findFirstIncorrectSegment(testFilePath, expectedTestPath, options);

    if (firstIncorrectSegment || path.normalize(testFilePath) !== path.normalize(expectedTestPath)) {
        return {
            type: AnalysisErrorType.InvalidDirectoryStructure,
            message: firstIncorrectSegment ? 
                `Test file has incorrect path segment: '${firstIncorrectSegment}'` :
                'Test file is in wrong directory',
            sourceFilePath: sourceFilePath,
            actualTestPath: testFilePath,
            expectedTestPath: expectedTestPath
        };
    }

    return null;
}

function findFirstIncorrectSegment(actualPath: string, expectedPath: string, options: AnalyzerOptions): string | null {
    const actualRelative = path.relative(options.testRoot, actualPath);
    const expectedRelative = path.relative(options.testRoot, expectedPath);
    
    const actualSegments = actualRelative.split(/[\\/]/).filter(s => s !== '');
    const expectedSegments = expectedRelative.split(/[\\/]/).filter(s => s !== '');
    
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

function calculateExpectedTestPath(sourceFilePath: string, options: AnalyzerOptions): string {
    const relativeSourcePath = path.relative(options.srcRoot, path.dirname(sourceFilePath));
    const sourceSegments = relativeSourcePath.split(path.sep);
    const testSegments = [...sourceSegments];

    // Add the test project suffix to the first directory
    if (testSegments.length > 0) {
        testSegments[0] = testSegments[0] + options.testProjectSuffix;
    }

    const sourceFileName = path.basename(sourceFilePath);
    const testFileName = sourceFileName.replace(path.extname(sourceFileName), '') + 
        options.testFileSuffix + path.extname(sourceFileName);

    return path.join(
        options.testRoot,
        ...testSegments,
        testFileName
    );
}

async function analyzeMissingTests(sourceFiles: string[], testFiles: string[], options: AnalyzerOptions): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const testFileMap = new Map<string, string>();

    // Create a map of test base names (without suffix) to their full paths
    for (const testFile of testFiles) {
        const baseName = path.basename(testFile, path.extname(testFile))
            .replace(new RegExp(`${options.testFileSuffix}$`), '');
        testFileMap.set(baseName, testFile);
    }
    
    for (const sourceFile of sourceFiles) {
        const sourceBaseName = path.basename(sourceFile, path.extname(sourceFile));
        const expectedTestFile = testFileMap.get(sourceBaseName);

        if (!expectedTestFile) {
            const expectedTestPath = calculateExpectedTestPath(sourceFile, options);

            results.push({
                testFile: path.basename(expectedTestPath),
                testFilePath: path.resolve(expectedTestPath),
                errors: [{
                    type: AnalysisErrorType.MissingTest,
                    message: `Missing test file for source file: ${path.resolve(sourceFile)}`
                }]
            });
        }
    }
    
    return results;
} 