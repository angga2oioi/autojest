jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
jest.mock('../../lib/testgen', () => ({
  generateAndFixTest: jest.fn(),
}));
jest.mock('jaci', () => ({
  confirm: jest.fn(),
}));

const fs = require('fs');
const { execSync } = require('child_process');
const { generateAndFixTest } = require('../../lib/testgen');
const jaci = require('jaci');
const path = require('path');
const runner = require('../../lib/runner');

beforeAll(() => {
  jest.spyOn(process, 'cwd').mockReturnValue('/project');
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  execSync.mockImplementation(() => {});
});

describe('runTest', () => {
  test('writes file and returns passed true when execSync succeeds', async () => {
    const res = await runner.runTest('file.js', 'code');
    expect(fs.writeFileSync).toHaveBeenCalledWith('file.js', 'code');
    expect(execSync).toHaveBeenCalledWith(
      'npx jest file.js --runInBand --verbose',
      { stdio: 'pipe', encoding: 'utf8' }
    );
    expect(res).toEqual({ passed: true, error: null });
  });
  test('does not write file when no testCode', async () => {
    const res = await runner.runTest('file2.js', '');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(execSync).toHaveBeenCalled();
    expect(res).toEqual({ passed: true, error: null });
  });
  test('returns false and stdout when execSync throws with stdout', async () => {
    const e = new Error('e'); e.stdout = 'out';
    execSync.mockImplementation(() => { throw e; });
    const res = await runner.runTest('f.js', '');
    expect(res).toEqual({ passed: false, error: 'out' });
  });
  test('returns false and message when execSync throws without stdout', async () => {
    const e = new Error('msg');
    execSync.mockImplementation(() => { throw e; });
    const res = await runner.runTest('f2.js', '');
    expect(res).toEqual({ passed: false, error: 'msg' });
  });
});

describe('createTestFile', () => {
  test('no action on empty list', async () => {
    await runner.createTestFile([], 'tdir');
    expect(generateAndFixTest).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
  test('generates for each untested file', async () => {
    await runner.createTestFile(['src/a.js'], 'tdir');
    const expectedPath = path.join('/project', 'src/a.js');
    expect(generateAndFixTest).toHaveBeenCalledWith(expectedPath, {
      runTest: runner.runTest,
      testDir: 'tdir',
      relativePath: 'src/a.js',
    });
    expect(console.info).toHaveBeenCalledWith('✅ Tests generated.');
  });
});

describe('rerunAllTest', () => {
  test('skips passing tests', async () => {
    fs.readFileSync.mockReturnValue('c');
    execSync.mockImplementation(() => {});
    await runner.rerunAllTest(['f.js'], 't');
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });
  test('fixes failing tests', async () => {
    fs.readFileSync.mockReturnValue('code');
    execSync.mockImplementation(() => { throw new Error('e'); });
    await runner.rerunAllTest(['f.js'], 't');
    expect(generateAndFixTest).toHaveBeenCalled();
    const [p, opts] = generateAndFixTest.mock.calls[0];
    expect(p).toMatch(/t[\\/\/]f\.js$/);
    expect(opts).toMatchObject({
      runTest: runner.runTest,
      testDir: 't',
      existingTestCode: 'code',
      existingError: 'e',
    });
  });
});

describe('runCoverage', () => {
  beforeEach(() => {
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
    jaci.confirm.mockReset();
  });

  test('summaryFile branch with update', async () => {
    const keyA = path.join('test', 'a.js');
    const keyB = path.join('test', 'b.js');
    fs.existsSync.mockImplementation(p => p.endsWith('coverage-summary.json'));
    fs.readFileSync.mockReturnValue(JSON.stringify({
      [keyA]: { statements: { pct: 50 } },
      [keyB]: { statements: { pct: 90 } },
    }));
    jaci.confirm.mockResolvedValue(true);
    await runner.runCoverage('test', 'tdir', ['a.js', 'b.js']);
    expect(generateAndFixTest).toHaveBeenCalledTimes(1);
    const [filePath, opts] = generateAndFixTest.mock.calls[0];
    expect(filePath).toMatch(new RegExp(`${keyA.replace(/\\/g, '\\\\')}$`));
    expect(opts.runTest).toBe(runner.runTest);
    expect(opts.testDir).toBe('tdir');
    expect(opts.relativePath).toMatch(/a\.js$/);
    expect(console.info).toHaveBeenCalledWith('✅ Tests updated for under-covered files.');
  });

  test('summaryFile branch no update', async () => {
    const key = path.join('test', 'a.js');
    fs.existsSync.mockImplementation(p => p.endsWith('coverage-summary.json'));
    fs.readFileSync.mockReturnValue(JSON.stringify({
      [key]: { statements: { pct: 90 } },
    }));
    jaci.confirm.mockResolvedValue(false);
    await runner.runCoverage('test', 'tdir', ['a.js']);
    expect(generateAndFixTest).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      '✅ All source files have at least 80% coverage.'
    );
  });

  test('finalFile branch', async () => {
    fs.existsSync.mockImplementation(p =>
      p.endsWith('coverage-summary.json') ? false : p.endsWith('coverage-final.json')
    );
    const raw = {
      x: { path: path.join('/project', 'test', 'x.js'), s: { '1': 1, '2': 0 } },
      y: { path: path.join('/project', 'test', 'y.js'), s: {} },
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(raw));
    jaci.confirm.mockResolvedValue(true);
    await runner.runCoverage('test', 'tdir', ['x.js', 'y.js']);
    expect(generateAndFixTest).toHaveBeenCalledTimes(1);
    const [filePath, opts] = generateAndFixTest.mock.calls[0];
    expect(filePath).toMatch(/test[\\/\/]x\.js$/);
    expect(opts.runTest).toBe(runner.runTest);
    expect(opts.testDir).toBe('tdir');
    expect(opts.relativePath).toMatch(/x\.js$/);
    expect(console.info).toHaveBeenCalledWith('✅ Tests updated for under-covered files.');
  });

  test('no report', async () => {
    fs.existsSync.mockReturnValue(false);
    await runner.runCoverage('test', 'tdir', ['a.js']);
    expect(console.error).toHaveBeenCalledWith('❌ No coverage report found.');
    expect(console.info).toHaveBeenCalledWith(
      '✅ All source files have at least 80% coverage.'
    );
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });

  test('execSync throws is caught', async () => {
    execSync.mockImplementation(() => { throw new Error('je'); });
    fs.existsSync.mockReturnValue(false);
    await runner.runCoverage('test', 'tdir', ['a.js']);
    expect(console.error).toHaveBeenCalledWith(new Error('je'));
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });
});