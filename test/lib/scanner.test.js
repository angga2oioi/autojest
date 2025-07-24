jest.mock("fast-glob");
const fg = require("fast-glob");
const { getAllSourceFiles, getUntestedFiles } = require("../../lib/scanner");

beforeEach(() => {
  fg.mockReset();
});

describe("getAllSourceFiles", () => {
  it("calls fast-glob with correct patterns and returns its result", async () => {
    const mockFiles = ["a.js", "dir/b.tsx"];
    fg.mockResolvedValueOnce(mockFiles);
    const result = await getAllSourceFiles("rootDir");
    expect(fg).toHaveBeenCalledTimes(1);
    expect(fg).toHaveBeenCalledWith(
      ["**/*.{js,ts,jsx,tsx}"],
      {
        cwd: "rootDir",
        ignore: [
          "**/*.test.*",
          "**/__tests__/**",
          "node_modules/**",
          "coverage/**",
          "dist/**",
          "build/**"
        ],
      }
    );
    expect(result).toEqual(mockFiles);
  });

  it("propagates errors from fast-glob", async () => {
    const err = new Error("glob failure");
    fg.mockRejectedValueOnce(err);
    await expect(getAllSourceFiles("anyDir")).rejects.toThrow("glob failure");
  });
});

describe("getUntestedFiles", () => {
  it("returns only files without matching .test.js files", async () => {
    const src = ["src/foo.js", "src/foo2.tsx", "bar/baz.jsx"];
    const tests = ["foo.test.js"];
    fg
      .mockResolvedValueOnce(src)   // all source files
      .mockResolvedValueOnce(tests); // all test files
    const result = await getUntestedFiles("cwd");
    expect(result.sort()).toEqual(["bar/baz.jsx", "src/foo2.tsx"].sort());
    expect(fg).toHaveBeenCalledTimes(2);
    expect(fg).toHaveBeenNthCalledWith(
      1,
      ["**/*.{js,ts,jsx,tsx}"],
      {
        cwd: "cwd",
        ignore: [
          "**/*.test.*",
          "**/__tests__/**",
          "node_modules/**",
          "coverage/**",
          "dist/**",
          "build/**"
        ]
      }
    );
    expect(fg).toHaveBeenNthCalledWith(
      2,
      ["**/*.test.{js,ts,jsx,tsx}", "**/*.spec.{js,ts,jsx,tsx}"],
      { cwd: "cwd", ignore: ["node_modules/**"] }
    );
  });

  it("treats Windows backslashes and matches tests in __tests__ or test folders", async () => {
    const src = ["src\\a\\b\\c.jsx", "src\\x\\y.ts"];
    const tests = ["__tests__\\a\\b\\c.test.jsx", "test\\x\\y.test.ts"];
    fg.mockResolvedValueOnce(src).mockResolvedValueOnce(tests);
    const result = await getUntestedFiles("any");
    expect(result).toEqual([]);
  });

  it("does not match .spec test files because only .test is stripped", async () => {
    const src = ["foo.tsx", "lib/utils.js"];
    const tests = ["foo.spec.tsx", "lib/utils.spec.js"];
    fg.mockResolvedValueOnce(src).mockResolvedValueOnce(tests);
    const result = await getUntestedFiles("d");
    expect(result.sort()).toEqual(src.sort());
  });

  it("handles files without any tests (empty test list)", async () => {
    const src = ["one.js", "two.ts"];
    fg.mockResolvedValueOnce(src).mockResolvedValueOnce([]);
    const result = await getUntestedFiles("dir");
    expect(result).toEqual(src);
  });

  it("ignores 'src' segment and filters nested segments correctly", async () => {
    const src = ["src/components/Widget.ts", "src/pages/Home/index.js"];
    const tests = ["components/Widget.test.ts", "pages/Home/index.test.js"];
    fg.mockResolvedValueOnce(src).mockResolvedValueOnce(tests);
    const result = await getUntestedFiles("root");
    expect(result).toEqual([]);
  });

  it("propagates errors from fast-glob on first call", async () => {
    const err = new Error("first fail");
    fg.mockRejectedValueOnce(err);
    await expect(getUntestedFiles("x")).rejects.toThrow("first fail");
  });

  it("propagates errors from fast-glob on second call", async () => {
    const src = ["a.js"];
    const err = new Error("second fail");
    fg.mockResolvedValueOnce(src).mockRejectedValueOnce(err);
    await expect(getUntestedFiles("y")).rejects.toThrow("second fail");
  });
});