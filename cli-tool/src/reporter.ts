import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { ConsoleReporter as SharedConsoleReporter, AnalysisResult, AnalysisErrorType } from '@test-filestructure-linter/shared';

/**
 * Console reporter for displaying analysis results in the terminal.
 * Provides progress bar and formatted output of analysis results.
 */
export class ConsoleReporter {
    private readonly progressBar: cliProgress.SingleBar;
    private readonly sharedReporter: SharedConsoleReporter;

    constructor() {
        this.sharedReporter = new SharedConsoleReporter();
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
            this.sharedReporter.reportResults(results, totalFiles);
        }
    }

    /**
     * Report only fixable files for interactive mode
     */
    private reportFixableFiles(results: AnalysisResult[]): void {
        const fixableFiles = results.filter(r => 
            r.errors.some(e => 
                e.type === AnalysisErrorType.InvalidDirectoryStructure &&
                e.actualTestPath &&
                e.expectedTestPath &&
                e.sourceFilePath
            )
        );

        if (fixableFiles.length === 0) {
            console.log(chalk.yellow('\nNo fixable files found.'));
            return;
        }

        console.log(chalk.cyan(`\nFound ${fixableFiles.length} fixable files`));
        console.log(chalk.gray('Files will be shown in pages of 10. Select files to fix in each page.\n'));
    }
} 