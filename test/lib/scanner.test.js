const fg = require("fast-glob");
jest.mock("fast-glob");

const { getUntestedFiles } = require("../../lib/scanner");

beforeEach(() => {
    fg.mockReset();
});

test("returns empty when every source has matching .test files", async () => {
    const sources = ["foo.js", "bar.ts"];
    const tests = ["foo.test.js", "bar.test.ts"];
    fg.mockImplementation((patterns) => {
        // first call: source files
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        // second call: test files
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual([]);
});

test("returns all sources when no tests are found", async () => {
    const sources = ["a.js", "b.tsx"];
    const tests = [];
    fg.mockImplementation((patterns) => {
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual(["a.js", "b.tsx"]);
});

test("handles nested paths and strips 'src' prefix", async () => {
    const sources = ["src/utils/helper.jsx", "src/components/widget.tsx"];
    const tests = ["test/utils/helper.test.jsx"];
    fg.mockImplementation((patterns) => {
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual(["src/components/widget.tsx"]);
});

test("matches tests in __tests__ directory", async () => {
    const sources = ["app/service.js"];
    const tests = ["__tests__/app/service.test.js"];
    fg.mockImplementation((patterns) => {
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual([]);
});

test("handles Windows backslashes in paths", async () => {
    const sources = ["src\\module\\baz.js"];
    const tests = ["test\\module\\baz.test.js"];
    fg.mockImplementation((patterns) => {
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual([]);
});

test("does not count .spec files as matching tests", async () => {
    const sources = ["module/qux.js"];
    const tests = ["test/module/qux.spec.js"];
    fg.mockImplementation((patterns) => {
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual(["module/qux.js"]);
});

test("mixed .test and .spec files, only .test counts", async () => {
    const sources = ["src/item.js", "src/other.js"];
    const tests = ["test/item.spec.js", "test/other.test.js"];
    fg.mockImplementation((patterns) => {
        if (patterns[0].includes("*.{js")) return Promise.resolve(sources);
        return Promise.resolve(tests);
    });
    await expect(getUntestedFiles("root")).resolves.toEqual(["src/item.js"]);
});