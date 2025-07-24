#!/usr/bin/env node
//@ts-check

const { getConfig, getDirectoryToTest, getOutputDirectory } = require("./lib/config");
const { getUntestedFiles,  getAllSourceFiles } = require("./lib/scanner");
const { createTestFile, rerunAllTest, runCoverage } = require("./lib/runner");

const start = async () => {

    try {

        const directory = await getDirectoryToTest()
        const testDir = await getOutputDirectory()

        const { connection, model, maxRetries } = await getConfig();

        const untestedFiles = await getUntestedFiles(directory);
        await createTestFile(connection, untestedFiles, directory, model, maxRetries, testDir)

        const sourceFiles = await getAllSourceFiles(directory)
        await rerunAllTest(sourceFiles, directory, testDir, connection, model, maxRetries)

        // await runCoverage(directory, testDir, sourceFiles, connection, model, maxRetries)

        console.info("🎉 All files already have tests.");

        process.exit(0);
    } catch (e) {
        console.error(e)
    }

}

start()