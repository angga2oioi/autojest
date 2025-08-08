#!/usr/bin/env node
//@ts-check

const { getConfig, getDirectoryToTest, getOutputDirectory } = require("./lib/config");
const { getUntestedFiles,  getAllSourceFiles } = require("./lib/scanner");
const { createTestFile, rerunAllTest, runCoverage } = require("./lib/runner");

const start = async () => {

    try {

        await getConfig();
        const directory = await getDirectoryToTest()
        const testDir = await getOutputDirectory()

        const untestedFiles = await getUntestedFiles(directory);
        
        await createTestFile(untestedFiles,testDir)
        
        const sourceFiles = await getAllSourceFiles(directory)
        await rerunAllTest(sourceFiles,  testDir)

        await runCoverage(directory, testDir, sourceFiles)

        console.info("🎉 All files already have tests.");

        process.exit(0);
    } catch (e) {
        console.error(e)
    }

}

start()