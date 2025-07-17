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
 * @param {number} options.maxRetries - Max fix attempts if test fails
 * @param {(code: string) => Promise<{ passed: boolean, error?: string }>} options.runTest - Function to run test code
 * @returns {Promise<void>}
 */
async function generateAndFixTest(sourcePath, { client, model, maxRetries = 3, runTest }) {
    const spinner = ora(`Generate test for ${sourcePath}`).start();

    const sourceCode = fs.readFileSync(sourcePath, "utf8");
    const filename = path.basename(sourcePath);

    let prompt = `You are an expert JavaScript/TypeScript testing assistant.

Your task: generate a **Jest unit test file** for the following source code.  
- Only respond with valid JavaScript test code.
- Do **not** include any explanations, markdown, or headings.
- You may use /* inline comments */ if needed inside the code.
- The goal is **full branch coverage** of all exported functions/classes, including edge cases and error handling.

Source file: ${filename}

${sourceCode}
`;

    let attempt = 0;
    const prompts = [{
        role: "user",
        content: prompt
    }]

    let testCode = await callOpenAI(client, model, prompts);
    prompts.push({ role: "assistant", content: testCode })

    maxRetries = parseInt(maxRetries)
    let testPath
    while (attempt <= maxRetries) {

        testPath = sourcePath.replace(/\.(js|ts)x?$/, ".test.$1");

        const { passed, error } = await runTest(testPath, testCode);
        if (passed) break;

        prompt = `The previous test failed with this error:\n\n${error}\n\nPlease revise the test to fix it.`;
        prompts.push({ role: "user", content: prompt })

        testCode = await callOpenAI(client, model, prompts);
        prompts.push({ role: "assistant", content: testCode })

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
