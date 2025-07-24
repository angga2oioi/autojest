#!/usr/bin/env node
//@ts-check

const { getConfig, getDirectoryToTest, getOutputDirectory } = require("./lib/config");
const { getUntestedFiles,  getAllSourceFiles } = require("./lib/scanner");
const { createTestFile, rerunAllTest, runCoverage } = require("./lib/runner");

const start = async () => {

    try {

        const directory = await getDirectoryToTest()
        const testDir = await getOutputDirectory()

        const { connection, model } = await getConfig();

        const untestedFiles = await getUntestedFiles(directory);
        
        await createTestFile(connection, untestedFiles, model, testDir)
        
        const sourceFiles = await getAllSourceFiles(directory)
        await rerunAllTest(sourceFiles,  testDir, connection, model)

        await runCoverage(directory, testDir, sourceFiles, connection, model)

        console.info("🎉 All files already have tests.");

        process.exit(0);
    } catch (e) {
        console.error(e)
    }

}

start()