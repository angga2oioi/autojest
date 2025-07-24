// lib/scanner.js
const fg = require("fast-glob");

/**
 * Checks whether a matching test file exists for the given source file.
 * @param {string} sourceFile - The relative path to the source file.
 * @param {string[]} allTestFiles - List of all discovered test file paths.
 * @returns {boolean}
 */
function hasMatchingTestFile(sourceFile, allTestFiles) {
    const srcParts = sourceFile
        .replace(/\\+/g, "/")
        .replace(/\.(js|ts)x?$/, "")
        .split("/")
        .filter((p) => p !== "src");

    return allTestFiles.some((testPath) => {
        const testParts = testPath
            .replace(/\\+/g, "/")
            .replace(/\.test\.(js|ts)x?$/, "")
            .split("/")
            .filter((p) => !["test", "__tests__"].includes(p));

        return srcParts.join("/").endsWith(testParts.join("/"));
    });
}

/**
 * Scans for source files without matching test files.
 * @param {string} directory - Root directory to scan from.
 * @returns {Promise<string[]>} - List of untested source file paths.
 */
async function getUntestedFiles(directory) {
    const allSourceFiles = await fg(["**/*.{js,ts,jsx,tsx}"], {
        cwd: directory,
        ignore: ["**/*.test.*", "**/__tests__/**", "node_modules/**", "coverage/**", "dist/**", "build/**"],
    });

    const allTestFiles = await fg(["**/*.test.{js,ts,jsx,tsx}", "**/*.spec.{js,ts,jsx,tsx}"], {
        cwd: process.cwd(),
        ignore: ["node_modules/**"],
    });

    const untested = allSourceFiles.filter((src) => !hasMatchingTestFile(`${directory}/${src}`, allTestFiles));

    return untested?.map((n) => `${directory}/${n}`);
}

async function getAllSourceFiles(directory) {
    const allSourceFiles = await fg(["**/*.{js,ts,jsx,tsx}"], {
        cwd: directory,
        ignore: ["**/*.test.*", "**/__tests__/**", "node_modules/**", "coverage/**", "dist/**", "build/**"],
    });

    return allSourceFiles?.map((n) => `${directory}/${n}`);
}

module.exports = {
    getAllSourceFiles,
    getUntestedFiles,
};
