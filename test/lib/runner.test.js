jest.mock("fs");
jest.mock("child_process");
jest.mock("openai");
jest.mock("jaci");
jest.mock("ora", () => ({ default: jest.fn() }));
jest.mock("../../lib/testgen", () => ({ generateAndFixTest: jest.fn() }));

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const OpenAI = require("openai");
const jaci = require("jaci");
const { generateAndFixTest } = require("../../lib/testgen");
const runner = require("../../lib/runner");

describe("runTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes test code and returns passed true", async () => {
    fs.writeFileSync.mockImplementation(() => {});
    childProcess.execSync.mockImplementation(() => {});
    const res = await runner.runTest("file.test.js", "code");
    expect(fs.writeFileSync).toHaveBeenCalledWith("file.test.js", "code");
    expect(childProcess.execSync).toHaveBeenCalledWith(
      "npx jest file.test.js --runInBand --verbose",
      { stdio: "pipe", encoding: "utf8" }
    );
    expect(res).toEqual({ passed: true, error: null });
  });

  it("returns error.stdout when execSync throws with stdout", async () => {
    const err = new Error("fail");
    err.stdout = "jest error";
    childProcess.execSync.mockImplementation(() => { throw err; });
    const res = await runner.runTest("f.js", "");
    expect(res).toEqual({ passed: false, error: "jest error" });
  });

  it("returns error.message when execSync throws without stdout", async () => {
    const err = new Error("oops");
    childProcess.execSync.mockImplementation(() => { throw err; });
    const res = await runner.runTest("f.js", "");
    expect(res).toEqual({ passed: false, error: "oops" });
  });
});

describe("createTestFile", () => {
  const connection = { apiKey: "key" }, model = "m", directory = "/proj/src", testDir = "/proj/tests";
  beforeEach(() => {
    jest.clearAllMocks();
    OpenAI.mockImplementation(function(conn){ this.conn = conn; });
  });

  it("skips when no untestedFiles", async () => {
    await runner.createTestFile(connection, [], directory, model, testDir);
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });

  it("generates tests for each untested file", async () => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    process.cwd = jest.fn().mockReturnValue("/proj");
    generateAndFixTest.mockResolvedValue();
    const files = ["a.js", "sub/b.js"];
    await runner.createTestFile(connection, files, directory, model, testDir);
    expect(generateAndFixTest).toHaveBeenCalledTimes(2);
    const calls = generateAndFixTest.mock.calls;
    expect(calls[0][0]).toBe(path.join(process.cwd(), "a.js"));
    expect(calls[0][1].relativePath).toMatch(/a\.js$/);
    expect(calls[1][0]).toBe(path.join(process.cwd(), "sub/b.js"));
    expect(calls[1][1].relativePath).toMatch(/sub\/b\.js$/);
    expect(console.info).toHaveBeenCalledWith("✅ Tests generated.");
  });
});

describe("rerunAllTest", () => {
  const connection = {}, model = "M", directory = "/proj/src", testDir = "tests";
  beforeEach(() => {
    jest.clearAllMocks();
    OpenAI.mockImplementation(function(conn){ this.conn = conn; });
    process.cwd = jest.fn().mockReturnValue("/proj");
    fs.readFileSync.mockReturnValue("existingCode");
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  it("does not fix when tests pass", async () => {
    childProcess.execSync.mockImplementation(() => {});
    await runner.rerunAllTest(["file.js"], directory, testDir, connection, model);
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });

  it("fixes when tests fail", async () => {
    const err = new Error("err");
    err.stdout = "stdout";
    childProcess.execSync.mockImplementation(() => { throw err; });
    generateAndFixTest.mockResolvedValue();
    await runner.rerunAllTest(["file.js"], directory, testDir, connection, model);
    const [filePath, opts] = generateAndFixTest.mock.calls[0];
    expect(filePath).toBe(path.join(process.cwd(), "file.js"));
    expect(opts).toMatchObject({
      existingTestCode: "existingCode",
      existingError: "stdout",
      runTest: runner.runTest
    });
    expect(opts.relativePath).toMatch(/file\.js$/);
    expect(opts).toHaveProperty("model");
    expect(opts).toHaveProperty("testDir");
  });
});

describe("runCoverage", () => {
  const connection = {}, model = "M", directory = "src", testDir = "tests", sources = ["a.js", "b.js"];
  beforeEach(() => {
    jest.clearAllMocks();
    OpenAI.mockImplementation(function(conn){ this.conn = conn; });
    process.cwd = jest.fn().mockReturnValue("/repo");
    childProcess.execSync.mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("updates undercovered files when confirm true via final report", async () => {
    fs.existsSync.mockImplementation(p => p.endsWith("coverage-summary.json") === false && p.endsWith("coverage-final.json"));
    const raw = {
      one: { path: "/repo/src/a.js", s: { "1": 0, "2": 1 } },
      two: { path: "/repo/src/b.js", s: { "1": 1 } }
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(raw));
    jaci.confirm.mockResolvedValue(true);
    generateAndFixTest.mockResolvedValue();
    await runner.runCoverage(directory, testDir, sources, connection, model);
    expect(jaci.confirm).toHaveBeenCalled();
    expect(generateAndFixTest).toHaveBeenCalledTimes(1);
    const [calledPath, calledOpts] = generateAndFixTest.mock.calls[0];
    expect(calledPath).toBe(path.join(directory, "a.js"));
    expect(calledOpts).toMatchObject({
      model,
      runTest: runner.runTest,
      testDir
    });
    expect(calledOpts.relativePath).toMatch(/a\.js$/);
    expect(console.info).toHaveBeenCalledWith("✅ Tests updated for under-covered files.");
  });

  it("logs no report and all covered when none exist", async () => {
    fs.existsSync.mockReturnValue(false);
    await runner.runCoverage(directory, testDir, sources, connection, model);
    expect(console.error).toHaveBeenCalledWith("❌ No coverage report found.");
    expect(console.info).toHaveBeenCalledWith("✅ All source files have at least 80% coverage.");
  });
});