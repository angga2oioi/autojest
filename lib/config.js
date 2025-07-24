//@ts-check

const fs = require("fs");
const path = require("path");
const os = require("os");
const jaci = require("jaci");

// Get platform-safe config file path
function getConfigPath() {
    const home = os.homedir();
    const dir =
        process.platform === "win32"
            ? path.join(process.env.APPDATA || home, "autojest")
            : path.join(home, ".config", "autojest");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "config.json");
}

async function getConfig() {
    const configPath = getConfigPath();

    if (fs.existsSync(configPath)) {
        const useSaved = await jaci.confirm("Use saved config? (Y/N)", { default: true, confirm: { true: "Y", false: "N" } });
        if (useSaved) {
            const raw = fs.readFileSync(configPath, "utf-8");
            return JSON.parse(raw);
        }
    }

    const strConnection = await jaci.string("Open AI Connection : ", { required: true });
    const model = await jaci.string("AI Model : ", { required: true });
    const maxRetries = await jaci.number("Max Retries on test : ", { required: true });

    const config = { connection: JSON.parse(strConnection), model, maxRetries };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
}

async function getDirectoryToTest() {
    let directory;
    // Prompt until a relative path is provided
    while (true) {
        directory = await jaci.string("directory : ", { required: true });
        if (path.isAbsolute(directory)) {
            console.error("❌ Absolute paths are not allowed. Please enter a relative path.");
        } else {
            break;
        }
    }

    return directory
}

async function getOutputDirectory() {
    // Prompt for test output directory (must be relative)
    let testDir;
    while (true) {
        testDir = await jaci.string("test directory : ", { required: true });
        if (path.isAbsolute(testDir)) {
            console.error("❌ Absolute paths are not allowed. Please enter a relative path for test directory.");
        } else {
            break;
        }
    }

    return testDir
}
module.exports = {
    getConfig,
    getDirectoryToTest,
    getOutputDirectory
}