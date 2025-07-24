const mockGetDirectoryToTest = jest.fn();
const mockGetOutputDirectory = jest.fn();
const mockGetConfig = jest.fn();
const mockGetUntestedFiles = jest.fn();
const mockGetAllSourceFiles = jest.fn();
const mockCreateTestFile = jest.fn();
const mockRerunAllTest = jest.fn();

jest.mock('../lib/config', () => ({
  getConfig: mockGetConfig,
  getDirectoryToTest: mockGetDirectoryToTest,
  getOutputDirectory: mockGetOutputDirectory,
}));

jest.mock('../lib/scanner', () => ({
  getUntestedFiles: mockGetUntestedFiles,
  getAllSourceFiles: mockGetAllSourceFiles,
}));

jest.mock('../lib/runner', () => ({
  createTestFile: mockCreateTestFile,
  rerunAllTest: mockRerunAllTest,
}));

describe('index.js start function', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should create tests and rerun when untested files exist', async () => {
    mockGetDirectoryToTest.mockResolvedValue('testDir');
    mockGetOutputDirectory.mockResolvedValue('outDir');
    mockGetConfig.mockResolvedValue({ connection: 'conn', model: 'mdl' });
    mockGetUntestedFiles.mockResolvedValue(['file1.js', 'file2.js']);
    mockCreateTestFile.mockResolvedValue();
    mockGetAllSourceFiles.mockResolvedValue(['src1.js', 'src2.js']);
    mockRerunAllTest.mockResolvedValue();

    jest.isolateModules(() => { require('../index.js'); });
    await new Promise(r => setImmediate(r));

    expect(mockGetDirectoryToTest).toHaveBeenCalledTimes(1);
    expect(mockGetOutputDirectory).toHaveBeenCalledTimes(1);
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockGetUntestedFiles).toHaveBeenCalledWith('testDir');
    expect(mockCreateTestFile).toHaveBeenCalledWith('conn', ['file1.js', 'file2.js'], 'testDir', 'mdl', 'outDir');
    expect(mockGetAllSourceFiles).toHaveBeenCalledWith('testDir');
    expect(mockRerunAllTest).toHaveBeenCalledWith(['src1.js', 'src2.js'], 'testDir', 'outDir', 'conn', 'mdl');
    expect(console.info).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should still run createTestFile and rerun when no untested files', async () => {
    mockGetDirectoryToTest.mockResolvedValue('D');
    mockGetOutputDirectory.mockResolvedValue('O');
    mockGetConfig.mockResolvedValue({ connection: 'C', model: 'M' });
    mockGetUntestedFiles.mockResolvedValue([]);
    const allFiles = ['s1.js', 's2.js'];
    mockGetAllSourceFiles.mockResolvedValue(allFiles);
    mockRerunAllTest.mockResolvedValue();

    jest.isolateModules(() => { require('../index.js'); });
    await new Promise(r => setImmediate(r));

    expect(mockCreateTestFile).toHaveBeenCalledWith('C', [], 'D', 'M', 'O');
    expect(mockGetAllSourceFiles).toHaveBeenCalledWith('D');
    expect(mockRerunAllTest).toHaveBeenCalledWith(allFiles, 'D', 'O', 'C', 'M');
    expect(console.info).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('error path: should catch and log error from getConfig without exiting', async () => {
    const err = new Error('boom');
    mockGetDirectoryToTest.mockResolvedValue('testDir');
    mockGetOutputDirectory.mockResolvedValue('outDir');
    mockGetConfig.mockRejectedValue(err);

    jest.isolateModules(() => { require('../index.js'); });
    await new Promise(r => setImmediate(r));

    expect(console.error).toHaveBeenCalledWith(err);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('error in createTestFile: should catch and log error without exiting', async () => {
    const err = new Error('create error');
    mockGetDirectoryToTest.mockResolvedValue('D');
    mockGetOutputDirectory.mockResolvedValue('O');
    mockGetConfig.mockResolvedValue({ connection: 'C', model: 'M' });
    mockGetUntestedFiles.mockResolvedValue(['u.js']);
    mockCreateTestFile.mockRejectedValue(err);

    jest.isolateModules(() => { require('../index.js'); });
    await new Promise(r => setImmediate(r));

    expect(mockCreateTestFile).toHaveBeenCalledWith('C', ['u.js'], 'D', 'M', 'O');
    expect(console.error).toHaveBeenCalledWith(err);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('error in rerunAllTest: should catch and log error without exiting', async () => {
    const err = new Error('rerun error');
    mockGetDirectoryToTest.mockResolvedValue('D');
    mockGetOutputDirectory.mockResolvedValue('O');
    mockGetConfig.mockResolvedValue({ connection: 'C', model: 'M' });
    mockGetUntestedFiles.mockResolvedValue(['u.js']);
    mockCreateTestFile.mockResolvedValue();
    mockGetAllSourceFiles.mockResolvedValue(['s1.js']);
    mockRerunAllTest.mockRejectedValue(err);

    jest.isolateModules(() => { require('../index.js'); });
    await new Promise(r => setImmediate(r));

    expect(mockRerunAllTest).toHaveBeenCalledWith(['s1.js'], 'D', 'O', 'C', 'M');
    expect(console.error).toHaveBeenCalledWith(err);
    expect(process.exit).not.toHaveBeenCalled();
  });
});