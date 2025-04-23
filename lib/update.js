import path from 'path';
import chalk from 'chalk';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { getAbsolutePaths, getManifestAsString, parseCommaSeparatedList } from './utils.js';

const getPackageManager = (selected) => {
    const packageManager = selected.toLowerCase().trim();
    if (!['npm', 'yarn'].includes(packageManager)) {
        throw Error('Unrecognized package manager selected');
    }

    return packageManager;
};
const packageVersionRegex = new RegExp('(d{1}).(d{1}).(d{1})');
const DEFAULT_EXCLUDED_FILE_PATHS = ['**/node_modules/**', '**/test/**'];

/**
 * Updates a package to its latest version
 * @param {Object} request - The package update request
 * @param {string} request.packageName - Name of the package to update
 * @param {string} [request.newVersion] - Specified version to update the package to
 * @param {string} [request.includeDirs] - Directories to search for manifests
 * @param {string} [request.excludeDirs] - Directories to exclude for search
 * @param {boolean} [request.apply] - Whether to run 'npm install' after updating
 * @param {string} [request.test] - Whether to run 'npm test' after installing
 * @param {string} [request.packageManager] - Package manager to use for install & test
 * @returns {Promise<void>}
 */
export async function updatePackage(request) {
    try {
        const packageManager = getPackageManager(request.packageManager);
        const updateVersion = await getPackageVersionOrLatest(
            request.packageName,
            request.newVersion,
        );
        const files = await getManifestFiles(
            request.includeDirs ? parseCommaSeparatedList(request.includeDirs) : null,
            request.excludeDirs ? parseCommaSeparatedList(request.excludeDirs) : null,
        );

        await validateManifestFileExists(files);
        await updateManifests(
            {
                ...request,
                packageManager,
                newVersion: updateVersion,
            },
            files,
        );
    } catch (error) {
        console.error(chalk.red('Failed to update package: '), error);
    }
}

/**
 * Gets all package.json files in the specified directory
 * @param {string[]} [includedSubDirectories] - Optional subdirectories to search in
 * @param {string[]} [excludedSubDirectories] - Optional subdirectories to ignore
 * @returns {Promise<string[]>} - Array of file paths
 */
async function getManifestFiles(includedSubDirectories, excludedSubDirectories) {
    // if no subdirectories are specified, search the current directory
    const filePatterns = (includedSubDirectories ? getAbsolutePaths(includedSubDirectories) : [process.cwd()])
        .map((dir) => path.join(dir, '**', 'package.json'));
    const excludedFilePaths = getAbsolutePaths(excludedSubDirectories)
        .map((dir) => path.join(dir, '**')).concat(DEFAULT_EXCLUDED_FILE_PATHS);

    const files = new Set();

    console.log(
        chalk.yellow(`Ignoring the following file paths for update: ${excludedFilePaths.join(',')}...`),
    );
    for (const filePattern of filePatterns) {
        console.log(
            chalk.white(`Searching for package.json files in ${filePattern}...`),
        );
        for await (const file of fs.glob(filePattern, {
            exclude: excludedFilePaths,
        })) {
            files.add(file);
        }
    }

    return Array.from(files);
}

/**
 * Validates that at least one package.json file was found
 * @param {string[]} files - Array of file paths
 * @returns {Promise<void>}
 */
async function validateManifestFileExists(files) {
    if (files.length === 0) {
        throw Error('No package.json files found in the current directory.');
    }
}

/**
 * Update packages in all found package.json files
 * @param {Object} request - The package update request
 * @param {string[]} files - Array of package.json file paths
 * @returns {Promise<void>}
 */
async function updateManifests(request, files) {
    for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const manifest = JSON.parse(content);

        await updateManifest(request, file, manifest);
    }

    console.log(
        chalk.green(
            `Completed update for ${files.length} discovered package.json file(s)`,
        ),
    );
}

/**
 * Update a specific package in a package.json file
 * @param {Object} request - The package update request
 * @param {string} file - Path to the package.json file
 * @param {Object} manifest - Parsed package.json content
 * @returns {Promise<void>}
 */
async function updateManifest(request, file, manifest) {
    if (!hasPackageAsDependency(request.packageName, manifest)) {
        console.log(
            chalk.yellow(
                `Manifest at ${file} does not contain the package ${request.packageName}`,
            ),
        );
        return;
    }

    const dependencies = getDependencies(manifest);
    const currentVersion = dependencies.runtime[request.packageName]
        ? dependencies.runtime[request.packageName]
        : dependencies.dev[request.packageName];
    console.log(
        chalk.white(
            `Versions in file ${file} [current | update]: [${currentVersion} | ${request.newVersion}]`,
        ),
    );

    if (isVersionMatching(currentVersion, request.newVersion)) {
        console.log(
            chalk.yellow(
                `Manifest at ${file} matched update version; skipping update...`,
            ),
        );
        return;
    }

    await applyUpdate({
        request,
        file,
        manifest,
        dependencies,
        version: request.newVersion,
    });
}

/**
 * Manifest has the package as a dependency
 * @param {string} packageName - Name of the package
 * @param {Object} manifest - Parsed package.json content
 * @returns {boolean}
 */
function hasPackageAsDependency(packageName, manifest) {
    const inDependencies =
        manifest.dependencies && packageName in manifest.dependencies;
    const inDevDependencies =
        manifest.devDependencies && packageName in manifest.devDependencies;

    return inDependencies || inDevDependencies;
}

/**
 * Gets dependencies as object from the manifest
 * @param {Object} manifest - Parsed package.json content
 * @returns {Object} - Object containing runtime and dev dependencies
 */
function getDependencies(manifest) {
    return {
        runtime: manifest.dependencies || {},
        dev: manifest.devDependencies || {},
    };
}

/**
 * Validates and returns the package version or gets the latest from npm
 * @param {string} packageName - Name of the package
 * @param {string} version - Version of the package
 * @returns {Promise<string>} - Latest version string
 */
async function getPackageVersionOrLatest(packageName, version) {
    if (version && packageVersionRegex.test(version)) {
        return version;
    }

    console.log(
        chalk.white('No valid version provided; defaulting to latest...'),
    );
    const latestVersion = execSync(`npm view ${packageName} version`, {
        encoding: 'utf8',
    }).trim();

    return latestVersion;
}

/**
 * Checks if the current version matches the latest version
 * @param {string} semanticVersion - Current version (may include ^ or ~)
 * @param {string} version - Latest version
 * @returns {boolean} - Whether versions match
 */
function isVersionMatching(semanticVersion, version) {
    return semanticVersion.replace(/[\^~]/, '') === version;
}

/**
 * Applies the update to the package.json
 * @param {Object} command - Command object with update details
 * @returns {Promise<void>}
 */
async function applyUpdate(command) {
    const {
        request: { packageName, apply, test, packageManager },
        version,
        file,
        manifest,
        dependencies,
    } = command;

    let newManifest;

    if (packageName in dependencies.runtime) {
        newManifest = {
            ...manifest,
            dependencies: {
                ...dependencies.runtime,
                [packageName]: `^${version}`,
            },
        };
    } else {
        newManifest = {
            ...manifest,
            devDependencies: {
                ...dependencies.dev,
                [packageName]: `^${version}`,
            },
        };
    }

    await fs.writeFile(file, getManifestAsString(newManifest), 'utf8');

    console.log(
        chalk.green(
            `Updated ${packageName} to ^${version} in package.json of file ${file}`,
        ),
    );

    if (apply || test) {
        const directory = getDirectory(file);

        console.log(chalk.white(`Installing dependencies in ${file}...`));
        execSync(`${packageManager} install`, {
            encoding: 'utf8',
            cwd: directory,
        });
        console.log(chalk.green(`Install completed in ${file}`));

        if (test) {
            console.log(chalk.white(`Running tests in ${file}...`));
            execSync(`${packageManager} test -- --passWithNoTests`, {
                encoding: 'utf8',
                cwd: directory,
            });
            console.log(chalk.green(`Tests passed in ${file}`));
        }
    }
}

/**
 * Get the parent directory of the file
 * @param {string} file - File path
 * @returns {string}
 */
function getDirectory(file) {
    return file.split('/').slice(0, -1).join('/');
}
