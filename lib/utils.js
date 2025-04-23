import path from 'path';

/**
 * @param {string} values
 * @returns {string[]}
 */
export function parseCommaSeparatedList(values) {
    return values.replace(/\s+/g, '').split(',');
}

/**
 * @param {string[]} directories
 * @returns {string[]}
 */
export function getAbsolutePaths(directories) {
    return directories ? directories.map((dir) => path.join(process.cwd(), dir)) : [];
}

/**
 * @param {Object} manifest
 * @returns {string}
 */
export function getManifestAsString(manifest) {
    return JSON.stringify(manifest, null, 2) + '\n';
}
