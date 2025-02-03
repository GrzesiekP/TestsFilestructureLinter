#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { createInterface } from 'readline';
import { 
    analyzeProject, 
    ConsoleReporter, 
    AnalyzerOptions, 
    DEFAULT_OPTIONS, 
    fixDirectoryStructure, 
    isFixable,
    AnalysisErrorType 
} from '@test-filestructure-linter/shared';

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
    .option('--fix <path>', 'Fix a specific test file')
    .option('-i, --interactive', 'Interactive mode - select which file to fix')
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

            if (results.length > 0) {
                if (options.fix) {
                    // Fix specific file
                    const testPath = path.resolve(options.fix);
                    const fixable = await isFixable(testPath, results);
                    
                    if (fixable.isFixable && fixable.fix) {
                        console.log(chalk.cyan('\nFixing file...'));
                        const result = await fixable.fix();
                        console.log(chalk.green(`\n✓ Fixed file:`));
                        console.log(chalk.gray(`  Moved: ${result.from} → ${result.to}`));
                    } else {
                        console.error(chalk.red(`\nError: ${fixable.error}`));
                        process.exit(1);
                    }
                } else if (options.interactive) {
                    // Interactive mode
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
                        process.exit(1);
                    }

                    console.log(chalk.cyan('\nFixable files:'));
                    fixableFiles.forEach((file, index) => {
                        console.log(chalk.gray(`  ${index + 1}. ${file.testFile}`));
                    });

                    const rl = createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });

                    const answer = await new Promise<string>(resolve => {
                        rl.question(chalk.cyan('\nEnter the number of the file to fix (or q to quit): '), resolve);
                    });
                    rl.close();

                    if (answer.toLowerCase() === 'q') {
                        process.exit(0);
                    }

                    const fileIndex = parseInt(answer) - 1;
                    if (isNaN(fileIndex) || fileIndex < 0 || fileIndex >= fixableFiles.length) {
                        console.error(chalk.red('\nError: Invalid selection'));
                        process.exit(1);
                    }

                    const selectedFile = fixableFiles[fileIndex];
                    const fixable = await isFixable(selectedFile.testFilePath, results);
                    
                    if (fixable.isFixable && fixable.fix) {
                        console.log(chalk.cyan('\nFixing file...'));
                        const result = await fixable.fix();
                        console.log(chalk.green(`\n✓ Fixed file:`));
                        console.log(chalk.gray(`  Moved: ${result.from} → ${result.to}`));
                    } else {
                        console.error(chalk.red(`\nError: ${fixable.error}`));
                        process.exit(1);
                    }
                } else if (options.fixAll) {
                    console.log(chalk.cyan('\nFixing directory structure issues...'));
                    const fixedFiles = await fixDirectoryStructure(results, analyzerOptions);
                    if (fixedFiles.length > 0) {
                        console.log(chalk.green(`\n✓ Fixed ${fixedFiles.length} files:`));
                        for (const { from, to } of fixedFiles) {
                            console.log(chalk.gray(`  Moved: ${from} → ${to}`));
                        }
                    }
                } else {
                    process.exit(1);
                }
            }
        } catch (error) {
            console.error(chalk.red('\nError:'), error instanceof Error ? error.message : 'An unknown error occurred');
            process.exit(1);
        }
    });

program.parse(); 