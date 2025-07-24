jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn(),
  })),
}));

const fs = require('fs');
const path = require('path');
const ora = require('ora').default;
const { generateAndFixTest } = require('../../lib/testgen');

describe('generateAndFixTest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue('/project');
    fs.readFileSync = jest.fn().mockReturnValue('console.log("hello");');
    fs.mkdirSync = jest.fn();
  });
  afterAll(() => {
    process.cwd.mockRestore();
  });

  test('writes test once when runTest passes immediately', async () => {
    const client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'test code content' } }],
          }),
        },
      },
    };
    const runTest = jest.fn().mockResolvedValue({ passed: true });
    const options = {
      client,
      model: 'gpt-4',
      maxRetries: 3,
      runTest,
      testDir: 'tests',
      relativePath: 'src/file.js',
    };

    await generateAndFixTest('/project/src/file.js', options);

    expect(fs.readFileSync).toHaveBeenCalledWith('/project/src/file.js', 'utf8');
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    const callArg = client.chat.completions.create.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4');
    expect(callArg.messages[0]).toEqual({
      role: 'system',
      content: 'You write clean, idiomatic Jest tests.',
    });
    expect(callArg.messages.some((m) => m.role === 'user')).toBe(true);

    const expectedTestPath = path.join('/project', 'tests', 'src/file.test.js');
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(expectedTestPath), { recursive: true });
    expect(runTest).toHaveBeenCalledWith(expectedTestPath, 'test code content');

    expect(ora).toHaveBeenCalledWith('Generate test for /project/src/file.js');
    const spinner = ora.mock.results[0].value;
    expect(spinner.start).toHaveBeenCalled();
    expect(spinner.succeed).toHaveBeenCalledWith('✅ Test written: file.js');
  });

  test('retries on failure until success', async () => {
    const client = {
      chat: {
        completions: {
          create: jest
            .fn()
            .mockResolvedValueOnce({ choices: [{ message: { content: 'code1' } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'code2' } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'code3' } }] }),
        },
      },
    };
    const runTest = jest
      .fn()
      .mockResolvedValueOnce({ passed: false, error: 'error1' })
      .mockResolvedValueOnce({ passed: false, error: 'error2' })
      .mockResolvedValueOnce({ passed: true });
    const options = {
      client,
      model: 'modelX',
      maxRetries: '5',
      runTest,
      testDir: 'tDir',
      relativePath: 'a/b/c.ts',
    };

    await generateAndFixTest('/project/a/b/c.ts', options);

    expect(client.chat.completions.create).toHaveBeenCalledTimes(3);
    expect(runTest).toHaveBeenCalledTimes(3);

    const secondCreate = client.chat.completions.create.mock.calls[1][0].messages;
    expect(secondCreate[secondCreate.length - 1]).toMatchObject({
      role: 'user',
      content: expect.stringContaining('error1'),
    });

    const expectedPath = path.join('/project', 'tDir', 'a/b/c.test.ts');
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(expectedPath), { recursive: true });
  });

  test('stops after maxRetries when failure persists', async () => {
    const client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'bad code' } }] }),
        },
      },
    };
    const runTest = jest.fn().mockResolvedValue({ passed: false, error: 'fail always' });
    const options = {
      client,
      model: 'm',
      maxRetries: 0,
      runTest,
      testDir: 'D',
      relativePath: 'f.js',
    };

    await generateAndFixTest('/project/f.js', options);

    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(runTest).toHaveBeenCalledTimes(1);
  });
});