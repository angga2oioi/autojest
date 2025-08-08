const fs = require('fs');
const path = require('path');

let mockSpinner;
jest.mock('ora', () => ({
  default: jest.fn(() => mockSpinner),
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation((connection) => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'generated test code' } }],
        }),
      },
    },
  }));
});

const mockLoadConfig = jest.fn();
jest.mock('../../lib/config', () => ({
  loadConfig: mockLoadConfig,
  getConfig: jest.fn(),
}));

const OpenAI = require('openai');
const ora = require('ora').default;
const { generateAndFixTest } = require('../../lib/testgen');

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockSpinner = {
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn(),
    fail: jest.fn(),
  };
  jest.spyOn(process, 'cwd').mockReturnValue('/project');
  jest.spyOn(fs, 'readFileSync').mockReturnValue('const a = 1;');
  jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
});

test('initial generation, test passes first time', async () => {
  mockLoadConfig.mockResolvedValue({
    connection: { apiKey: '123' },
    model: 'model1',
    maxRetries: 3,
  });
  const runTest = jest.fn().mockResolvedValue({ passed: true });

  await generateAndFixTest(
    '/project/src/file.js',
    { runTest, testDir: '__tests__', relativePath: 'src/file.js' }
  );

  expect(mockLoadConfig).toHaveBeenCalled();
  expect(OpenAI).toHaveBeenCalledWith({ apiKey: '123' });
  const clientInstance = OpenAI.mock.results[0].value;
  expect(clientInstance.chat.completions.create).toHaveBeenCalledTimes(1);
  const expectedTestPath = path.join('/project', '__tests__/src/file.test.js');
  expect(runTest).toHaveBeenCalledWith(expectedTestPath, 'generated test code');
  expect(mockSpinner.succeed).toHaveBeenCalledWith('✅ Test written: file.js');
  expect(mockSpinner.fail).not.toHaveBeenCalled();
});

test('existing test code provided, test passes first time', async () => {
  mockLoadConfig.mockResolvedValue({
    connection: {},
    model: 'model2',
    maxRetries: 1,
  });
  const runTest = jest.fn().mockResolvedValue({ passed: true });
  const existingTestCode = 'describe("x", ()=>{})';
  const existingError = 'SyntaxError';

  await generateAndFixTest(
    '/project/src/file.js',
    {
      runTest,
      testDir: '__tests__',
      relativePath: 'src/file.js',
      existingTestCode,
      existingError,
    }
  );

  expect(mockLoadConfig).toHaveBeenCalled();
  expect(OpenAI).toHaveBeenCalledWith({});
  const clientInstance = OpenAI.mock.results[0].value;
  expect(clientInstance.chat.completions.create).toHaveBeenCalledTimes(1);
  const expectedTestPath = path.join('/project', '__tests__/src/file.test.js');
  expect(runTest).toHaveBeenCalledWith(expectedTestPath, 'generated test code');
  expect(mockSpinner.succeed).toHaveBeenCalledWith('✅ Test written: file.js');
  expect(mockSpinner.fail).not.toHaveBeenCalled();
});

test('retries until maxRetries and fails', async () => {
  mockLoadConfig.mockResolvedValue({
    connection: { x: 'y' },
    model: 'model3',
    maxRetries: 2,
  });
  const runTest = jest
    .fn()
    .mockResolvedValueOnce({ passed: false, error: 'err1' })
    .mockResolvedValueOnce({ passed: false, error: 'err2' });

  await generateAndFixTest(
    '/project/src/file.js',
    { runTest, testDir: '__tests__', relativePath: 'src/file.js' }
  );

  expect(mockLoadConfig).toHaveBeenCalled();
  expect(OpenAI).toHaveBeenCalledWith({ x: 'y' });
  const clientInstance = OpenAI.mock.results[0].value;
  expect(clientInstance.chat.completions.create).toHaveBeenCalledTimes(3);
  const expectedTestPath = path.join('/project', '__tests__/src/file.test.js');
  expect(runTest).toHaveBeenCalledTimes(2);
  expect(runTest).toHaveBeenNthCalledWith(1, expectedTestPath, 'generated test code');
  expect(runTest).toHaveBeenNthCalledWith(2, expectedTestPath, 'generated test code');
  expect(mockSpinner.fail).toHaveBeenCalledWith('❌ Fail to write test for: file.js');
  expect(mockSpinner.succeed).not.toHaveBeenCalled();
});