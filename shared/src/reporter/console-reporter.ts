import chalk from 'chalk';
import { SingleBar } from 'cli-progress';
import { AnalysisResult, AnalysisError } from '../analyzer/types';

export class ConsoleReporter {
    private progressBar: SingleBar | null = null;

    startProgress(total: number): void {
        this.progressBar = new SingleBar({
            format: 'Analyzing files |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Files',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591'
        });
        this.progressBar.start(total, 0);
    }

    updateProgress(value: number): void {
        this.progressBar?.update(value);
    }

    stopProgress(): void {
        this.progressBar?.stop();
        this.progressBar = null;
    }

    reportResults(results: AnalysisResult[]): void {
        if (results.length === 0) {
            console.log(chalk.green('\n✓ No issues found'));
            return;
        }

        console.log(chalk.yellow(`\n! Found ${results.length} files with issues:\n`));

        for (const result of results) {
            console.log(chalk.cyan(`File: ${result.testFilePath}`));
            
            for (const error of result.errors) {
                console.log(chalk.red(`  ✗ ${error.message}`));
            }
            console.log('');
        }
    }
} 