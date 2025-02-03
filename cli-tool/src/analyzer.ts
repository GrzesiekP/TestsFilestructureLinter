import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import { AnalysisResult, AnalyzerOptions, AnalysisErrorType, DEFAULT_OPTIONS } from '../../shared/src/analyzer/types';

const globPromise = promisify(glob) as (pattern: string, options?: any) => Promise<string[]>;

export async function analyzeProject(
    projectPath: string,
    options: AnalyzerOptions = DEFAULT_OPTIONS
): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const testRoot = path.join(projectPath, options.testRoot);
    const sourceRoot = path.join(projectPath, options.srcRoot);

    console.log('Analyzing project:');
    console.log('- Project path:', projectPath);
    console.log('- Test root:', testRoot);
    console.log('- Source root:', sourceRoot);

    try {
        // Find all test files
        const testFiles = await findTestFiles(testRoot, options);
        console.log('Found test files:', testFiles);
        
        // Analyze each test file
        for (const testFile of testFiles) {
            const result = await analyzeTestFile(testFile, testRoot, projectPath, options);
            if (result.errors.length > 0) {
                results.push(result);
            }
        }

        // Check for missing tests if enabled
        if (options.enableMissingTestValidation) {
            const sourceFiles = await findSourceFiles(sourceRoot, options);
            console.log('Found source files:', sourceFiles);
            const missingTestResults = await analyzeMissingTests(sourceFiles, testFiles, projectPath, options);
            results.push(...missingTestResults);
        }

    } catch (error) {
        console.error('Error during analysis:', error instanceof Error ? error.message : 'Unknown error');
    }

    return results;
}

async function findTestFiles(testRoot: string, options: AnalyzerOptions): Promise<string[]> {
    const pattern = `**/*${options.testFileSuffixes[0]}${options.fileExtension}`;
    const ignore = options.ignoredDirectories.map((dir: string) => `**/${dir}/**`);
    
    console.log('Finding test files:');
    console.log('- Pattern:', pattern);
    console.log('- Ignore:', ignore);
    console.log('- Test root:', testRoot);

    try {
        const files = await globPromise(pattern, {
            cwd: testRoot,
            ignore,
            absolute: true,
            nodir: true
        });
        console.log('Found files:', files);
        return files;
    } catch (error) {
        console.error('Error finding test files:', error);
        return [];
    }
}

async function findSourceFiles(sourceRoot: string, options: AnalyzerOptions): Promise<string[]> {
    const pattern = `**/*${options.fileExtension}`;
    const ignore = [
        ...options.ignoredDirectories.map((dir: string) => `**/${dir}/**`),
        `**/*${options.testFileSuffixes[0]}${options.fileExtension}`
    ];
    
    try {
        const files = await globPromise(pattern, {
            cwd: sourceRoot,
            ignore,
            absolute: true,
            nodir: true
        });
        return files;
    } catch (error) {
        console.error('Error finding source files:', error);
        return [];
    }
}

async function analyzeTestFile(
    testFilePath: string,
    testRoot: string,
    projectPath: string,
    options: AnalyzerOptions
): Promise<AnalysisResult> {
    const result: AnalysisResult = {
        testFile: path.basename(testFilePath),
        testFilePath,
        errors: []
    };

    // Validate file name
    const fileNameError = validateFileName(testFilePath, options);
    if (fileNameError) {
        result.errors.push(fileNameError);
    }

    // Validate directory structure
    const structureError = await validateDirectoryStructure(testFilePath, testRoot, projectPath, options);
    if (structureError) {
        result.errors.push(structureError);
    }

    return result;
}

function validateFileName(testFilePath: string, options: AnalyzerOptions) {
    const fileName = path.basename(testFilePath);
    const hasValidSuffix = options.testFileSuffixes.some((suffix: string) => 
        fileName.toLowerCase().endsWith(suffix.toLowerCase() + options.fileExtension)
    );

    if (!hasValidSuffix) {
        return {
            type: AnalysisErrorType.InvalidFileName,
            message: `File name must end with one of: ${options.testFileSuffixes.join(', ')}`
        };
    }

    return null;
}

async function validateDirectoryStructure(
    testFilePath: string,
    testRoot: string,
    projectPath: string,
    options: AnalyzerOptions
) {
    const relativeTestPath = path.relative(testRoot, testFilePath);
    const testDirPath = path.dirname(relativeTestPath);
    const fileName = path.basename(testFilePath);
    
    // Extract project name and relative path
    const pathParts = testDirPath.split(path.sep);
    const testProjectName = pathParts[0]; // e.g., "Application.Tests"
    const sourceProjectName = testProjectName.replace(options.testProjectSuffix, ''); // e.g., "Application"
    const relativePath = pathParts.slice(1).join(path.sep); // e.g., "Mappers" or "Services/WrongLocation"
    
    // Remove the test suffix from the file name
    const testedClassName = fileName.replace(options.testFileSuffixes[0] + options.fileExtension, '');
    
    // Expected source file path
    const expectedSourcePath = path.join(
        projectPath,
        options.srcRoot,
        sourceProjectName,
        relativePath,
        testedClassName + options.fileExtension
    );

    console.log('Validating directory structure:');
    console.log('- Test file:', testFilePath);
    console.log('- Test project:', testProjectName);
    console.log('- Source project:', sourceProjectName);
    console.log('- Relative path:', relativePath);
    console.log('- Expected source path:', expectedSourcePath);

    try {
        await fs.access(expectedSourcePath);
        return null;
    } catch {
        return {
            type: AnalysisErrorType.InvalidDirectoryStructure,
            message: `Source file not found at expected location: ${expectedSourcePath}`
        };
    }
}

async function analyzeMissingTests(
    sourceFiles: string[],
    testFiles: string[],
    projectPath: string,
    options: AnalyzerOptions
): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const sourceFile of sourceFiles) {
        const fileName = path.basename(sourceFile);
        const className = fileName.replace(options.fileExtension, '');
        const expectedTestFileName = className + options.testFileSuffixes[0] + options.fileExtension;

        // Skip if the test file would be excluded
        if (options.excludedTestFiles.includes(className)) {
            continue;
        }

        // Check if test file exists
        const hasTest = testFiles.some(testFile => 
            path.basename(testFile) === expectedTestFileName
        );

        if (!hasTest) {
            const expectedTestPath = path.join(
                projectPath,
                options.testRoot,
                path.relative(path.join(projectPath, options.srcRoot), path.dirname(sourceFile)),
                expectedTestFileName
            );

            results.push({
                testFile: fileName,
                testFilePath: sourceFile,
                errors: [{
                    type: AnalysisErrorType.MissingTest,
                    message: `No test file found for: ${fileName}`
                }]
            });
        }
    }

    return results;
} 