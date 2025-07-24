jest.mock("fs");
jest.mock("child_process");

const fs = require("fs");
const { execSync } = require("child_process");
const { runTest } = require("../../lib/runner");

describe("runTest", () => {
  const filepath = "/tmp/test-file.js";
  const testCode = "describe('x', () => it('y', () => expect(1).toBe(1)));";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes test file and returns passed true when execSync succeeds", async () => {
    fs.writeFileSync.mockImplementation(() => {});
    execSync.mockImplementation(() => "OK");

    const result = await runTest(filepath, testCode);

    expect(fs.writeFileSync).toHaveBeenCalledWith(filepath, testCode);
    expect(execSync).toHaveBeenCalledWith(
      `npx jest ${filepath} --runInBand --verbose`,
      { stdio: "pipe", encoding: "utf8" }
    );
    expect(result).toEqual({ passed: true, error: null });
  });

  it("returns passed false and error from err.stdout when execSync throws with stdout", async () => {
    fs.writeFileSync.mockImplementation(() => {});
    const fakeError = new Error("fail");
    fakeError.stdout = "jest failure output";
    execSync.mockImplementation(() => {
      throw fakeError;
    });

    const result = await runTest(filepath, testCode);

    expect(fs.writeFileSync).toHaveBeenCalledWith(filepath, testCode);
    expect(result).toEqual({ passed: false, error: "jest failure output" });
  });

  it("returns passed false and error from err.message when execSync throws without stdout", async () => {
    fs.writeFileSync.mockImplementation(() => {});
    const fakeError = new Error("no stdout here");
    // no stdout property
    execSync.mockImplementation(() => {
      throw fakeError;
    });

    const result = await runTest(filepath, testCode);

    expect(fs.writeFileSync).toHaveBeenCalledWith(filepath, testCode);
    expect(result).toEqual({ passed: false, error: "no stdout here" });
  });

  it("handles empty testCode", async () => {
    fs.writeFileSync.mockImplementation(() => {});
    execSync.mockImplementation(() => {});

    const emptyCode = "";
    const result = await runTest(filepath, emptyCode);

    expect(fs.writeFileSync).toHaveBeenCalledWith(filepath, emptyCode);
    expect(result).toEqual({ passed: true, error: null });
  });
});