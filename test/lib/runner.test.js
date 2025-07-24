jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
jest.mock('openai', () => {
  return jest.fn().mockImplementation((connection) => ({ connection }));
});
jest.mock('../../lib/testgen', () => ({
  generateAndFixTest: jest.fn(),
}));
jest.mock('jaci', () => ({
  confirm: jest.fn(),
}));

const fs = require('fs');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const { generateAndFixTest } = require('../../lib/testgen');
const jaci = require('jaci');
const path = require('path');
const {
  runTest,
  createTestFile,
  rerunAllTest,
  runCoverage,
} = require('../../lib/runner');

describe('runTest', () => {
  beforeEach(() => {
    fs.writeFileSync.mockClear();
    execSync.mockClear();
  });

  it('writes file and returns passed true on success', async () => {
    execSync.mockImplementation(() => {});
    const result = await runTest('file.js', 'test code');
    expect(fs.writeFileSync).toHaveBeenCalledWith('file.js', 'test code');
    expect(execSync).toHaveBeenCalledWith(
      `npx jest file.js --runInBand --verbose`,
      expect.objectContaining({ stdio: 'pipe', encoding: 'utf8' })
    );
    expect(result).toEqual({ passed: true, error: null });
  });

  it('does not write file if no testCode and returns false with stdout on failure', async () => {
    const err = new Error('fail');
    err.stdout = 'error output';
    execSync.mockImplementation(() => { throw err; });
    const result = await runTest('file.js');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(result).toEqual({ passed: false, error: 'error output' });
  });

  it('returns false with message if err.stdout is undefined', async () => {
    const err = new Error('some message');
    execSync.mockImplementation(() => { throw err; });
    const result = await runTest('file.js');
    expect(result).toEqual({ passed: false, error: 'some message' });
  });
});

describe('createTestFile', () => {
  beforeEach(() => {
    generateAndFixTest.mockClear();
    OpenAI.mockClear();
    console.info = jest.fn();
  });

  it('does nothing when untestedFiles is empty', async () => {
    await createTestFile('conn', [], '/dir', 'model', 'testDir');
    expect(generateAndFixTest).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('generates tests for each untested file', async () => {
    const files = ['a.js', 'sub/b.js'];
    await createTestFile('connection', files, '/root', 'm', 'tDir');
    expect(OpenAI).toHaveBeenCalledWith('connection');
    const client = OpenAI.mock.results[0].value;
    expect(generateAndFixTest).toHaveBeenCalledTimes(2);
    expect(generateAndFixTest).toHaveBeenCalledWith(
      path.join('/root', 'a.js'),
      { client, model: 'm', runTest, testDir: 'tDir', relativePath: 'a.js' }
    );
    expect(generateAndFixTest).toHaveBeenCalledWith(
      path.join('/root', 'sub/b.js'),
      { client, model: 'm', runTest, testDir: 'tDir', relativePath: 'sub/b.js' }
    );
    expect(console.info).toHaveBeenCalledWith('✅ Tests generated.');
  });
});

describe('rerunAllTest', () => {
  beforeEach(() => {
    generateAndFixTest.mockClear();
    fs.readFileSync.mockClear();
    execSync.mockClear();
    console.log = jest.fn();
    console.info = jest.fn();
    OpenAI.mockClear();
  });

  it('skips fixing when tests pass', async () => {
    fs.readFileSync.mockReturnValue('code');
    execSync.mockImplementation(() => {});
    await rerunAllTest(['f.js'], '/root', 'tDir', 'conn', 'model');
    const full = path.join('/root', 'f.js');
    expect(console.log).toHaveBeenCalledWith(`Running test for ${full}`);
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });

  it('fixes test when runTest fails', async () => {
    fs.readFileSync.mockReturnValue('oldcode');
    execSync.mockImplementation(() => {
      const e = new Error('err');
      e.stdout = undefined;
      throw e;
    });
    await rerunAllTest(['f.js'], '/root', 'tDir', 'conn', 'model');
    const full = path.join('/root', 'f.js');
    expect(console.info).toHaveBeenCalledWith(`🔄 Fixing test for f.js`);
    const client = OpenAI.mock.results[0].value;
    expect(generateAndFixTest).toHaveBeenCalledWith(
      full,
      expect.objectContaining({
        client,
        model: 'model',
        runTest,
        testDir: 'tDir',
        relativePath: 'f.js',
        existingTestCode: 'oldcode',
        existingError: 'err',
      })
    );
  });
});

describe('runCoverage', () => {
  const projectRoot = '/cwd';
  beforeEach(() => {
    jest.spyOn(process, 'cwd').mockReturnValue(projectRoot);
    fs.existsSync.mockClear();
    fs.readFileSync.mockClear();
    execSync.mockClear();
    execSync.mockImplementation(() => {});
    generateAndFixTest.mockClear();
    jaci.confirm.mockClear();
    console.error = jest.fn();
    console.info = jest.fn();
  });

  it('updates tests when undercovered and user confirms', async () => {
    const summary = { 'src1.js': { statements: { pct: 50 } } };
    fs.existsSync.mockImplementation((p) => p.endsWith('coverage-summary.json'));
    fs.readFileSync.mockReturnValue(JSON.stringify(summary));
    jaci.confirm.mockResolvedValue(true);
    await runCoverage('', '', ['src1.js'], 'conn', 'model');
    expect(console.info).toHaveBeenCalledWith('⚠️  Source files under 80% coverage:');
    expect(jaci.confirm).toHaveBeenCalled();
    expect(generateAndFixTest).toHaveBeenCalledWith(
      path.join('', 'src1.js'),
      expect.objectContaining({ client: expect.any(Object), model: 'model', runTest, testDir: '' })
    );
    expect(console.info).toHaveBeenCalledWith('✅ Tests updated for under-covered files.');
  });

  it('logs success when all files covered', async () => {
    const summary = { 'src1.js': { statements: { pct: 90 } } };
    fs.existsSync.mockImplementation((p) => p.endsWith('coverage-summary.json'));
    fs.readFileSync.mockReturnValue(JSON.stringify(summary));
    await runCoverage('', '', ['src1.js'], 'conn', 'model');
    expect(console.info).toHaveBeenCalledWith('✅ All source files have at least 80% coverage.');
  });

  it('uses final report when summary missing', async () => {
    const entry = { path: path.join(projectRoot, 'a.js'), s: { a: 1, b: 0 } };
    fs.existsSync.mockImplementation((p) => p.endsWith('coverage-final.json'));
    fs.readFileSync.mockReturnValue(JSON.stringify({ x: entry }));
    jaci.confirm.mockResolvedValue(false);
    await runCoverage('', '', ['a.js'], 'conn', 'model');
    expect(console.info).toHaveBeenCalledWith('⚠️  Source files under 80% coverage:');
    expect(jaci.confirm).toHaveBeenCalled();
    expect(generateAndFixTest).not.toHaveBeenCalled();
  });

  it('handles missing coverage reports', async () => {
    fs.existsSync.mockReturnValue(false);
    await runCoverage('', '', ['a.js'], 'conn', 'model');
    expect(console.error).toHaveBeenCalledWith('❌ No coverage report found.');
    expect(console.info).toHaveBeenCalledWith('✅ All source files have at least 80% coverage.');
  });
});