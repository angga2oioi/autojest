jest.setTimeout(30000);

jest.mock('jaci', () => ({ string: jest.fn(), confirm: jest.fn() }));
const jaci = require('jaci');

jest.mock('../lib/config', () => ({ getConfig: jest.fn() }));
const { getConfig } = require('../lib/config');

jest.mock('../lib/scanner', () => ({ getUntestedFiles: jest.fn() }));
const { getUntestedFiles } = require('../lib/scanner');

jest.mock('../lib/testgen', () => ({ generateAndFixTest: jest.fn() }));
const { generateAndFixTest } = require('../lib/testgen');

jest.mock('../lib/runner', () => ({ runTest: jest.fn() }));
const { runTest } = require('../lib/runner');

jest.mock('openai', () => jest.fn().mockImplementation(() => ({})));
const OpenAI = require('openai');

jest.mock('child_process', () => ({ execSync: jest.fn() }));
const { execSync } = require('child_process');

jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));
const fs = require('fs');

const path = require('path');

describe('index.js CLI behavior', () => {
  let exitPromise;
  let exitResolve;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jaci.string.mockResolvedValue('rel');
    jaci.confirm.mockResolvedValue(true);

    getConfig.mockResolvedValue({ connection: {}, model: 'm', maxRetries: 1 });
    getUntestedFiles.mockResolvedValue(['file.js']);
    generateAndFixTest.mockResolvedValue();
    runTest.mockResolvedValue({ passed: true });
    execSync.mockImplementation(() => {});

    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');

    exitPromise = new Promise(resolve => { exitResolve = resolve; });
    process.exit = code => exitResolve(code);

    console.info = jest.fn();
    console.error = jest.fn();
  });

  function loadIndex() {
    jest.isolateModules(() => { require('../index.js'); });
    return exitPromise;
  }

  test('normal flow: generate tests, summary >80%, exit 0', async () => {
    const summary = { 'rel/file.js': { statements: { pct: 85 } } };
    fs.existsSync.mockImplementation(p => p.endsWith('coverage-summary.json'));
    fs.readFileSync.mockImplementation(() => JSON.stringify(summary));

    const code = await loadIndex();
    expect(code).toBe(0);
    expect(jaci.string).toHaveBeenCalledTimes(2);
    expect(getConfig).toHaveBeenCalled();
    expect(getUntestedFiles).toHaveBeenCalledWith('rel');
    expect(generateAndFixTest).toHaveBeenCalledTimes(1);
    expect(execSync).toHaveBeenCalledWith('npx jest --coverage', { stdio: 'inherit' });
    expect(jaci.confirm).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalledWith('❌ No coverage report found.');
  });

  test('no coverage report logs error and exits 0', async () => {
    fs.existsSync.mockReturnValue(false);

    const code = await loadIndex();
    expect(code).toBe(0);
    expect(console.error).toHaveBeenCalledWith('❌ No coverage report found.');
    expect(generateAndFixTest).toHaveBeenCalledTimes(1);
  });

  test('coverage failure, test fix loop, final and undercovered update', async () => {
    execSync.mockImplementationOnce(() => { throw new Error('fail'); }).mockImplementation(() => {});
    const projectRoot = process.cwd();
    const absPath = path.join(projectRoot, 'rel', 'file.js');
    const raw = { e: { path: absPath, s: { '1': 0, '2': 1 } } };

    fs.existsSync.mockImplementation(p => p.endsWith('coverage-final.json'));
    fs.readFileSync.mockImplementation(() => JSON.stringify(raw));

    jaci.string
      .mockResolvedValueOnce('rel')
      .mockResolvedValueOnce('testdir');
    runTest.mockResolvedValueOnce({ passed: false });
    jaci.confirm.mockResolvedValue(true);

    const code = await loadIndex();
    expect(code).toBe(0);
    expect(generateAndFixTest).toHaveBeenCalledTimes(3);
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(jaci.confirm).toHaveBeenCalled();
  });

  test('rejects absolute then accepts relative paths', async () => {
    jaci.string
      .mockResolvedValueOnce('/abs')
      .mockResolvedValueOnce('relDir')
      .mockResolvedValueOnce('/abs2')
      .mockResolvedValueOnce('testDir');
    fs.existsSync.mockReturnValue(false);

    const code = await loadIndex();
    expect(code).toBe(0);
    expect(jaci.string).toHaveBeenCalledTimes(4);
    expect(console.error).toHaveBeenCalledWith('❌ Absolute paths are not allowed. Please enter a relative path.');
    expect(console.error).toHaveBeenCalledWith('❌ Absolute paths are not allowed. Please enter a relative path for test directory.');
  });
});