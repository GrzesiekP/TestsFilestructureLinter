import chalk from 'chalk';
import { AnalysisResult, AnalysisError, AnalysisErrorType } from './types';
import * as path from 'path';

interface Summary {
    totalFiles: number;
    issuesCount: number;
    issuesByType: Map<AnalysisErrorType, number>;
}

export class ConsoleReporter {
    private summary: Summary = {
        totalFiles: 0,
        issuesCount: 0,
        issuesByType: new Map()
    };

    reportResults(results: AnalysisResult[], totalAnalyzedFiles: number): void {
        this.summary.totalFiles = totalAnalyzedFiles;
        this.summary.issuesCount = results.length;
        
        if (results.length === 0) {
            console.log(chalk.green('\n✓ No issues found'));
            this.displaySummary();
            return;
        }

        console.log(chalk.yellow(`\n! Found ${results.length} files with issues:\n`));

        // Group results by error type
        const byErrorType = new Map<AnalysisErrorType, AnalysisResult[]>();
        
        for (const result of results) {
            const primaryError = result.errors[0]; // Use the first error for grouping
            if (primaryError) {
                const existing = byErrorType.get(primaryError.type) || [];
                existing.push(result);
                byErrorType.set(primaryError.type, existing);
                
                // Update summary
                const count = this.summary.issuesByType.get(primaryError.type) || 0;
                this.summary.issuesByType.set(primaryError.type, count + 1);
            }
        }

        // Display results by error type
        for (const [errorType, typeResults] of byErrorType) {
            console.log(chalk.yellow(`\n${errorType}:`));
            
            for (const result of typeResults) {
                console.log(chalk.white(result.testFile));
                for (const error of result.errors) {
                    if (error.type === AnalysisErrorType.InvalidDirectoryStructure && error.sourceFilePath) {
                        const paths = [error.sourceFilePath];
                        if (error.actualTestPath) paths.push(error.actualTestPath);
                        if (error.expectedTestPath) paths.push(error.expectedTestPath);
                        const commonBasePath = this.getCommonBasePath(paths);
                        
                        const sourceRelative = this.getRelativePath(error.sourceFilePath, commonBasePath);
                        console.log(chalk.gray(`  📄 Source:   ${sourceRelative}`));
                        
                        if (error.actualTestPath && error.expectedTestPath) {
                            const incorrectSegment = this.extractIncorrectSegment(error.message);
                            const actualRelative = this.getRelativePath(error.actualTestPath, commonBasePath);
                            const expectedRelative = this.getRelativePath(error.expectedTestPath, commonBasePath);
                            
                            if (incorrectSegment) {
                                const highlightedPath = this.highlightIncorrectSegment(actualRelative, incorrectSegment);
                                console.log(chalk.gray(`  ❌ Current:  `) + highlightedPath);
                                console.log(chalk.gray(`  ✅ Expected: ${expectedRelative}`));
                            } else {
                                console.log(chalk.gray(`  ❌ Current:  ${actualRelative}`));
                                console.log(chalk.gray(`  ✅ Expected: ${expectedRelative}`));
                            }
                        }
                    } else if (error.type === AnalysisErrorType.MissingTest) {
                        const sourceFile = error.message.match(/source file: (.+)$/)?.[1];
                        if (sourceFile) {
                            const sourceRelative = this.getRelativePath(sourceFile, result.testRoot ? path.dirname(result.testRoot) : undefined);
                            console.log(chalk.gray(`  📄 Missing test for source: ${sourceRelative}`));
                        } else {
                            console.log(chalk.gray(`  📄 ${error.message}`));
                        }
                    }
                }
                console.log('');
            }
        }

        this.displaySummary();
    }

    private displaySummary(): void {
        console.log(chalk.cyan('\nSummary:'));
        console.log(chalk.gray(`Total files analyzed: ${this.summary.totalFiles}`));
        console.log(chalk.gray(`Files with issues: ${this.summary.issuesCount}`));
        
        if (this.summary.issuesCount > 0) {
            console.log(chalk.gray('\nIssues by type:'));
            for (const [type, count] of this.summary.issuesByType) {
                console.log(chalk.gray(`  ${type}: ${count}`));
            }
        }
        console.log('');
    }

    private extractIncorrectSegment(message: string): string | null {
        const match = message.match(/incorrect path segment: '([^']+)'/);
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
                return '.';
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
} 