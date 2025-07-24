// lib/testgen.js
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const { default: ora } = require('ora');

/**
 * Generates a unit test for a given source file using OpenAI.
 * Retries on failure using test run feedback.
 * @param {string} sourcePath - Absolute path to the source file.
 * @param {object} options
 * @param {OpenAI} options.client - Initialized OpenAI client
 * @param {string} options.model - Model name (e.g. "gpt-4")
 * @param {(code: string) => Promise<{ passed: boolean, error?: string }>} options.runTest - Function to run test code
 * @param {string} options.testDir - Relative directory path where test files will be written
 * @param {string} options.relativePath - Source file path relative to the scan root, used to preserve directory structure
 * @returns {Promise<void>}
 */
async function generateAndFixTest(sourcePath, { client, model, runTest, testDir, relativePath, existingTestCode, existingError }) {
    const spinner = ora(`Generate test for ${sourcePath}`).start();

    const projectRoot = process.cwd();
    const filename = path.basename(sourcePath);
    const sourceCode = fs.readFileSync(sourcePath, "utf8");
    const sourceRelative = path.relative(projectRoot, sourcePath).replace(/\\+/g, "/");
    const testRelative = path.join(testDir, relativePath)
        .replace(/\\+/g, "/")
        .replace(/\.(js|ts)x?$/, ".test.$1");
    const testPath = path.join(projectRoot, testRelative);

    const prompts = [];
    let testCode;

    if (existingTestCode != null && existingError != null) {
        prompts.push({
            role: "user",
            content: `Here is the existing test file at (project-relative): ${testRelative}\n\n${existingTestCode}`,
        });
        prompts.push({
            role: "user",
            content: `This test failed with error:\n\n${existingError}\n\nPlease revise the test to fix it.` +
                `Only respond with valid JavaScript test code.\n` +
                `Do **not** include any explanations, markdown, or headings.\n` +
                `You may use /* inline comments */ if needed inside the code.\n` +
                `The goal is **full branch coverage** of all exported functions/classes, including edge cases and error handling.\n\n`
        });
        testCode = await callOpenAI(client, model, prompts);
        prompts.push({ role: "assistant", content: testCode });
    } else {
        const initialPrompt =
            `You are an expert JavaScript/TypeScript testing assistant.\n\n` +
            `Your task: generate a **Jest unit test file** for the following source code.\n` +
            `The source file is located at (project-relative): ${sourceRelative}\n` +
            `The test file should be created at (project-relative): ${testRelative}\n` +
            `Only respond with valid JavaScript test code.\n` +
            `Do **not** include any explanations, markdown, or headings.\n` +
            `You may use /* inline comments */ if needed inside the code.\n` +
            `The goal is **full branch coverage** of all exported functions/classes, including edge cases and error handling.\n\n` +
            `Source file: ${filename}\n${sourceCode}\n`;
        prompts.push({ role: "user", content: initialPrompt });
        testCode = await callOpenAI(client, model, prompts);
        prompts.push({ role: "assistant", content: testCode });
    }

    let attempt = 0;
    while (true) {
        fs.mkdirSync(path.dirname(testPath), { recursive: true });
        const { passed, error } = await runTest(testPath, testCode);
        if (passed) break;
        console.log(`, retry, attempt:`, attempt)
        prompts.push({
            role: "user",
            content:
                `The previous test failed with this error:\n\n${error}\n\n` +
                `Please revise the test to fix it.`,
        });
        testCode = await callOpenAI(client, model, prompts);
        prompts.push({ role: "assistant", content: testCode });
        attempt++;
    }

    spinner.succeed(`✅ Test written: ${filename}`);
}

async function callOpenAI(client, model, prompts) {
    const res = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: "You write clean, idiomatic Jest tests." },
            ...prompts
        ],
        temperature: 1,
    });

    return res.choices[0].message.content;
}

module.exports = {
    generateAndFixTest,
};
