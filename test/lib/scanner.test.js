jest.mock("fast-glob");
const fg = require("fast-glob");
const { getUntestedFiles, getAllSourceFiles } = require("../../lib/scanner");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAllSourceFiles", () => {
  it("returns all source files from fast-glob", async () => {
    const mockSources = ["a.js", "subdir/b.tsx", "c.jsx"];
    fg.mockResolvedValueOnce(mockSources);
    const result = await getAllSourceFiles("any-dir");
    expect(fg).toHaveBeenCalledWith(["**/*.{js,ts,jsx,tsx}"], {
      cwd: "any-dir",
      ignore: ["**/*.test.*", "**/__tests__/**", "node_modules/**", "coverage/**", "dist/**", "build/**"],
    });
    expect(result).toEqual(mockSources);
  });

  it("propagates errors from fast-glob", async () => {
    const error = new Error("fg fail");
    fg.mockRejectedValueOnce(error);
    await expect(getAllSourceFiles("dir")).rejects.toBe(error);
  });
});

describe("getUntestedFiles", () => {
  it("filters out files that have matching .test files", async () => {
    const sources = [
      "folder/a.jsx",
      "folder/subdir/b.js",
      "src/c.tsx",
      "foo.js",
      "nested/deep/d.ts",
    ];
    const tests = [
      "folder/a.test.jsx",
      "folder/subdir/b.test.js",
      "c.test.tsx",           
      "nested/deep/d.test.ts",
    ];
    fg
      .mockResolvedValueOnce(sources) 
      .mockResolvedValueOnce(tests);  
    const result = await getUntestedFiles("root");
    expect(fg).toHaveBeenNthCalledWith(1, ["**/*.{js,ts,jsx,tsx}"], expect.any(Object));
    expect(fg).toHaveBeenNthCalledWith(2, ["**/*.test.{js,ts,jsx,tsx}", "**/*.spec.{js,ts,jsx,tsx}"], expect.any(Object));
    expect(result).toEqual(["foo.js"]);
  });

  it("handles Windows-style backslashes in source and test paths", async () => {
    const sources = ["dir\\cool.js", "other/file.ts"];
    const tests = ["dir/cool.test.js"];
    fg
      .mockResolvedValueOnce(sources)
      .mockResolvedValueOnce(tests);
    const result = await getUntestedFiles("win");
    expect(result).toEqual(["other/file.ts"]);
  });

  it("returns all sources if no tests are found", async () => {
    const sources = ["one.js", "two.ts"];
    fg
      .mockResolvedValueOnce(sources)
      .mockResolvedValueOnce([]); // no tests
    const result = await getUntestedFiles("dir");
    expect(result).toEqual(sources);
  });

  it("propagates errors from fast-glob on source scan", async () => {
    const error = new Error("scan error");
    fg.mockRejectedValueOnce(error);
    await expect(getUntestedFiles("dir")).rejects.toBe(error);
  });

  it("propagates errors from fast-glob on test scan", async () => {
    const sources = ["a.js"];
    const error = new Error("test scan error");
    fg
      .mockResolvedValueOnce(sources)
      .mockRejectedValueOnce(error);
    await expect(getUntestedFiles("dir")).rejects.toBe(error);
  });
});