import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { AnalysisResult, AnalysisError } from '../../shared/src/analyzer/types';

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

    public startProgress(total: number): void {
        this.progressBar.start(total, 0);
    }

    public updateProgress(value: number): void {
        this.progressBar.update(value);
    }

    public stopProgress(): void {
        this.progressBar.stop();
        console.log(''); // Add newline after progress bar
    }

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