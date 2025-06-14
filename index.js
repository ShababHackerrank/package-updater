#! /usr/bin/env node

import { Argument, Command, Option } from 'commander';
import { updatePackage } from './lib/update.js';
import chalk from 'chalk';

const program = new Command();

program
    .name('package-updater')
    .description(
        'A simple CLI tool for updating packages across lambdas in the hrw-lambda repo'
    )
    .version('1.0.0');

program
    .command('update')
    .description(
        'Update a package to the specified version number. Will choose the latest version by default.'
    )
    .addArgument(new Argument('<package>'))
    .addOption(
        new Option(
            '-n, --new-version [string]',
            'semantic version to be upgraded to; does not accept ranges'
        )
    )
    .addOption(
        new Option(
            '-i, --include-dirs [paths]',
            'comma separated list of sub-directories to recursively search in'
        )
    )
    .addOption(
        new Option(
            '-e, --exclude-dirs [paths]',
            'comma separated list of sub-directories to ignore'
        )
    )
    .addOption(
        new Option(
            '-a, --apply [boolean]',
            "apply package.json changes with 'npm install'"
        ).default(false)
    )
    .addOption(
        new Option(
            '-t, --test [boolean]',
            "run 'npm test' post-install; will automatically apply package.json changes before"
        ).default(false)
    )
    .addOption(
        new Option(
            '-p, --package-manager [string]',
            "package manager to use; options are: 'npm' and 'yarn'"
        ).default('npm')
    )
    .action(async (pkg, options) => {
        console.log(
            chalk.yellow(
                `Updating package ${pkg} with options ${JSON.stringify(
                    options
                )}`
            )
        );
        await updatePackage({
            ...options,
            packageName: pkg,
        });
    });

program.parseAsync(process.argv);
