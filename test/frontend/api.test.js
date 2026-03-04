import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadScript } from './helpers/load-scripts.js';

describe('API module', function () {
  beforeAll(function () {
    // Stub browser globals that api.js expects
    globalThis.fetch = vi.fn(function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({});
        },
      });
    });

    loadScript('js/api.js');
  });

  it('defines API on globalThis', function () {
    expect(globalThis.API).toBeDefined();
  });

  it('has getDocuments method', function () {
    expect(typeof globalThis.API.getDocuments).toBe('function');
  });

  it('has getDocument method', function () {
    expect(typeof globalThis.API.getDocument).toBe('function');
  });

  it('has getPageUrl method', function () {
    expect(typeof globalThis.API.getPageUrl).toBe('function');
  });

  it('has getThumbnailUrl method', function () {
    expect(typeof globalThis.API.getThumbnailUrl).toBe('function');
  });

  it('has getProgress method', function () {
    expect(typeof globalThis.API.getProgress).toBe('function');
  });

  it('has saveProgress method', function () {
    expect(typeof globalThis.API.saveProgress).toBe('function');
  });

  it('has search method', function () {
    expect(typeof globalThis.API.search).toBe('function');
  });

  it('has triggerScan method', function () {
    expect(typeof globalThis.API.triggerScan).toBe('function');
  });

  it('has getTextContent method', function () {
    expect(typeof globalThis.API.getTextContent).toBe('function');
  });

  it('has getSettings method', function () {
    expect(typeof globalThis.API.getSettings).toBe('function');
  });

  it('has saveSetting method', function () {
    expect(typeof globalThis.API.saveSetting).toBe('function');
  });

  it('has getDocumentSettings method', function () {
    expect(typeof globalThis.API.getDocumentSettings).toBe('function');
  });

  it('has saveDocumentSetting method', function () {
    expect(typeof globalThis.API.saveDocumentSetting).toBe('function');
  });

  it('has getDownloadUrl method', function () {
    expect(typeof globalThis.API.getDownloadUrl).toBe('function');
  });

  it('getPageUrl returns correct URL', function () {
    expect(globalThis.API.getPageUrl(42, 5)).toBe('/api/documents/42/pages/5');
  });

  it('getThumbnailUrl returns correct URL', function () {
    expect(globalThis.API.getThumbnailUrl(42)).toBe(
      '/api/documents/42/thumbnail'
    );
  });

  it('getDownloadUrl returns correct URL', function () {
    expect(globalThis.API.getDownloadUrl(42)).toBe(
      '/api/documents/42/download'
    );
  });

  it('has getBookmarks method', function () {
    expect(typeof globalThis.API.getBookmarks).toBe('function');
  });

  it('has addBookmark method', function () {
    expect(typeof globalThis.API.addBookmark).toBe('function');
  });

  it('has updateBookmark method', function () {
    expect(typeof globalThis.API.updateBookmark).toBe('function');
  });

  it('has deleteBookmark method', function () {
    expect(typeof globalThis.API.deleteBookmark).toBe('function');
  });

  it('has getFavorites method', function () {
    expect(typeof globalThis.API.getFavorites).toBe('function');
  });

  it('has addFavorite method', function () {
    expect(typeof globalThis.API.addFavorite).toBe('function');
  });

  it('has removeFavorite method', function () {
    expect(typeof globalThis.API.removeFavorite).toBe('function');
  });
});
