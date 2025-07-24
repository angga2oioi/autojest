//@ts-check

// lib/runner.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const OpenAI = require("openai");
const { generateAndFixTest } = require("./testgen");
const jaci = require("jaci")


/**
 * Runs a Jest test file in a temp dir and returns whether it passed.
 * @param {string} filepath - The path
 * * @param {string} testCode - The generated test code
 * @returns {Promise<{ passed: boolean, error?: string }>}
 */
async function runTest(filepath, testCode = "") {
    if (testCode) {
        fs.writeFileSync(filepath, testCode);
    }


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

async function createTestFile(connection, untestedFiles,  model, testDir) {
    const client = new OpenAI(connection);

    if (untestedFiles.length > 0) {

        // Generate tests for each untested source
        for (const relativePath of untestedFiles) {
            const fullPath = path.join(process.cwd(), relativePath);
            const projectRoot = process.cwd();
            const sourceRelative = path.relative(projectRoot, fullPath).replace(/\\+/g, "/");
            
            await generateAndFixTest(fullPath, {
                client,
                model,
                runTest,
                testDir,
                relativePath: sourceRelative,
            });
        }
        console.info("✅ Tests generated.");

    }
}

async function rerunAllTest(sourceFiles,  testDir, connection, model) {
    console.info("Running all test.");
    const client = new OpenAI(connection);

    // Identify and fix failing tests
    for (const relativePath of sourceFiles) {
        const fullPath = path.join(process.cwd(), relativePath);
        const testRel = path.join(testDir, relativePath)
            .replace(/\\+/g, "/")
            .replace(/\.(js|ts)x?$/, ".test.$1");
        const testPath = path.join(process.cwd(), testRel);

        const code = fs.readFileSync(testPath)

        console.log(`Running test for ${fullPath}`)
        const { passed, error } = await runTest(testPath);
        if (!passed) {
            console.info(`🔄 Fixing test for ${relativePath}`);


            const fullPath = path.join(process.cwd(), relativePath);
            const projectRoot = process.cwd();
            const sourceRelative = path.relative(projectRoot, fullPath).replace(/\\+/g, "/");

            await generateAndFixTest(fullPath, {
                client,
                model,
                runTest,
                testDir,
                relativePath: sourceRelative,
                existingTestCode: code,
                existingError: error,
            });
        }

    }

}

async function runCoverage(directory, testDir, sourceFiles, connection, model) {

    try {
        execSync("npx jest --coverage --forceExit --passWithNoTests", { stdio: "inherit" });
    } catch (e) {
        console.error(e)

    }

    const client = new OpenAI(connection);
    // Run coverage and identify under-covered files

    const projectRoot = process.cwd();
    const covDir = path.join(projectRoot, "coverage");
    const summaryFile = path.join(covDir, "coverage-summary.json");
    const finalFile = path.join(covDir, "coverage-final.json");
    let coverageMap = {};
    if (fs.existsSync(summaryFile)) {
        const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
        for (const [file, data] of Object.entries(summary)) {
            const rel = file.replace(/\\\\+/g, "/");
            coverageMap[rel] = data.statements.pct;
        }
    } else if (fs.existsSync(finalFile)) {
        const raw = JSON.parse(fs.readFileSync(finalFile, "utf8"));
        for (const entry of Object.values(raw)) {
            const absPath = entry.path;
            let rel = path.relative(projectRoot, absPath).replace(/\\\\+/g, "/");
            const s = entry.s || {};
            const total = Object.keys(s).length;
            const covered = Object.values(s).filter(v => v > 0).length;
            const pct = total > 0 ? (covered * 100) / total : 100;
            coverageMap[rel] = pct;
        }
    } else {
        console.error("❌ No coverage report found.");
    }
    // Collect under-80% source files
    const undercovered = [];
    for (const srcRel of sourceFiles) {
        const fileRel = path.join(directory, srcRel).replace(/\\\\+/g, "/");
        const pct = coverageMap[fileRel];
        
        if (pct != null && pct < 80) {
            undercovered.push({ srcRel, pct });
        }
    }
    if (undercovered.length > 0) {
        console.info("⚠️  Source files under 80% coverage:");
        undercovered.forEach(({ srcRel, pct }) => console.info(` - ${srcRel}: ${pct.toFixed(2)}%`));
        const update = await jaci.confirm(
            "Update tests for these files? (Y/N)",
            { default: true, confirm: { true: "Y", false: "N" } }
        );
        if (update) {
            for (const { srcRel } of undercovered) {
                const fullPath = path.join(directory, srcRel);
                const projectRoot = process.cwd();
                const sourceRelative = path.relative(projectRoot, fullPath).replace(/\\+/g, "/");

                console.info(`🔄 Regenerating test for ${srcRel}`);
                await generateAndFixTest(fullPath, {
                    client,
                    model,
                    runTest,
                    testDir,
                    relativePath: sourceRelative,
                });
            }
            console.info("✅ Tests updated for under-covered files.");
        }
    } else {
        console.info("✅ All source files have at least 80% coverage.");
    }
}

module.exports = {
    runTest,
    createTestFile,
    rerunAllTest,
    runCoverage
};