import path from 'path';
import chalk from 'chalk';
import fs from 'fs/promises';
import { execSync } from 'child_process';

const packageVersionRegex = new RegExp('(d{1}).(d{1}).(d{1})');
const EXCLUDED_FILE_PATHS = ['**/node_modules/**', '**/test/**'];

/**
 * Updates a package to its latest version
 * @param {Object} request - The package update request
 * @param {string} request.packageName - Name of the package to update
 * @param {string} [request.newVersion] - Specified version to update the package to
 * @param {string} [request.dir] - Optional subdirectory to search in
 * @param {boolean} [request.apply] - Whether to run 'npm install' after updating
 * @param {string} [request.test] - Whether to run 'npm test' after installing
 * @returns {Promise<void>}
 */
export async function updatePackage(request) {
    try {
        const updateVersion = await getPackageVersionOrLatest(
            request.packageName,
            request.newVersion
        );
        const files = await getManifestFiles(request.dir);

        await validateManifestFileExists(files);
        await updateManifests({ ...request, newVersion: updateVersion }, files);
    } catch (error) {
        console.error(chalk.red('Failed to update package: '), error);
    }
}

/**
 * Gets all package.json files in the specified directory
 * @param {string} [subdirectory] - Optional subdirectory to search in
 * @returns {Promise<string[]>} - Array of file paths
 */
async function getManifestFiles(subdirectory) {
    const searchPath = subdirectory
        ? path.join(process.cwd(), subdirectory)
        : process.cwd();
    const filePattern = path.join(searchPath, '**', 'package.json');
    const files = [];

    console.log(
        chalk.white(`Searching for package.json files in ${filePattern}...`)
    );
    for await (const file of fs.glob(filePattern, {
        exclude: EXCLUDED_FILE_PATHS,
    })) {
        files.push(file);
    }

    return files;
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
            `Completed update for ${files.length} discovered package.json file(s)`
        )
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
                `Manifest at ${file} does not contain the package ${request.packageName}`
            )
        );
        return;
    }

    const dependencies = getDependencies(manifest);
    const currentVersion = dependencies.runtime[request.packageName]
        ? dependencies.runtime[request.packageName]
        : dependencies.dev[request.packageName];
    console.log(
        chalk.white(
            `Versions in file ${file} [current | update]: [${currentVersion} | ${request.newVersion}]`
        )
    );

    if (isVersionMatching(currentVersion, request.newVersion)) {
        console.log(
            chalk.yellow(
                `Manifest at ${file} matched update version; skipping update...`
            )
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
        chalk.white('No valid version provided; defaulting to latest...')
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
        request: { packageName, apply, test },
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

    await fs.writeFile(file, JSON.stringify(newManifest, null, 2), 'utf8');

    console.log(
        chalk.green(
            `Updated ${packageName} to ^${version} in package.json of file ${file}`
        )
    );

    if (apply || test) {
        const directory = getDirectory(file);

        console.log(chalk.white(`Installing dependencies of ${file}...`));
        execSync(`npm install`, {
            encoding: 'utf8',
            cwd: directory,
        });
        console.log(chalk.green(`Install completed for ${file}...`));

        if (test) {
            console.log(chalk.white(`Running tests in ${file}...`));
            execSync(`npm test`, {
                encoding: 'utf8',
                cwd: directory,
            });
            console.log(chalk.green(`Tests passed for ${file}...`));
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
