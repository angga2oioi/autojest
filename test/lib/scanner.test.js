jest.mock('fast-glob');
const fg = require('fast-glob');
const { getUntestedFiles, getAllSourceFiles } = require('../../lib/scanner');

describe('getUntestedFiles', () => {
  beforeEach(() => {
    fg.mockReset();
  });

  it('returns only untested files', async () => {
    fg
      // first call: source files
      .mockResolvedValueOnce(['foo.js', 'bar.ts', 'nested/qux.tsx'])
      // second call: test files
      .mockResolvedValueOnce(['foo.test.js', 'nested/qux.test.tsx']);
    const result = await getUntestedFiles('src');
    expect(result).toEqual(['src/bar.ts']);
  });

  it('handles backslashes in test paths and windows separators', async () => {
    fg
      // source in nested folder
      .mockResolvedValueOnce(['nested/comp.jsx'])
      // windows-style test path
      .mockResolvedValueOnce(['nested\\comp.test.jsx']);
    const result = await getUntestedFiles('src');
    expect(result).toEqual([]); // comp.jsx has a matching test
  });

  it('matches files inside src directory by stripping src segment', async () => {
    fg
      // source under src folder
      .mockResolvedValueOnce(['src/sub/alpha.ts'])
      // test path without src prefix
      .mockResolvedValueOnce(['sub/alpha.test.ts']);
    const result = await getUntestedFiles('project');
    expect(result).toEqual([]); // should match and exclude
  });

  it('handles no test files', async () => {
    fg
      .mockResolvedValueOnce(['a.js', 'b.ts'])
      .mockResolvedValueOnce([]);
    const result = await getUntestedFiles('lib');
    expect(result).toEqual(['lib/a.js', 'lib/b.ts']);
  });

  it('propagates error from fg for sources', async () => {
    fg.mockRejectedValueOnce(new Error('fg source error'));
    await expect(getUntestedFiles('x')).rejects.toThrow('fg source error');
  });

  it('propagates error from fg for tests', async () => {
    fg
      .mockResolvedValueOnce(['a.js'])
      .mockRejectedValueOnce(new Error('fg test error'));
    await expect(getUntestedFiles('y')).rejects.toThrow('fg test error');
  });
});

describe('getAllSourceFiles', () => {
  beforeEach(() => {
    fg.mockReset();
  });

  it('returns mapped source file paths', async () => {
    fg.mockResolvedValueOnce(['one.js', 'deep/two.tsx']);
    const result = await getAllSourceFiles('app');
    expect(result).toEqual(['app/one.js', 'app/deep/two.tsx']);
  });

  it('propagates error from fg', async () => {
    fg.mockRejectedValueOnce(new Error('fg error'));
    await expect(getAllSourceFiles('dir')).rejects.toThrow('fg error');
  });
});