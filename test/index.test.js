const originalExit = process.exit;

describe('index.js CLI', () => {
  afterAll(() => {
    process.exit = originalExit;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });

  it('completes successfully and exits with code 0', async () => {
    const mockGetDirectoryToTest = jest.fn(() => Promise.resolve('test-dir'));
    const mockGetOutputDirectory = jest.fn(() => Promise.resolve('out-dir'));
    const mockGetConfig = jest.fn(() => Promise.resolve({ connection: 'conn', model: 'mod' }));
    jest.doMock('../lib/config', () => ({
      getDirectoryToTest: mockGetDirectoryToTest,
      getOutputDirectory: mockGetOutputDirectory,
      getConfig: mockGetConfig
    }));

    const mockGetUntestedFiles = jest.fn(() => Promise.resolve(['file1.js', 'file2.js']));
    const mockGetAllSourceFiles = jest.fn(() => Promise.resolve(['src1.js', 'src2.js']));
    jest.doMock('../lib/scanner', () => ({
      getUntestedFiles: mockGetUntestedFiles,
      getAllSourceFiles: mockGetAllSourceFiles
    }));

    const mockCreateTestFile = jest.fn(() => Promise.resolve());
    const mockRerunAllTest = jest.fn(() => Promise.resolve());
    const mockRunCoverage = jest.fn(() => Promise.resolve());
    jest.doMock('../lib/runner', () => ({
      createTestFile: mockCreateTestFile,
      rerunAllTest: mockRerunAllTest,
      runCoverage: mockRunCoverage
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.fn();
    process.exit = exitSpy;

    require('../index');

    await new Promise(resolve => {
      const check = () => {
        if (exitSpy.mock.calls.length) return resolve();
        setImmediate(check);
      };
      check();
    });

    expect(mockGetDirectoryToTest).toHaveBeenCalledTimes(1);
    expect(mockGetOutputDirectory).toHaveBeenCalledTimes(1);
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockGetUntestedFiles).toHaveBeenCalledWith('test-dir');
    expect(mockCreateTestFile).toHaveBeenCalledWith('conn', ['file1.js', 'file2.js'], 'mod', 'out-dir');
    expect(mockGetAllSourceFiles).toHaveBeenCalledWith('test-dir');
    expect(mockRerunAllTest).toHaveBeenCalledWith(['src1.js', 'src2.js'], 'out-dir', 'conn', 'mod');
    expect(mockRunCoverage).toHaveBeenCalledWith('test-dir', 'out-dir', ['src1.js', 'src2.js'], 'conn', 'mod');
    expect(infoSpy).toHaveBeenCalledWith("🎉 All files already have tests.");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles errors and logs them without exiting', async () => {
    const mockGetDirectoryToTest = jest.fn(() => Promise.resolve('test-dir'));
    const mockGetOutputDirectory = jest.fn(() => Promise.resolve('out-dir'));
    const mockGetConfig = jest.fn(() => Promise.resolve({ connection: 'conn', model: 'mod' }));
    jest.doMock('../lib/config', () => ({
      getDirectoryToTest: mockGetDirectoryToTest,
      getOutputDirectory: mockGetOutputDirectory,
      getConfig: mockGetConfig
    }));

    const testError = new Error('scan failed');
    const mockGetUntestedFiles = jest.fn(() => Promise.reject(testError));
    const mockGetAllSourceFiles = jest.fn();
    jest.doMock('../lib/scanner', () => ({
      getUntestedFiles: mockGetUntestedFiles,
      getAllSourceFiles: mockGetAllSourceFiles
    }));

    const mockCreateTestFile = jest.fn();
    const mockRerunAllTest = jest.fn();
    const mockRunCoverage = jest.fn();
    jest.doMock('../lib/runner', () => ({
      createTestFile: mockCreateTestFile,
      rerunAllTest: mockRerunAllTest,
      runCoverage: mockRunCoverage
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.fn();
    process.exit = exitSpy;

    require('../index');

    await new Promise(resolve => {
      const check = () => {
        if (errorSpy.mock.calls.length) return resolve();
        setImmediate(check);
      };
      check();
    });

    expect(mockGetDirectoryToTest).toHaveBeenCalledTimes(1);
    expect(mockGetUntestedFiles).toHaveBeenCalledWith('test-dir');
    expect(mockCreateTestFile).not.toHaveBeenCalled();
    expect(mockGetAllSourceFiles).not.toHaveBeenCalled();
    expect(mockRerunAllTest).not.toHaveBeenCalled();
    expect(mockRunCoverage).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe(testError);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});