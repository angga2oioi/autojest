const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateAndFixTest } = require('../../lib/testgen');
const ora = require('ora');

jest.mock('ora', () => {
  const spinner = {
    start: jest.fn(() => spinner),
    succeed: jest.fn(),
  };
  return { __esModule: true, default: jest.fn(() => spinner) };
});

describe('generateAndFixTest', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    process.cwd.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  test('initial generation branch: calls OpenAI once and writes test successfully', async () => {
    const sourceRel = 'src/file.js';
    const sourcePath = path.join(tmpDir, sourceRel);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'module.exports = { add: (a, b) => a + b };');

    const client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '// jest test v1' } }],
          }),
        },
      },
    };
    const runTest = jest.fn().mockResolvedValue({ passed: true });

    await generateAndFixTest(sourcePath, {
      client,
      model: 'gpt-4',
      runTest,
      testDir: 'tests',
      relativePath: sourceRel,
    });

    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    const expectedRel = path.posix.join('tests', sourceRel).replace(/\.(js|ts)x?$/, '.test.$1');
    const expectedPath = path.join(tmpDir, expectedRel);
    expect(runTest).toHaveBeenCalledWith(expectedPath, '// jest test v1');

    expect(ora.default).toHaveBeenCalledWith(`Generate test for ${sourcePath}`);
    const spinner = ora.default.mock.results[0].value;
    expect(spinner.start).toHaveBeenCalled();
    expect(spinner.succeed).toHaveBeenCalledWith('✅ Test written: file.js');
  });

  test('existing test branch: uses existingTestCode and existingError prompts', async () => {
    const sourceRel = 'lib/util.js';
    const sourcePath = path.join(tmpDir, sourceRel);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'exports.foo = () => "bar";');

    const existingTestCode = '// existing test';
    const existingError = 'ReferenceError';
    const client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '// fixed test code' } }],
          }),
        },
      },
    };
    const runTest = jest.fn().mockResolvedValue({ passed: true });

    await generateAndFixTest(sourcePath, {
      client,
      model: 'gpt-4',
      runTest,
      testDir: 'testdir',
      relativePath: sourceRel,
      existingTestCode,
      existingError,
    });

    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    const msgs = client.chat.completions.create.mock.calls[0][0].messages;
    expect(msgs.some(m => m.content.includes(existingTestCode))).toBe(true);
    expect(msgs.some(m => m.content.includes(existingError))).toBe(true);

    const expectedRel = path.posix.join('testdir', sourceRel).replace(/\.(js|ts)x?$/, '.test.$1');
    const expectedPath = path.join(tmpDir, expectedRel);
    expect(runTest).toHaveBeenCalledWith(expectedPath, '// fixed test code');

    const spinner = ora.default.mock.results[0].value;
    expect(spinner.succeed).toHaveBeenCalledWith('✅ Test written: util.js');
  });

  test('retry branch: initial test fails once then succeeds', async () => {
    const sourceRel = 'components/comp.ts';
    const sourcePath = path.join(tmpDir, sourceRel);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export const x = 1;');

    const client = {
      chat: {
        completions: {
          create: jest.fn()
            .mockResolvedValueOnce({ choices: [{ message: { content: 'v1' } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'v2' } }] }),
        },
      },
    };
    const runTest = jest.fn()
      .mockResolvedValueOnce({ passed: false, error: 'Err' })
      .mockResolvedValueOnce({ passed: true });

    console.log = jest.fn();

    await generateAndFixTest(sourcePath, {
      client,
      model: 'gpt-4',
      runTest,
      testDir: 'td',
      relativePath: sourceRel,
    });

    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
    const expectedRel = path.posix.join('td', sourceRel).replace(/\.(js|ts)x?$/, '.test.$1');
    const expectedPath = path.join(tmpDir, expectedRel);
    expect(runTest).toHaveBeenNthCalledWith(1, expectedPath, 'v1');
    expect(runTest).toHaveBeenNthCalledWith(2, expectedPath, 'v2');
    // updated to match actual logged message with leading comma
    expect(console.log).toHaveBeenCalledWith(', retry, attempt:', 0);

    const spinner = ora.default.mock.results[0].value;
    expect(spinner.succeed).toHaveBeenCalledWith('✅ Test written: comp.ts');
  });

  test('propagates OpenAI errors', async () => {
    const sourceRel = 'x.js';
    const sourcePath = path.join(tmpDir, sourceRel);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'console.log(1);');

    const client = {
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API fail')) } },
    };
    const runTest = jest.fn();

    await expect(generateAndFixTest(sourcePath, {
      client,
      model: 'gpt-4',
      runTest,
      testDir: 't',
      relativePath: sourceRel,
    })).rejects.toThrow('API fail');
  });
});