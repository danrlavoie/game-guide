import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('config', function () {
  var originalEnv;

  beforeEach(function () {
    originalEnv = Object.assign({}, process.env);
  });

  afterEach(function () {
    // Restore original env
    process.env = originalEnv;
    // Clear require cache so config re-reads env vars
    var configPath = require.resolve('../../server/config');
    delete require.cache[configPath];
  });

  it('exports expected properties with defaults', function () {
    var config = require('../../server/config');
    expect(config).toHaveProperty('port', 3000);
    expect(config).toHaveProperty('documentsPath', '/documents');
    expect(config).toHaveProperty('dataPath');
    expect(config).toHaveProperty('pageDpi', 150);
    expect(config).toHaveProperty('thumbnailWidth', 200);
    expect(config).toHaveProperty('scanIntervalMinutes', 0);
    expect(config).toHaveProperty('pageQuality', 85);
  });

  it('exports derived paths', function () {
    var config = require('../../server/config');
    expect(config.dbPath).toContain('game-guide.db');
    expect(config.pagesPath).toContain('pages');
    expect(config.thumbnailsPath).toContain('thumbnails');
  });

  it('respects PORT env var', function () {
    process.env.PORT = '8080';
    var configPath = require.resolve('../../server/config');
    delete require.cache[configPath];
    var config = require('../../server/config');
    expect(config.port).toBe(8080);
  });

  it('respects PAGE_DPI env var', function () {
    process.env.PAGE_DPI = '300';
    var configPath = require.resolve('../../server/config');
    delete require.cache[configPath];
    var config = require('../../server/config');
    expect(config.pageDpi).toBe(300);
  });
});
