import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { AnalysisResult, AnalysisError } from '@test-filestructure-linter/shared';

/**
 * Console reporter for displaying analysis results in the terminal.
 * Provides progress bar and formatted output of analysis results.
 */
export class ConsoleReporter {
    private readonly progressBar: cliProgress.SingleBar;

    constructor() {
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
    public report(results: AnalysisResult[]): void {
        if (results.length === 0) {
            console.log(chalk.green('✔ No issues found!'));
            return;
        }

        console.log(chalk.yellow(`\n⚠ Found ${results.length} file(s) with issues:\n`));

        results.forEach(result => {
            console.log(chalk.cyan(`File: ${result.testFilePath}`));
            result.errors.forEach((error: AnalysisError) => {
                console.log(chalk.red(`  ✖ ${error.message}`));
            });
            console.log(''); // Add newline between files
        });

        // Print summary
        const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
        console.log(chalk.bold('\nSummary:'));
        console.log(chalk.dim('├─ ') + `Files with issues: ${chalk.yellow(results.length)}`);
        console.log(chalk.dim('└─ ') + `Total issues: ${chalk.yellow(totalErrors)}\n`);
    }
} 