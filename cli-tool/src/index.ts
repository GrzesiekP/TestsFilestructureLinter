#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { analyzeProject, ConsoleReporter, AnalyzerOptions, DEFAULT_OPTIONS, fixDirectoryStructure } from '@test-filestructure-linter/shared';

const program = new Command();

program
    .name('test-structure-linter')
    .description('CLI tool for analyzing test file structure')
    .version('0.1.0')
    .option('-s, --src-root <path>', 'Source files root directory', DEFAULT_OPTIONS.srcRoot)
    .option('-t, --test-root <path>', 'Test files root directory', DEFAULT_OPTIONS.testRoot)
    .option('-e, --file-extension <ext>', 'File extension to analyze', DEFAULT_OPTIONS.fileExtension)
    .option('--no-validate-filename', 'Disable filename validation')
    .option('--no-validate-directory', 'Disable directory structure validation')
    .option('--no-validate-missing', 'Disable missing tests validation')
    .option('--test-suffix <suffix>', 'Test file suffix', DEFAULT_OPTIONS.testFileSuffix)
    .option('--test-project-suffix <suffix>', 'Test project suffix', DEFAULT_OPTIONS.testProjectSuffix)
    .option('--fix-all', 'Fix all directory structure issues by moving files to their expected locations')
    .action(async (options) => {
        const reporter = new ConsoleReporter();
        
        try {
            // Convert paths to absolute
            const srcRoot = path.resolve(options.srcRoot);
            const testRoot = path.resolve(options.testRoot);
            
            console.log(chalk.gray('\nPaths:'));
            console.log(chalk.gray(`Source root: ${srcRoot}`));
            console.log(chalk.gray(`Test root: ${testRoot}`));
            
            const analyzerOptions: AnalyzerOptions = {
                srcRoot,
                testRoot,
                fileExtension: options.fileExtension,
                validateFileName: options.validateFilename !== false,
                validateDirectoryStructure: options.validateDirectory !== false,
                validateMissingTests: options.validateMissing !== false,
                testFileSuffix: options.testSuffix,
                testProjectSuffix: options.testProjectSuffix
            };
            
            console.log(chalk.cyan('\nAnalyzing test structure...'));
            const { results, totalFiles } = await analyzeProject(analyzerOptions);
            reporter.reportResults(results);
            
            if (results.length > 0 && options.fixAll) {
                console.log(chalk.cyan('\nFixing directory structure issues...'));
                const fixedFiles = await fixDirectoryStructure(results, analyzerOptions);
                if (fixedFiles.length > 0) {
                    console.log(chalk.green(`\n✓ Fixed ${fixedFiles.length} files:`));
                    for (const { from, to } of fixedFiles) {
                        console.log(chalk.gray(`  Moved: ${from} → ${to}`));
                    }
                }
            }
            
            if (results.length > 0 && !options.fixAll) {
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('\nError:'), error instanceof Error ? error.message : 'An unknown error occurred');
            process.exit(1);
        }
    });

program.parse(); 