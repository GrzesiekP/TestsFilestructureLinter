import chalk from 'chalk';
import { AnalysisResult, AnalysisErrorType } from './types';
import * as path from 'path';

export class ConsoleReporter {
    reportResults(results: AnalysisResult[], totalFiles: number, isInteractive = false): void {
        if (results.length === 0) {
            console.log(chalk.green('\n✓ No issues found'));
            console.log(chalk.gray(`\n📊 Total files analyzed: ${chalk.white(totalFiles)}`));
            return;
        }

        if (isInteractive) {
            // In interactive mode, don't show the full report
            return;
        }

        console.log(chalk.yellow(`\n! Found ${results.length} files with issues:\n`));

        // Group errors by type
        const errorCounts = {
            directoryStructure: 0,
            filename: 0,
            missingTests: 0
        };

        for (const result of results) {
            console.log(chalk.white(result.testFile));
            for (const error of result.errors) {
                console.log(chalk.red(`  ${error.type}`));
                
                // Count error types
                if (error.type === AnalysisErrorType.InvalidDirectoryStructure) {
                    errorCounts.directoryStructure++;
                } else if (error.type === AnalysisErrorType.InvalidFileName) {
                    errorCounts.filename++;
                } else if (error.type === AnalysisErrorType.MissingTest) {
                    errorCounts.missingTests++;
                }
                
                if (error.type === AnalysisErrorType.InvalidDirectoryStructure && error.sourceFilePath) {
                    const paths = [error.sourceFilePath];
                    if (error.actualTestPath) paths.push(error.actualTestPath);
                    if (error.expectedTestPath) paths.push(error.expectedTestPath);
                    const commonBasePath = this.getCommonBasePath(paths);
                    
                    // Check if we have multiple source files
                    if (error.sourceFilePath.includes(',')) {
                        const sourceFiles = error.sourceFilePath.split(',').map(p => p.trim());
                        console.log(chalk.gray(`  📄 Source:   Multiple source files found:`));
                        for (const sourcePath of sourceFiles) {
                            // Ensure path starts with ./src
                            const sourceRelative = this.formatToStandardPath(sourcePath, 'src');
                            console.log(chalk.gray(`    - ${sourceRelative}`));
                        }
                        
                        // Display current test file location
                        if (error.actualTestPath) {
                            // Ensure path starts with ./tests
                            const actualRelative = this.formatToStandardPath(error.actualTestPath, 'tests');
                            console.log(chalk.gray(`  🧪 Current:  ${actualRelative}`));
                        }
                    } else {
                        const sourceRelative = this.getRelativePath(error.sourceFilePath, commonBasePath);
                        console.log(chalk.gray(`  📄 Source:   ${sourceRelative}`));
                    }
                    
                    if (error.actualTestPath && error.expectedTestPath) {
                        const incorrectSegment = this.extractIncorrectSegment(error.message);
                        const actualRelative = this.getRelativePath(error.actualTestPath, commonBasePath);
                        const expectedRelative = this.getRelativePath(error.expectedTestPath, commonBasePath);
                        
                        if (incorrectSegment) {
                            const highlightedPath = this.highlightIncorrectSegment(actualRelative, incorrectSegment);
                            console.log(chalk.gray(`  🧪 Current:  `) + highlightedPath);
                            console.log(chalk.gray(`  ✨ Expected: ${expectedRelative}`));
                        } else {
                            console.log(chalk.gray(`  🧪 Current:  ${actualRelative}`));
                            console.log(chalk.gray(`  ✨ Expected: ${expectedRelative}`));
                        }
                    }
                } else if (error.type === AnalysisErrorType.InvalidDirectoryStructure) {
                    // For directory structure errors without source files
                    if (error.actualTestPath) {
                        // Ensure path starts with ./tests
                        const actualRelative = this.formatToStandardPath(error.actualTestPath, 'tests');
                        console.log(chalk.gray(`  🧪 Current:  ${actualRelative}`));
                    } else if (result.testFilePath) {
                        // Use the result's test file path if actualTestPath is not available
                        // Ensure path starts with ./tests
                        const testPath = this.formatToStandardPath(result.testFilePath, 'tests');
                        console.log(chalk.gray(`  🧪 Current:  ${testPath}`));
                    }
                } else if (error.type === AnalysisErrorType.MissingTest) {
                    const sourceFile = error.message.match(/source file: (.+)$/)?.[1];
                    if (sourceFile) {
                        const sourceRelative = this.getRelativePath(sourceFile, result.testRoot ? path.dirname(result.testRoot) : undefined);
                        console.log(chalk.gray(`  📄 Source:   ${sourceRelative}`));
                        console.log(chalk.gray(`  🧪 Missing test file`));
                    } else {
                        console.log(chalk.gray(`  🧪 ${error.message}`));
                    }
                }
            }
            console.log('');
        }

        // Print summary
        console.log(chalk.bold('\nSummary:'));
        if (errorCounts.directoryStructure > 0) {
            console.log(chalk.gray(`  📁 Directory structure issues: ${chalk.yellow(errorCounts.directoryStructure)}`));
        }
        if (errorCounts.filename > 0) {
            console.log(chalk.gray(`  📝 Filename issues: ${chalk.yellow(errorCounts.filename)}`));
        }
        if (errorCounts.missingTests > 0) {
            console.log(chalk.gray(`  ❓ Missing tests: ${chalk.yellow(errorCounts.missingTests)}`));
        }
        console.log(chalk.gray(`  📊 Total files with issues: ${chalk.yellow(results.length)}`));
        console.log(chalk.gray(`  📊 Total files analyzed: ${chalk.white(totalFiles)}`));
        if (totalFiles > 0) {
            const percentage = ((results.length / totalFiles) * 100).toFixed(1);
            console.log(chalk.gray(`  📈 Issue rate: ${chalk.yellow(percentage)}%`));
        }
    }

    private extractIncorrectSegment(message: string): string | null {
        const regex = /incorrect path segment: '([^']+)'/;
        const match = regex.exec(message);
        return match ? match[1] : null;
    }

    private formatPath(pathStr: string): string {
        return pathStr.split(/[\\/]/).join('/');
    }

    private highlightIncorrectSegment(pathStr: string, incorrectSegment: string): string {
        const segments = pathStr.split('/');
        const result = segments
            .map(segment => {
                if (segment === incorrectSegment) {
                    return chalk.red.bold(segment);
                }
                if (segment.endsWith(incorrectSegment)) {
                    const prefix = segment.slice(0, -incorrectSegment.length);
                    return chalk.gray(prefix) + chalk.red.bold(incorrectSegment);
                }
                if (segment.includes(incorrectSegment)) {
                    const parts = segment.split(incorrectSegment);
                    return chalk.gray(parts[0]) + chalk.red.bold(incorrectSegment) + chalk.gray(parts[1]);
                }
                return chalk.gray(segment);
            })
            .join(chalk.gray('/'));
        return result;
    }

    private getRelativePath(filePath: string, basePath: string | undefined): string {
        if (!basePath) {
            return this.formatPath(filePath);
        }
        try {
            const relative = path.relative(basePath, filePath);
            if (relative === '') {
                return 'Source file not found';
            }
            if (relative.startsWith('..')) {
                return this.formatPath(filePath);
            }
            if (path.isAbsolute(relative)) {
                return this.formatPath(relative);
            }
            return './' + this.formatPath(relative);
        } catch {
            return this.formatPath(filePath);
        }
    }

    private getCommonBasePath(paths: string[]): string | undefined {
        if (paths.length === 0) {
            return undefined;
        }
        const segments = paths.map(p => p.split(/[\\/]/));
        const minLength = Math.min(...segments.map(s => s.length));
        let commonPath = [];
        
        for (let i = 0; i < minLength; i++) {
            const segment = segments[0][i];
            if (segments.every(s => s[i] === segment)) {
                commonPath.push(segment);
            } else {
                break;
            }
        }
        
        return commonPath.length > 0 ? commonPath.join(path.sep) : undefined;
    }

    // New helper method to format paths consistently
    private formatToStandardPath(filePath: string, rootDir: 'src' | 'tests'): string {
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
            .replace(/\\/g, '/')  // Convert backslashes to forward slashes
            .replace(/\/\//g, '/'); // Remove any double slashes
            
        // Remove duplicate src or tests directories
        result = result.replace(`/${rootDir}/${rootDir}/`, `/${rootDir}/`);
        return result;
    }
} 