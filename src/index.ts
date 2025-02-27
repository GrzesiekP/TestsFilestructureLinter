#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { AnalysisError, AnalysisErrorType, AnalysisResult, AnalyzerOptions, DEFAULT_OPTIONS } from './types';
import { ConsoleReporter } from './console-reporter';
import { Analyzer } from './analyzer';
import { Fixer } from './fixer';
const { MultiSelect } = require('enquirer');

// Import package.json for version information
const packageJson = require('../package.json');

const program = new Command();

program
    .name('test-filestructure-linter')
    .description('CLI tool for analyzing test file structure')
    .version(packageJson.version)
    .requiredOption('-s, --src-root <path>', 'Source files root directory')
    .requiredOption('-t, --test-root <path>', 'Test files root directory')
    .option('-e, --ext <ext>', 'File extension to analyze', DEFAULT_OPTIONS.fileExtension)
    .option('-n, --name', 'Enable filename validation')
    .option('-d, --dir', 'Enable directory structure validation')
    .option('-m, --missing', 'Enable validation of missing test files')
    .option('--test-suffix <suffix>', 'Test file suffix', DEFAULT_OPTIONS.testFileSuffix)
    .option('--test-project-suffix <suffix>', 'Test project suffix', DEFAULT_OPTIONS.testProjectSuffix)
    .option('--ignore-directories <directories>', 'Comma-separated list of directories to ignore', (val) => {
        if (!val) return DEFAULT_OPTIONS.ignoreDirectories;
        // Handle quoted values properly by replacing quotes and splitting by comma
        return val.replace(/["']/g, '').split(',').map(s => s.trim()).filter(Boolean);
    })
    .option('--ignore-files <files>', 'Comma-separated list of files to ignore', (val) => {
        if (!val) return DEFAULT_OPTIONS.ignoreFiles;
        // Handle quoted values properly by replacing quotes and splitting by comma
        return val.replace(/["']/g, '').split(',').map(s => s.trim()).filter(Boolean);
    })
    .option('-a, --all', 'Fix all directory structure issues by moving files')
    .option('-f, --fix <path>', 'Fix a specific test file')
    .option('-i, --interactive', 'Interactive mode - select files to fix')
    .action(async (options) => {
        const reporter = new ConsoleReporter();
        
        try {
            // Convert paths to absolute
            const srcRoot = path.resolve(options.srcRoot);
            const testRoot = path.resolve(options.testRoot);
            
            console.log(chalk.gray('\nPaths:'));
            console.log(chalk.gray(`Source root: ${srcRoot}`));
            console.log(chalk.gray(`Test root: ${testRoot}`));

            if (options.ignoreDirectories && options.ignoreDirectories.length > 0) {
                console.log(chalk.gray(`Ignored directories: ${options.ignoreDirectories.join(', ')}`));
            }
            
            if (options.ignoreFiles && options.ignoreFiles.length > 0) {
                console.log(chalk.gray(`Ignored files: ${options.ignoreFiles.join(', ')}`));
            }
            
            const analyzerOptions: AnalyzerOptions = {
                srcRoot,
                testRoot,
                fileExtension: options.ext,
                validateFileName: options.name === true,
                validateDirectoryStructure: options.dir === true,
                validateMissingTests: options.missing === true,
                testFileSuffix: options.testSuffix,
                testProjectSuffix: options.testProjectSuffix,
                ignoreDirectories: options.ignoreDirectories || DEFAULT_OPTIONS.ignoreDirectories,
                ignoreFiles: options.ignoreFiles || DEFAULT_OPTIONS.ignoreFiles
            };
            
            console.log(chalk.cyan('\nAnalyzing test structure...'));
            const analyzer = new Analyzer();
            const fixer = new Fixer();
            const { results, totalFiles } = await analyzer.analyzeProject(analyzerOptions);
            reporter.reportResults(results, totalFiles, options.interactive);

            if (results.length > 0) {
                if (options.fix) {
                    // Fix specific file
                    const testPath = path.resolve(options.fix);
                    const fixable = await fixer.isFixable(testPath, results);
                    
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
                    const fixableFiles = results.filter((r: AnalysisResult) => 
                        r.errors.some((e: AnalysisError) => 
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

                    const PAGE_SIZE = 10;
                    let currentPage = 0;
                    const totalPages = Math.ceil(fixableFiles.length / PAGE_SIZE);
                    let selectedPaths: string[] = [];

                    try {
                        while (currentPage < totalPages) {
                            const startIdx = currentPage * PAGE_SIZE;
                            const endIdx = Math.min(startIdx + PAGE_SIZE, fixableFiles.length);
                            const currentFiles = fixableFiles.slice(startIdx, endIdx);

                            console.log(chalk.cyan(`\nPage ${currentPage + 1} of ${totalPages}`));
                            
                            const prompt = new MultiSelect({
                                name: 'files',
                                message: chalk.cyan('Select files to fix'),
                                hint: '(Use arrow keys and space to select, enter to confirm)',
                                choices: currentFiles.map((file: AnalysisResult) => {
                                    const error = file.errors.find((e: AnalysisError) => 
                                        e.type === AnalysisErrorType.InvalidDirectoryStructure
                                    );
                                    const currentPath = path.relative(testRoot, file.testFilePath);
                                    const targetPath = error?.expectedTestPath ? 
                                        path.relative(testRoot, error.expectedTestPath) :
                                        '';
                                    
                                    const pathDisplay = targetPath ? 
                                        `\n    ${chalk.yellow('📂')} Current:  ${chalk.gray(currentPath)}` +
                                        `\n    ${chalk.cyan('📂')} Expected: ${chalk.gray(targetPath)}` :
                                        chalk.gray(currentPath);

                                    return {
                                        name: file.testFilePath,
                                        value: file.testFilePath,
                                        message: `${chalk.white(file.testFile)}${pathDisplay}`
                                    };
                                })
                            });

                            const pageSelection = await prompt.run();
                            if (pageSelection && pageSelection.length > 0) {
                                selectedPaths.push(...pageSelection);
                            }

                            if (currentPage < totalPages - 1) {
                                const continuePrompt = new (require('enquirer')).Toggle({
                                    message: chalk.cyan('Continue to next page?'),
                                    enabled: 'Yes',
                                    disabled: 'No'
                                });

                                const shouldContinue = await continuePrompt.run();
                                if (!shouldContinue) {
                                    break;
                                }
                            }

                            currentPage++;
                        }
                    } catch (err) {
                        // User canceled the selection
                        console.log(chalk.gray('\nSelection canceled.'));
                        process.exit(0);
                    }
                    
                    if (!selectedPaths || selectedPaths.length === 0) {
                        console.log(chalk.yellow('\nNo files selected for fixing.'));
                        process.exit(0);
                    }

                    console.log(chalk.cyan('\nFixing selected files...'));
                    let fixedCount = 0;
                    
                    for (const testPath of selectedPaths) {
                        const fixable = await fixer.isFixable(testPath, results);
                        if (fixable.isFixable && fixable.fix) {
                            try {
                                const result = await fixable.fix();
                                console.log(chalk.green(`✓ Fixed: ${path.basename(result.from)}`));
                                console.log(chalk.gray(`  Moved: ${result.from} → ${result.to}`));
                                fixedCount++;
                            } catch (err) {
                                console.error(chalk.red(`✗ Failed to fix ${path.basename(testPath)}: ${err instanceof Error ? err.message : 'Unknown error'}`));
                            }
                        }
                    }
                    
                    if (fixedCount > 0) {
                        console.log(chalk.green(`\n✓ Fixed ${fixedCount} files`));
                    }
                } else if (options.all) {
                    console.log(chalk.cyan('\nFixing directory structure issues...'));
                    const fixedFiles = await fixer.fixDirectoryStructure(results, analyzerOptions);
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