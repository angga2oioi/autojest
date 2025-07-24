const fs = require("fs");
const os = require("os");
const path = require("path");
const jaci = require("jaci");
const { getConfig, getDirectoryToTest, getOutputDirectory } = require("../../lib/config");

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));
jest.mock("os", () => ({
  homedir: jest.fn()
}));
jest.mock("jaci", () => ({
  confirm: jest.fn(),
  string: jest.fn(),
  number: jest.fn()
}));

describe("getConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.APPDATA;
  });
  function setPlatform(platform) {
    Object.defineProperty(process, "platform", { value: platform });
  }

  test("uses saved config if exists and user confirms", async () => {
    setPlatform("linux");
    os.homedir.mockReturnValue("/home/user");
    const dir = path.join("/home/user", ".config", "autojest");
    const configPath = path.join(dir, "config.json");
    fs.existsSync.mockImplementation(p => p === dir || p === configPath);
    jaci.confirm.mockResolvedValue(true);
    const saved = { connection: { foo: "bar" }, model: "M", maxRetries: 2 };
    fs.readFileSync.mockReturnValue(JSON.stringify(saved));
    const result = await getConfig();
    expect(result).toEqual(saved);
    expect(fs.readFileSync).toHaveBeenCalledWith(configPath, "utf-8");
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test("prompts and rewrites config if user declines saved", async () => {
    setPlatform("linux");
    os.homedir.mockReturnValue("/home/user");
    const dir = path.join("/home/user", ".config", "autojest");
    const configPath = path.join(dir, "config.json");
    fs.existsSync.mockImplementation(p => p === dir || p === configPath);
    jaci.confirm.mockResolvedValue(false);
    jaci.string
      .mockResolvedValueOnce('{"x":1}')
      .mockResolvedValueOnce("ModelY");
    jaci.number.mockResolvedValue(7);
    const result = await getConfig();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ connection: { x: 1 }, model: "ModelY", maxRetries: 7 }, null, 2)
    );
    expect(result).toEqual({ connection: { x: 1 }, model: "ModelY", maxRetries: 7 });
  });

  test("creates directory and new config when none exists on linux", async () => {
    setPlatform("linux");
    os.homedir.mockReturnValue("/home/user");
    const dir = path.join("/home/user", ".config", "autojest");
    const configPath = path.join(dir, "config.json");
    fs.existsSync.mockReturnValue(false);
    jaci.string
      .mockResolvedValueOnce('{"y":2}')
      .mockResolvedValueOnce("ModelZ");
    jaci.number.mockResolvedValue(9);
    const result = await getConfig();
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ connection: { y: 2 }, model: "ModelZ", maxRetries: 9 }, null, 2)
    );
    expect(result).toEqual({ connection: { y: 2 }, model: "ModelZ", maxRetries: 9 });
  });

  test("creates directory and new config when none exists on Windows using APPDATA", async () => {
    setPlatform("win32");
    process.env.APPDATA = "C:\\AppData";
    os.homedir.mockReturnValue("C:\\home");
    const dir = path.join("C:\\AppData", "autojest");
    const configPath = path.join(dir, "config.json");
    fs.existsSync.mockReturnValue(false);
    jaci.string
      .mockResolvedValueOnce('{"z":3}')
      .mockResolvedValueOnce("ModelW");
    jaci.number.mockResolvedValue(11);
    const result = await getConfig();
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ connection: { z: 3 }, model: "ModelW", maxRetries: 11 }, null, 2)
    );
    expect(result).toEqual({ connection: { z: 3 }, model: "ModelW", maxRetries: 11 });
  });

  test("Windows without APPDATA falls back to homedir", async () => {
    setPlatform("win32");
    os.homedir.mockReturnValue("D:\\UserHome");
    const dir = path.join("D:\\UserHome", "autojest");
    const configPath = path.join(dir, "config.json");
    fs.existsSync.mockReturnValue(false);
    jaci.string
      .mockResolvedValueOnce('{"k":5}')
      .mockResolvedValueOnce("ModelX");
    jaci.number.mockResolvedValue(4);
    const result = await getConfig();
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ connection: { k: 5 }, model: "ModelX", maxRetries: 4 }, null, 2)
    );
    expect(result).toEqual({ connection: { k: 5 }, model: "ModelX", maxRetries: 4 });
  });

  test("throws error on invalid saved JSON", async () => {
    setPlatform("linux");
    os.homedir.mockReturnValue("/home/user");
    const dir = path.join("/home/user", ".config", "autojest");
    const configPath = path.join(dir, "config.json");
    fs.existsSync.mockImplementation(p => p === dir || p === configPath);
    jaci.confirm.mockResolvedValue(true);
    fs.readFileSync.mockReturnValue("not-json");
    await expect(getConfig()).rejects.toThrow(SyntaxError);
  });
});

describe("getDirectoryToTest", () => {
  beforeEach(() => jest.clearAllMocks());

  test("re-prompts on absolute then returns relative", async () => {
    jaci.string
      .mockResolvedValueOnce("/abs/path")
      .mockResolvedValueOnce("rel/path");
    const result = await getDirectoryToTest();
    expect(jaci.string).toHaveBeenCalledTimes(2);
    expect(result).toBe("rel/path");
  });

  test("returns immediately on relative path", async () => {
    jaci.string.mockResolvedValueOnce("mydir");
    const result = await getDirectoryToTest();
    expect(jaci.string).toHaveBeenCalledTimes(1);
    expect(result).toBe("mydir");
  });
});

describe("getOutputDirectory", () => {
  beforeEach(() => jest.clearAllMocks());

  test("re-prompts on absolute then returns relative", async () => {
    jaci.string
      .mockResolvedValueOnce("/abs/testdir")
      .mockResolvedValueOnce("out/tests");
    const result = await getOutputDirectory();
    expect(jaci.string).toHaveBeenCalledTimes(2);
    expect(result).toBe("out/tests");
  });

  test("returns immediately on relative path", async () => {
    jaci.string.mockResolvedValueOnce("tests/out");
    const result = await getOutputDirectory();
    expect(jaci.string).toHaveBeenCalledTimes(1);
    expect(result).toBe("tests/out");
  });
});