const path = require('path');

beforeEach(() => {
  jest.resetModules(); // clear module registry
  jest.clearAllMocks();  // clear mock calls
});

afterEach(() => {
  jest.restoreAllMocks(); // restore spy implementations
});

test('success flow: calls all functions and exits with code 0', async () => {
  // Mock config module
  const getConfig = jest.fn().mockResolvedValue();
  const getDirectoryToTest = jest.fn().mockResolvedValue('/src');
  const getOutputDirectory = jest.fn().mockResolvedValue('/tests');
  jest.doMock(path.resolve(__dirname, '../lib/config'), () => ({
    getConfig,
    getDirectoryToTest,
    getOutputDirectory,
  }));
  // Mock scanner module
  const getUntestedFiles = jest.fn().mockResolvedValue(['file1.js', 'file2.js']);
  const getAllSourceFiles = jest.fn().mockResolvedValue(['file1.js', 'file2.js', 'file3.js']);
  jest.doMock(path.resolve(__dirname, '../lib/scanner'), () => ({
    getUntestedFiles,
    getAllSourceFiles,
  }));
  // Mock runner module
  const createTestFile = jest.fn().mockResolvedValue();
  const rerunAllTest = jest.fn().mockResolvedValue();
  const runCoverage = jest.fn().mockResolvedValue();
  jest.doMock(path.resolve(__dirname, '../lib/runner'), () => ({
    createTestFile,
    rerunAllTest,
    runCoverage,
  }));
  // Spy on console and exit
  const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});

  // Load module
  jest.isolateModules(async () => {
    require(path.resolve(__dirname, '../index.js'));
  });

  // Wait for async start() to complete
  await new Promise(resolve => setImmediate(resolve));

  expect(getConfig).toHaveBeenCalledTimes(1);
  expect(getDirectoryToTest).toHaveBeenCalledTimes(1);
  expect(getOutputDirectory).toHaveBeenCalledTimes(1);

  expect(getUntestedFiles).toHaveBeenCalledWith('/src');
  expect(getAllSourceFiles).toHaveBeenCalledWith('/src');

  expect(createTestFile).toHaveBeenCalledWith(['file1.js', 'file2.js'], '/tests');
  expect(rerunAllTest).toHaveBeenCalledWith(['file1.js', 'file2.js', 'file3.js'], '/tests');
  expect(runCoverage).toHaveBeenCalledWith('/src', '/tests', ['file1.js', 'file2.js', 'file3.js']);

  expect(consoleInfo).toHaveBeenCalledWith('🎉 All files already have tests.');
  expect(consoleError).not.toHaveBeenCalled();
  expect(exitMock).toHaveBeenCalledWith(0);
});

test('failure flow: getConfig rejects and logs error without exiting', async () => {
  const error = new Error('config error');
  const getConfig = jest.fn().mockRejectedValue(error);
  const getDirectoryToTest = jest.fn();
  const getOutputDirectory = jest.fn();
  jest.doMock(path.resolve(__dirname, '../lib/config'), () => ({
    getConfig,
    getDirectoryToTest,
    getOutputDirectory,
  }));
  // scanner and runner mocks
  const getUntestedFiles = jest.fn().mockResolvedValue([]);
  const getAllSourceFiles = jest.fn().mockResolvedValue([]);
  jest.doMock(path.resolve(__dirname, '../lib/scanner'), () => ({
    getUntestedFiles,
    getAllSourceFiles,
  }));
  const createTestFile = jest.fn().mockResolvedValue();
  const rerunAllTest = jest.fn().mockResolvedValue();
  const runCoverage = jest.fn().mockResolvedValue();
  jest.doMock(path.resolve(__dirname, '../lib/runner'), () => ({
    createTestFile,
    rerunAllTest,
    runCoverage,
  }));
  // Spy on console and exit
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});

  jest.isolateModules(() => {
    require(path.resolve(__dirname, '../index.js'));
  });

  await new Promise(resolve => setImmediate(resolve));

  expect(getConfig).toHaveBeenCalledTimes(1);
  expect(getDirectoryToTest).not.toHaveBeenCalled();
  expect(getOutputDirectory).not.toHaveBeenCalled();

  expect(getUntestedFiles).not.toHaveBeenCalled();
  expect(createTestFile).not.toHaveBeenCalled();
  expect(rerunAllTest).not.toHaveBeenCalled();
  expect(runCoverage).not.toHaveBeenCalled();

  expect(consoleError).toHaveBeenCalledWith(error);
  expect(exitMock).not.toHaveBeenCalled();
});