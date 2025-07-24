jest.mock('ora', () => ({ default: jest.fn() })); // mock shape of ESM import
const fs = require('fs');
const path = require('path');
const ora = require('ora').default;
const { generateAndFixTest } = require('../../lib/testgen');

describe('generateAndFixTest', () => {
  let spinner;
  let originalCwd;
  beforeEach(() => {
    jest.clearAllMocks();
    originalCwd = process.cwd;
    process.cwd = jest.fn().mockReturnValue('/project');
    spinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn()
    };
    ora.mockReturnValue(spinner);
    jest.spyOn(fs, 'readFileSync').mockImplementation((p, enc) => {
      return `// dummy content of ${path.basename(p)}`;
    });
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it('generates test without existingTestCode and succeeds on first run', async () => {
    const sourcePath = '/project/src/foo.js';
    const client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'generated test code' } }]
          })
        }
      }
    };
    const runTest = jest.fn().mockResolvedValue({ passed: true });
    const options = {
      client,
      model: 'gpt-4',
      runTest,
      testDir: 'test',
      relativePath: 'src/foo.js'
    };

    await generateAndFixTest(sourcePath, options);

    expect(fs.readFileSync).toHaveBeenCalledWith(sourcePath, 'utf8');
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    const callArg = client.chat.completions.create.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4');
    expect(callArg.messages[0]).toEqual({ role: 'system', content: 'You write clean, idiomatic Jest tests.' });
    expect(callArg.messages[1].role).toBe('user');
    expect(callArg.messages[1].content).toContain('generate a **Jest unit test file**');
    const expectedTestRel = 'test/src/foo.test.js';
    const expectedTestPath = path.join('/project', expectedTestRel);
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(expectedTestPath), { recursive: true });
    expect(runTest).toHaveBeenCalledWith(expectedTestPath, 'generated test code');
    expect(spinner.succeed).toHaveBeenCalledWith('✅ Test written: foo.js');
  });

  it('retries when initial runTest fails and uses existingTestCode branch', async () => {
    const sourcePath = '/project/src/bar.js';
    const existingTestCode = 'old test code';
    const existingError = 'some error happened';
    const client = {
      chat: {
        completions: {
          create: jest.fn()
            .mockResolvedValueOnce({ choices: [{ message: { content: 'first fix code' } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'second fix code' } }] })
        }
      }
    };
    const runTest = jest.fn()
      .mockResolvedValueOnce({ passed: false, error: 'first run error' })
      .mockResolvedValueOnce({ passed: true });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const options = {
      client,
      model: 'gpt-4',
      runTest,
      testDir: 'test',
      relativePath: 'src/bar.js',
      existingTestCode,
      existingError
    };

    await generateAndFixTest(sourcePath, options);

    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
    const testRel = 'test/src/bar.test.js';
    const testPath = path.join('/project', testRel);
    expect(runTest.mock.calls[0]).toEqual([testPath, 'first fix code']);
    expect(runTest.mock.calls[1]).toEqual([testPath, 'second fix code']);
    expect(console.log).toHaveBeenCalledWith(', retry, attempt:', 0);
    expect(spinner.succeed).toHaveBeenCalledWith('✅ Test written: bar.js');
  });
});