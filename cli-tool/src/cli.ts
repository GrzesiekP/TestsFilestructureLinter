#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as figlet from 'figlet';
import { analyzeProject } from './analyzer';
import { AnalyzerOptions, DEFAULT_OPTIONS } from '../../shared/src/analyzer/types';
import { ConsoleReporter } from './reporter';

const program = new Command();

console.log(chalk.cyan(figlet.textSync('Test Filestructure Linter', { horizontalLayout: 'full' })));

program
    .name('test-filestructure-lint')
    .description('CLI tool for analyzing test file structure in .NET projects')
    .version('0.1.0')
    .option('-s, --src-root <path>', 'Path to source code root directory', DEFAULT_OPTIONS.srcRoot)
    .option('-t, --test-root <path>', 'Path to test root directory', DEFAULT_OPTIONS.testRoot)
    .option('-e, --file-extension <ext>', 'File extension to analyze', DEFAULT_OPTIONS.fileExtension)
    .option('-ts, --test-suffixes <suffixes...>', 'Valid test file suffixes', DEFAULT_OPTIONS.testFileSuffixes)
    .option('-tp, --test-project-suffix <suffix>', 'Test project suffix', DEFAULT_OPTIONS.testProjectSuffix)
    .option('-i, --ignored-dirs <dirs...>', 'Directories to ignore', DEFAULT_OPTIONS.ignoredDirectories)
    .option('-x, --excluded-files <files...>', 'Test files to exclude', DEFAULT_OPTIONS.excludedTestFiles)
    .option('-m, --missing-test-validation', 'Enable missing test validation', false)
    .argument('[directory]', 'Directory to analyze', '.')
    .action(async (directory: string, options) => {
        try {
            const analyzerOptions: AnalyzerOptions = {
                srcRoot: options.srcRoot,
                testRoot: options.testRoot,
                fileExtension: options.fileExtension,
                testFileSuffixes: options.testSuffixes,
                testProjectSuffix: options.testProjectSuffix,
                ignoredDirectories: options.ignoredDirs,
                excludedTestFiles: options.excludedFiles,
                enableMissingTestValidation: options.missingTestValidation
            };

            const reporter = new ConsoleReporter();
            const results = await analyzeProject(directory, analyzerOptions);
            reporter.report(results);

        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'An unknown error occurred');
            process.exit(1);
        }
    });

program.parse(); 