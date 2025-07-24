const fs = require("fs");
const os = require("os");
const path = require("path");
const jaci = require("jaci");

jest.mock("fs");
jest.mock("os");
jest.mock("jaci");

const { getConfig, getDirectoryToTest, getOutputDirectory } = require("../../lib/config");

describe("config module", () => {
  const mockHome = "/home/testuser";
  beforeEach(() => {
    jest.resetAllMocks();
    os.homedir.mockReturnValue(mockHome);
    // default existsSync: directory and config missing
    fs.existsSync.mockImplementation((p) => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.readFileSync.mockImplementation(() => "");
    fs.writeFileSync.mockImplementation(() => {});
  });

  describe("getConfig on non-Windows", () => {
    beforeEach(() => {
      // ensure non-windows platform
      Object.defineProperty(process, "platform", {
        value: "linux",
      });
    });

    it("prompts for new config when none exists and writes file", async () => {
      // existsSync false for dir and false for config
      jaci.string
        .mockResolvedValueOnce('{"apiKey":"secret"}') // connection string
        .mockResolvedValueOnce("gpt-4"); // model
      jaci.number.mockResolvedValueOnce(3); // maxRetries

      const config = await getConfig();

      expect(config).toEqual({
        connection: { apiKey: "secret" },
        model: "gpt-4",
        maxRetries: 3,
      });

      const expectedDir = path.join(mockHome, ".config", "autojest");
      const expectedPath = path.join(expectedDir, "config.json");
      expect(fs.existsSync).toHaveBeenCalledWith(expectedDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify(config, null, 2)
      );
      expect(jaci.confirm).not.toHaveBeenCalled();
    });

    it("uses saved config when confirmed", async () => {
      // dir and config exist
      fs.existsSync.mockImplementation((p) => true);
      const saved = {
        connection: { foo: "bar" },
        model: "test",
        maxRetries: 5,
      };
      jaci.confirm.mockResolvedValueOnce(true);
      fs.readFileSync.mockReturnValueOnce(JSON.stringify(saved));

      const config = await getConfig();

      expect(config).toEqual(saved);
      expect(jaci.confirm).toHaveBeenCalledWith("Use saved config? (Y/N)", {
        default: true,
        confirm: { true: "Y", false: "N" },
      });
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(jaci.string).not.toHaveBeenCalled();
    });

    it("prompts new config when saved config is declined", async () => {
      fs.existsSync.mockImplementation((p) => true);
      jaci.confirm.mockResolvedValueOnce(false);
      jaci.string
        .mockResolvedValueOnce('{"x":1}')
        .mockResolvedValueOnce("modelX");
      jaci.number.mockResolvedValueOnce(7);

      const config = await getConfig();

      expect(config).toEqual({ connection: { x: 1 }, model: "modelX", maxRetries: 7 });
      const expectedDir = path.join(mockHome, ".config", "autojest");
      const expectedPath = path.join(expectedDir, "config.json");
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify(config, null, 2)
      );
    });
  });

  describe("getConfig on Windows", () => {
    const originalAppData = process.env.APPDATA;
    let originalPlatform;
    beforeAll(() => {
      originalPlatform = process.platform;
    });
    afterAll(() => {
      Object.defineProperty(process, "platform", { value: originalPlatform });
      process.env.APPDATA = originalAppData;
    });
    it("uses APPDATA when provided", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env.APPDATA = "C:\\AppDataMock";
      fs.existsSync.mockImplementation((p) => false);
      jaci.string
        .mockResolvedValueOnce('{"win":true}')
        .mockResolvedValueOnce("winModel");
      jaci.number.mockResolvedValueOnce(9);

      const config = await getConfig();
      expect(config).toEqual({ connection: { win: true }, model: "winModel", maxRetries: 9 });
      const expectedDir = path.join("C:\\AppDataMock", "autojest");
      expect(fs.existsSync).toHaveBeenCalledWith(expectedDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
      const expectedPath = path.join(expectedDir, "config.json");
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify(config, null, 2)
      );
    });

    it("falls back to homedir when APPDATA missing", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      delete process.env.APPDATA;
      fs.existsSync.mockImplementation((p) => false);
      jaci.string
        .mockResolvedValueOnce('{"win2":false}')
        .mockResolvedValueOnce("winModel2");
      jaci.number.mockResolvedValueOnce(11);

      const config = await getConfig();
      expect(config).toEqual({ connection: { win2: false }, model: "winModel2", maxRetries: 11 });
      const expectedDir = path.join(mockHome, "autojest");
      expect(fs.existsSync).toHaveBeenCalledWith(expectedDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
      const expectedPath = path.join(expectedDir, "config.json");
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify(config, null, 2)
      );
    });
  });

  describe("getDirectoryToTest", () => {
    beforeEach(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });
    it("rejects absolute then accepts relative", async () => {
      jaci.string
        .mockResolvedValueOnce("/abs/path")
        .mockResolvedValueOnce("rel/path");

      const dir = await getDirectoryToTest();
      expect(dir).toBe("rel/path");
      expect(console.error).toHaveBeenCalledWith(
        "❌ Absolute paths are not allowed. Please enter a relative path."
      );
    });

    it("accepts relative immediately", async () => {
      jaci.string.mockResolvedValueOnce("just/relative");
      const dir = await getDirectoryToTest();
      expect(dir).toBe("just/relative");
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("getOutputDirectory", () => {
    beforeEach(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });
    it("rejects absolute then accepts relative", async () => {
      jaci.string
        .mockResolvedValueOnce("/abs/out")
        .mockResolvedValueOnce("out/rel");
      const out = await getOutputDirectory();
      expect(out).toBe("out/rel");
      expect(console.error).toHaveBeenCalledWith(
        "❌ Absolute paths are not allowed. Please enter a relative path for test directory."
      );
    });

    it("accepts relative immediately", async () => {
      jaci.string.mockResolvedValueOnce("tests/dir");
      const out = await getOutputDirectory();
      expect(out).toBe("tests/dir");
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});