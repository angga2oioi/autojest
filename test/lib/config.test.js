const fs = require('fs');
const os = require('os');
const path = require('path');
const jaci = require('jaci');
const { getConfig } = require('../../lib/config');

const originalPlatform = process.platform;

function setPlatform(value) {
  Object.defineProperty(process, 'platform', {
    value,
    writable: true
  });
}

describe('getConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.APPDATA;
    fs.existsSync = jest.fn();
    fs.mkdirSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    jaci.confirm = jest.fn();
    jaci.string = jest.fn();
    jaci.number = jest.fn();
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  test('linux platform, dir missing and config missing, prompts and writes', async () => {
    setPlatform('linux');
    const home = '/home/user';
    jest.spyOn(os, 'homedir').mockReturnValue(home);
    const dir = path.join(home, '.config', 'autojest');
    const configPath = path.join(dir, 'config.json');
    fs.existsSync.mockReturnValue(false);
    const connStr = '{"host":"localhost"}';
    const model = 'GPT';
    const maxRetries = 3;
    jaci.string.mockImplementation((prompt) => {
      if (prompt.includes('Open AI Connection')) return Promise.resolve(connStr);
      if (prompt.includes('AI Model')) return Promise.resolve(model);
      return Promise.resolve('');
    });
    jaci.number.mockResolvedValue(maxRetries);
    const result = await getConfig();
    expect(fs.existsSync).toHaveBeenCalledWith(dir);
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(jaci.confirm).not.toHaveBeenCalled();
    expect(jaci.string).toHaveBeenCalledTimes(2);
    expect(jaci.number).toHaveBeenCalledWith(expect.stringContaining('Max Retries'), { required: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ connection: JSON.parse(connStr), model, maxRetries }, null, 2)
    );
    expect(result).toEqual({ connection: JSON.parse(connStr), model, maxRetries });
  });

  test('linux platform, dir exists and config exists, confirm yes reads file', async () => {
    setPlatform('linux');
    const home = '/home/user';
    jest.spyOn(os, 'homedir').mockReturnValue(home);
    const dir = path.join(home, '.config', 'autojest');
    const configPath = path.join(dir, 'config.json');
    fs.existsSync.mockImplementation(p => p === dir || p === configPath);
    const fileContent = '{"existing":"config"}';
    fs.readFileSync.mockReturnValue(fileContent);
    jaci.confirm.mockResolvedValue(true);
    const result = await getConfig();
    expect(fs.existsSync).toHaveBeenCalledWith(dir);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(jaci.confirm).toHaveBeenCalledWith(
      'Use saved config? (Y/N)',
      { default: true, confirm: { true: 'Y', false: 'N' } }
    );
    expect(fs.readFileSync).toHaveBeenCalledWith(configPath, 'utf-8');
    expect(result).toEqual(JSON.parse(fileContent));
  });

  test('linux platform, dir exists and config exists, confirm no then prompts and writes', async () => {
    setPlatform('linux');
    const home = '/home/user';
    jest.spyOn(os, 'homedir').mockReturnValue(home);
    const dir = path.join(home, '.config', 'autojest');
    const configPath = path.join(dir, 'config.json');
    fs.existsSync.mockImplementation(p => p === dir || p === configPath);
    jaci.confirm.mockResolvedValue(false);
    const connStr = '{"url":"api"}';
    const model = 'MODELX';
    const maxRetries = 5;
    jaci.string.mockImplementation((prompt) => {
      if (prompt.includes('Connection')) return Promise.resolve(connStr);
      if (prompt.includes('Model')) return Promise.resolve(model);
      return Promise.resolve('');
    });
    jaci.number.mockResolvedValue(maxRetries);
    const result = await getConfig();
    expect(jaci.confirm).toHaveBeenCalled();
    expect(jaci.string).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ connection: JSON.parse(connStr), model, maxRetries }, null, 2)
    );
    expect(result).toEqual({ connection: JSON.parse(connStr), model, maxRetries });
  });

  test('windows platform with APPDATA defined, dir missing and prompts', async () => {
    setPlatform('win32');
    process.env.APPDATA = '/appdata';
    jest.spyOn(os, 'homedir').mockReturnValue('/home/fallback');
    const dir = path.join(process.env.APPDATA, 'autojest');
    const configPath = path.join(dir, 'config.json');
    fs.existsSync.mockReturnValue(false);
    const connStr = '{"x":1}';
    const model = 'WIN_MODEL';
    const maxRetries = 2;
    jaci.string.mockImplementation((prompt) => {
      if (prompt.includes('Connection')) return Promise.resolve(connStr);
      if (prompt.includes('Model')) return Promise.resolve(model);
      return Promise.resolve('');
    });
    jaci.number.mockResolvedValue(maxRetries);
    const result = await getConfig();
    expect(fs.existsSync).toHaveBeenCalledWith(dir);
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(result).toEqual({ connection: JSON.parse(connStr), model, maxRetries });
  });

  test('windows platform with APPDATA undefined, uses homedir', async () => {
    setPlatform('win32');
    delete process.env.APPDATA;
    const home = '/home/user2';
    jest.spyOn(os, 'homedir').mockReturnValue(home);
    const dir = path.join(home, 'autojest');
    const configPath = path.join(dir, 'config.json');
    fs.existsSync.mockReturnValue(false);
    const connStr = '{"y":2}';
    const model = 'NO_APPDATA';
    const maxRetries = 4;
    jaci.string.mockImplementation((prompt) => {
      if (prompt.includes('Connection')) return Promise.resolve(connStr);
      if (prompt.includes('Model')) return Promise.resolve(model);
      return Promise.resolve('');
    });
    jaci.number.mockResolvedValue(maxRetries);
    const result = await getConfig();
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(result).toEqual({ connection: JSON.parse(connStr), model, maxRetries });
  });
});