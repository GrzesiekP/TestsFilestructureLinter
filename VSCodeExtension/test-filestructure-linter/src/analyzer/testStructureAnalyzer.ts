import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AnalysisError, AnalysisErrorType, AnalysisResult, AnalyzerOptions, DEFAULT_OPTIONS } from './types';

export class TestStructureAnalyzer {
    private readonly options: AnalyzerOptions;

    constructor(options: Partial<AnalyzerOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    private getIgnoredDirectories(): string[] {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<string[]>('ignoredDirectories') ?? ['bin', 'obj'];
    }

    private getTestFileSuffixes(): string[] {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<string[]>('testFileSuffixes') ?? ['Tests'];
    }

    private getTestProjectSuffix(): string {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<string>('testProjectSuffix') ?? '';
    }

    private getSourceRoot(): string {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<string>('sourceRoot') ?? '';
    }

    private getTestRoot(): string {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<string>('testRoot') ?? '';
    }

    private isExperimentalFixesEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<boolean>('enableExperimentalFixes') ?? false;
    }

    private isMissingTestValidationEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('testFilestructureLinter');
        return config.get<boolean>('enableMissingTestValidation') ?? false;
    }

    private isIgnoredDirectory(dirName: string): boolean {
        return this.getIgnoredDirectories().includes(dirName);
    }

    private isTestFile(fileName: string): boolean {
        const fileNameWithoutExtension = path.basename(fileName, this.options.fileExtension);
        return this.getTestFileSuffixes().some(suffix => 
            fileNameWithoutExtension.toLowerCase().endsWith(suffix.toLowerCase())
        );
    }

    private isTestProject(dirName: string): boolean {
        const suffix = this.getTestProjectSuffix();
        return suffix ? dirName.endsWith(suffix) : false;
    }

    private getTestedClassName(testFileName: string): string {
        const fileNameWithoutExtension = path.basename(testFileName, this.options.fileExtension);
        const suffix = this.getTestFileSuffixes().find(suffix => 
            fileNameWithoutExtension.toLowerCase().endsWith(suffix.toLowerCase())
        );
        
        if (!suffix) {
            return fileNameWithoutExtension;
        }

        return fileNameWithoutExtension.slice(0, -suffix.length);
    }

    private async findSourceFiles(workspacePath: string): Promise<string[]> {
        const sourceFiles: string[] = [];
        const sourceRoot = path.join(workspacePath, this.getSourceRoot());
        
        try {
            await fs.promises.access(sourceRoot);
            await this.findSourceFilesRecursive(sourceRoot, sourceFiles);
        } catch (error) {
            console.warn(`Source root directory not found: ${sourceRoot}`);
        }

        return sourceFiles;
    }

    private async findSourceFilesRecursive(dirPath: string, sourceFiles: string[]): Promise<void> {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (this.isIgnoredDirectory(entry.name)) {
                continue;
            }

            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await this.findSourceFilesRecursive(fullPath, sourceFiles);
            } else if (entry.isFile() && 
                      entry.name.endsWith(this.options.fileExtension) &&
                      !this.isTestFile(entry.name)) {
                sourceFiles.push(fullPath);
            }
        }
    }

    private getExpectedTestPath(sourceFilePath: string, workspacePath: string, testProjectPath: string): string {
        const sourceRoot = path.join(workspacePath, this.getSourceRoot());
        const relativeSourcePath = path.relative(sourceRoot, path.dirname(sourceFilePath));
        const sourceFileName = path.basename(sourceFilePath, this.options.fileExtension);
        const testFileName = sourceFileName + this.getTestFileSuffixes()[0] + this.options.fileExtension;
        
        // Get source project name from the relative path
        const pathParts = relativeSourcePath.split(path.sep);
        const sourceProjectName = pathParts[0]; // e.g., "Application"
        
        // Construct test project name
        const testProjectName = sourceProjectName + this.getTestProjectSuffix(); // e.g., "Application.Tests"
        
        // Remove the project name from the relative path
        const remainingPath = pathParts.slice(1).join(path.sep);
        
        return path.join(
            workspacePath,
            this.getTestRoot(),
            testProjectName,
            remainingPath,
            testFileName
        );
    }

    public async analyzeWorkspace(workspacePath: string): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        const testRoot = path.join(workspacePath, this.getTestRoot());
        
        try {
            await fs.promises.access(testRoot);
            const testProjects = await this.findTestProjects(testRoot);

            // First, analyze test files
            for (const testProject of testProjects) {
                const testFiles = await this.findTestFiles(testProject);
                for (const testFile of testFiles) {
                    const result = await this.analyzeTestFile(testFile, testProject, workspacePath);
                    if (result.errors.length > 0) {
                        results.push(result);
                    }
                }
            }

            // Then, if enabled, check for missing tests
            if (this.isMissingTestValidationEnabled()) {
                const sourceFiles = await this.findSourceFiles(workspacePath);
                const missingTestResults = await this.analyzeMissingTests(sourceFiles, testProjects, workspacePath, results);
                results.push(...missingTestResults);
            }

        } catch (error) {
            console.warn(`Test root directory not found: ${testRoot}`);
        }

        return results;
    }

    private async findTestProjects(workspacePath: string): Promise<string[]> {
        const projects: string[] = [];
        const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory() && !this.isIgnoredDirectory(entry.name)) {
                const fullPath = path.join(workspacePath, entry.name);
                if (this.isTestProject(entry.name)) {
                    projects.push(fullPath);
                } else {
                    // Recursively search in subdirectories
                    const subProjects = await this.findTestProjects(fullPath);
                    projects.push(...subProjects);
                }
            }
        }

        return projects;
    }

    private async findTestFiles(projectPath: string): Promise<string[]> {
        const testFiles: string[] = [];
        const entries = await fs.promises.readdir(projectPath, { withFileTypes: true });

        for (const entry of entries) {
            if (this.isIgnoredDirectory(entry.name)) {
                continue;
            }

            const fullPath = path.join(projectPath, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await this.findTestFiles(fullPath);
                testFiles.push(...subFiles);
            } else if (entry.isFile() && 
                      entry.name.endsWith(this.options.fileExtension) && 
                      this.isTestFile(entry.name)) {
                testFiles.push(fullPath);
            }
        }

        return testFiles;
    }

    private async analyzeTestFile(testFilePath: string, testProjectPath: string, workspacePath: string): Promise<AnalysisResult> {
        const result: AnalysisResult = {
            testFile: path.basename(testFilePath),
            testFilePath,
            errors: []
        };

        // Validate file name matches class name
        const fileNameError = await this.validateFileName(testFilePath);
        if (fileNameError) {
            result.errors.push(fileNameError);
            return result; // Skip other validations if file name is wrong
        }

        // Get the class being tested
        const testFileName = path.basename(testFilePath);
        const testedClassName = this.getTestedClassName(testFileName);

        // Validate directory structure
        const structureError = await this.validateDirectoryStructure(testFilePath, testProjectPath, workspacePath, testedClassName);
        if (structureError) {
            result.errors.push(structureError);
        }

        return result;
    }

    private async validateFileName(testFilePath: string): Promise<AnalysisError | null> {
        const fileName = path.basename(testFilePath);
        const fileContent = await fs.promises.readFile(testFilePath, 'utf8');
        
        // Check if file ends with any of the configured test suffixes
        if (!this.isTestFile(fileName)) {
            const defaultSuffix = this.getTestFileSuffixes()[0];
            return {
                type: AnalysisErrorType.InvalidFileName,
                message: `File name must end with one of the configured test suffixes (${this.getTestFileSuffixes().join(', ')})`,
                suggestion: fileName.replace(this.options.fileExtension, '') + defaultSuffix + this.options.fileExtension
            };
        }

        // Find class name
        const classMatch = fileContent.match(/public\s+class\s+(\w+)/);
        if (!classMatch) {
            return {
                type: AnalysisErrorType.InvalidFileName,
                message: 'Could not find class definition in test file'
            };
        }

        const className = classMatch[1];
        if (fileName !== className + this.options.fileExtension) {
            return {
                type: AnalysisErrorType.InvalidFileName,
                message: `File name does not match class name. Expected: ${className}${this.options.fileExtension}, Found: ${fileName}`,
                suggestion: `Rename file to ${className}${this.options.fileExtension}`
            };
        }

        return null;
    }

    private async findSourceFileInWorkspace(workspacePath: string, testedClassName: string): Promise<string | null> {
        const searchPattern = `**/${testedClassName}${this.options.fileExtension}`;
        const ignoredDirs = this.getIgnoredDirectories();
        const files = await vscode.workspace.findFiles(
            searchPattern,
            `**/{${ignoredDirs.join(',')}}/**`
        );
        
        return files.length > 0 ? files[0].fsPath : null;
    }

    private async validateDirectoryStructure(
        testFilePath: string,
        testProjectPath: string,
        workspacePath: string,
        testedClassName: string
    ): Promise<AnalysisError | null> {
        const relativeTestPath = path.relative(testProjectPath, testFilePath);
        const sourceProjectName = path.basename(testProjectPath).replace(this.getTestProjectSuffix(), '');
        
        // Get the directory structure without the file name
        const relativeDir = path.dirname(relativeTestPath);
        const expectedSourcePath = path.join(
            workspacePath,
            this.getSourceRoot(),
            sourceProjectName,
            relativeDir,
            testedClassName + this.options.fileExtension
        );

        try {
            await fs.promises.access(expectedSourcePath);
            return null;
        } catch {
            // Check if the file exists in the correct location (without subdirectories)
            const expectedSimplePath = path.join(
                workspacePath,
                this.getSourceRoot(),
                sourceProjectName,
                testedClassName + this.options.fileExtension
            );

            try {
                await fs.promises.access(expectedSimplePath);
                if (relativeDir !== '.') {
                    return {
                        type: AnalysisErrorType.InvalidDirectoryStructure,
                        message: `Test file is in wrong directory. It should match the source file structure.`,
                        suggestion: `Move test file to: ${path.dirname(expectedSimplePath)}`
                    };
                }
                return null;
            } catch {
                // If source file is not found in expected locations, search in the entire workspace
                const foundSourcePath = await this.findSourceFileInWorkspace(workspacePath, testedClassName);
                if (foundSourcePath) {
                    return {
                        type: AnalysisErrorType.InvalidDirectoryStructure,
                        message: `Test file in invalid directory. Source file found in: ${foundSourcePath}`,
                        suggestion: `Move test file to match source file structure: ${path.dirname(expectedSourcePath)}`
                    };
                }

                return {
                    type: AnalysisErrorType.InvalidDirectoryStructure,
                    message: `Source file not found: ${testedClassName}${this.options.fileExtension}`,
                    suggestion: `Create source file at: ${expectedSourcePath}`
                };
            }
        }
    }

    private async analyzeMissingTests(
        sourceFiles: string[], 
        testProjects: string[], 
        workspacePath: string,
        existingResults: AnalysisResult[]
    ): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];

        for (const sourceFile of sourceFiles) {
            const sourceFileName = path.basename(sourceFile);
            const className = sourceFileName.replace(this.options.fileExtension, '');
            
            // Check each test project
            let testFileFound = false;
            let wrongLocationTestFile = existingResults.find(r => 
                r.errors.some(e => 
                    e.type === AnalysisErrorType.InvalidDirectoryStructure &&
                    path.basename(r.testFilePath, this.options.fileExtension).replace('Tests', '') === className
                )
            );

            if (wrongLocationTestFile) {
                results.push({
                    testFile: sourceFileName,
                    testFilePath: sourceFile,
                    errors: [{
                        type: AnalysisErrorType.MissingTest,
                        message: `Test file exists but is in wrong location: ${wrongLocationTestFile.testFilePath}`,
                        suggestion: 'Find the test file in the issues list above and use the Fix button to move it to the correct location'
                    }]
                });
                continue;
            }

            // Get the expected test path
            const expectedTestPath = this.getExpectedTestPath(sourceFile, workspacePath, testProjects[0]);
            try {
                await fs.promises.access(expectedTestPath);
                testFileFound = true;
            } catch {
                // Test file not found in expected location, try to find it with a more flexible search
                const testFileName = className + this.getTestFileSuffixes()[0] + this.options.fileExtension;
                const files = await vscode.workspace.findFiles(
                    `${this.getTestRoot()}/**/${testFileName}`,
                    `**/{${this.getIgnoredDirectories().join(',')}}/**`
                );
                
                if (files.length > 0) {
                    testFileFound = true;
                }
            }

            if (!testFileFound) {
                results.push({
                    testFile: sourceFileName,
                    testFilePath: sourceFile,
                    errors: [{
                        type: AnalysisErrorType.MissingTest,
                        message: `No test file found for: ${sourceFileName}`,
                        suggestion: `Create test file at: ${expectedTestPath}`
                    }]
                });
            }
        }

        return results;
    }
} 