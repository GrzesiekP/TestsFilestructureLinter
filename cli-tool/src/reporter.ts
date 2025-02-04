import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { ConsoleReporter as SharedConsoleReporter, AnalysisResult } from '@test-filestructure-linter/shared';

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
    public reportResults(results: AnalysisResult[], totalFiles: number): void {
        this.sharedReporter.reportResults(results, totalFiles);
    }
} 