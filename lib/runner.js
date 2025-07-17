// lib/runner.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Runs a Jest test file in a temp dir and returns whether it passed.
 * @param {string} filepath - The path
 * * @param {string} testCode - The generated test code
 * @returns {Promise<{ passed: boolean, error?: string }>}
 */
async function runTest(filepath, testCode) {
    fs.writeFileSync(filepath, testCode);

    try {
        execSync(`npx jest ${filepath} --runInBand --verbose`, {
            stdio: "pipe",
            encoding: "utf8",
        });
        return { passed: true, error: null };
    } catch (err) {
        const errorOutput = err.stdout || err.message;
        return { passed: false, error: errorOutput };
    }
}

module.exports = {
    runTest,
};