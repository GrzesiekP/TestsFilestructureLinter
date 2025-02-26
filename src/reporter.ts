import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { ConsoleReporter as CoreConsoleReporter, AnalysisResult, AnalysisErrorType } from './core';

/**
 * Console reporter for displaying analysis results in the terminal.
 * Provides progress bar and formatted output of analysis results.
 */
export class ConsoleReporter {
    private readonly progressBar: cliProgress.SingleBar;
    private readonly coreReporter: CoreConsoleReporter;

    constructor() {
        this.coreReporter = new CoreConsoleReporter();
        this.progressBar = new cliProgress.SingleBar({
            format: chalk.cyan('Analyzing |') + '{bar}' + chalk.cyan('| {percentage}% || {value}/{total} files'),
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true
        });
    }

    /**
     * Start the progress bar with the given total number of files to analyze.
     */
    public startProgress(total: number): void {
        this.progressBar.start(total, 0);
    }

    /**
     * Update the progress bar with the current number of analyzed files.
     */
    public updateProgress(value: number): void {
        this.progressBar.update(value);
    }

    /**
     * Stop and clear the progress bar.
     */
    public stopProgress(): void {
        this.progressBar.stop();
        console.log(''); // Add newline after progress bar
    }

    /**
     * Report analysis results to the console with colored output.
     */
    public reportResults(results: AnalysisResult[], totalFiles: number, isInteractive = false): void {
        if (isInteractive) {
            this.reportFixableFiles(results);
        } else {
            this.coreReporter.reportResults(results, totalFiles);
        }
    }

    /**
     * Report only fixable files for interactive mode
     */
    private reportFixableFiles(results: AnalysisResult[]): void {
        // Filter out files that have multiple source files
        const multipleSourceFiles = results.filter(r => 
            r.errors.some(e => 
                e.type === AnalysisErrorType.InvalidDirectoryStructure &&
                e.sourceFilePath &&
                e.sourceFilePath.split(',').length > 1
            )
        );

        // Filter fixable files (those with single source file)
        const fixableFiles = results.filter(r => 
            r.errors.some(e => 
                e.type === AnalysisErrorType.InvalidDirectoryStructure &&
                e.sourceFilePath &&
                e.sourceFilePath.split(',').length === 1 &&
                e.actualTestPath &&
                e.expectedTestPath
            )
        );

        if (fixableFiles.length === 0) {
            console.log(chalk.yellow('\nNo fixable files found.'));
            
            if (multipleSourceFiles.length > 0) {
                console.log(chalk.yellow('\nThe following files have multiple matching source files and cannot be fixed automatically:'));
                multipleSourceFiles.forEach(file => {
                    const error = file.errors.find(e => e.type === AnalysisErrorType.InvalidDirectoryStructure);
                    if (error?.sourceFilePath) {
                        console.log(chalk.gray(`\n${file.testFile}:`));
                        const sourcePaths = error.sourceFilePath.split(',').map(p => p.trim());
                        sourcePaths.forEach(path => {
                            console.log(chalk.gray(`  Found in: ${path}`));
                        });
                    }
                });
            }
            return;
        }

        console.log(chalk.cyan(`\nFound ${fixableFiles.length} fixable files`));
        console.log(chalk.gray('Files will be shown in pages of 10. Select files to fix in each page.\n'));
    }
} 