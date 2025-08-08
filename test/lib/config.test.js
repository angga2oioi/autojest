const fs = require("fs");
const os = require("os");
const path = require("path");
jest.mock("jaci");
const jaci = require("jaci");

// spy on filesystem and os methods
const existsSpy = jest.spyOn(fs, "existsSync");
const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation();
const readSpy = jest.spyOn(fs, "readFileSync");
const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation();
jest.spyOn(os, "homedir").mockReturnValue("/home/test");

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.APPDATA;
});

describe("getConfig", () => {
  test("creates config when no existing dir or file", async () => {
    // force non-Windows branch
    const origPlat = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });
    try {
      existsSpy.mockReturnValue(false); // dir and file both don't exist
      jaci.string
        .mockResolvedValueOnce('{"key":"value"}')
        .mockResolvedValueOnce("modelName");
      jaci.number.mockResolvedValueOnce(3);
      const { getConfig } = require("../../lib/config");
      const config = await getConfig();
      const expectedDir = path.join("/home/test", ".config", "autojest");
      expect(mkdirSpy).toHaveBeenCalledWith(expectedDir, { recursive: true });
      const expectedPath = path.join(expectedDir, "config.json");
      expect(writeSpy).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify({ connection: { key: "value" }, model: "modelName", maxRetries: 3 }, null, 2)
      );
      expect(config).toEqual({ connection: { key: "value" }, model: "modelName", maxRetries: 3 });
    } finally {
      Object.defineProperty(process, "platform", { value: origPlat });
    }
  });

  test("returns saved config when exists and user confirms", async () => {
    existsSpy.mockReturnValue(true); // dir and file exist
    jaci.confirm.mockResolvedValue(true);
    const saved = { connection: { a: 1 }, model: "x", maxRetries: 5 };
    readSpy.mockReturnValue(JSON.stringify(saved));
    const { getConfig } = require("../../lib/config");
    const config = await getConfig();
    expect(jaci.confirm).toHaveBeenCalledWith(
      "Use saved config? (Y/N)",
      expect.objectContaining({ default: true, confirm: expect.any(Object) })
    );
    expect(readSpy).toHaveBeenCalledWith(expect.any(String), "utf-8");
    expect(config).toEqual(saved);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  test("re-prompts and writes new config when exists but user declines", async () => {
    existsSpy.mockReturnValue(true);
    jaci.confirm.mockResolvedValue(false);
    jaci.string
      .mockResolvedValueOnce('{"b":2}')
      .mockResolvedValueOnce("model2");
    jaci.number.mockResolvedValueOnce(7);
    const { getConfig } = require("../../lib/config");
    const config = await getConfig();
    expect(jaci.confirm).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalled();
    expect(config).toEqual({ connection: { b: 2 }, model: "model2", maxRetries: 7 });
  });

  test("uses APPDATA on Windows", async () => {
    const origPlat = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    process.env.APPDATA = "C:/Users/Test/AppData";
    existsSpy.mockReturnValue(false);
    jaci.string.mockResolvedValueOnce("{}").mockResolvedValueOnce("m");
    jaci.number.mockResolvedValueOnce(1);
    try {
      const { getConfig } = require("../../lib/config");
      await getConfig();
      const expectedDir = path.join("C:/Users/Test/AppData", "autojest");
      expect(mkdirSpy).toHaveBeenCalledWith(expectedDir, { recursive: true });
    } finally {
      Object.defineProperty(process, "platform", { value: origPlat });
    }
  });
});

describe("loadConfig", () => {
  test("loads and parses existing config", async () => {
    existsSpy.mockReturnValue(true);
    const cfg = { x: 1 };
    readSpy.mockReturnValue(JSON.stringify(cfg));
    const { loadConfig } = require("../../lib/config");
    const result = await loadConfig();
    expect(readSpy).toHaveBeenCalledWith(expect.any(String), "utf-8");
    expect(result).toEqual(cfg);
  });

  test("throws when no config exists", async () => {
    existsSpy.mockReturnValue(false);
    const { loadConfig } = require("../../lib/config");
    await expect(loadConfig()).rejects.toThrow("No saved config found");
  });
});

describe("getDirectoryToTest", () => {
  test("rejects absolute then accepts relative path", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    jaci.string
      .mockResolvedValueOnce("/abs/path")
      .mockResolvedValueOnce("rel/path");
    const { getDirectoryToTest } = require("../../lib/config");
    const res = await getDirectoryToTest();
    expect(consoleSpy).toHaveBeenCalledWith(
      "❌ Absolute paths are not allowed. Please enter a relative path."
    );
    expect(res).toBe("rel/path");
    consoleSpy.mockRestore();
  });
});

describe("getOutputDirectory", () => {
  test("rejects absolute then accepts relative path", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    jaci.string
      .mockResolvedValueOnce("C:\\abs\\dir")
      .mockResolvedValueOnce("out/dir");
    const { getOutputDirectory } = require("../../lib/config");
    const res = await getOutputDirectory();
    expect(consoleSpy).toHaveBeenCalledWith(
      "❌ Absolute paths are not allowed. Please enter a relative path for test directory."
    );
    expect(res).toBe("out/dir");
    consoleSpy.mockRestore();
  });
});