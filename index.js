#!/usr/bin/env node
//@ts-check

const jaci = require("jaci");
const { getConfig } = require("./lib/config");
const { getUntestedFiles } = require("./lib/scanner");
const { generateAndFixTest } = require("./lib/testgen");
const { runTest } = require("./lib/runner");
const OpenAI = require("openai");
const path = require("path")

const start = async () => {

    try {
        const directory = await jaci.string("directory : ", { required: true });
        const { connection, model, maxRetries } = await getConfig();

        const list = await getUntestedFiles(directory);

        if (list.length > 0) {
            const client = new OpenAI(connection);

            for (const relativePath of list) {
                const fullPath = path.join(directory, relativePath);

                await generateAndFixTest(fullPath, {
                    client,
                    model,
                    maxRetries,
                    runTest,
                });
            }

            console.info("✅ Done.");
        }

        console.info("🎉 All files already have tests.");
        process.exit(0);
    } catch (e) {
        console.error(e)
    }

}

start()