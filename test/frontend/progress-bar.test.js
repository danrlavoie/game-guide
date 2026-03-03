import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadScript } from './helpers/load-scripts.js';

describe('ProgressBar component', function () {
  beforeAll(function () {
    // Stub minimal DOM API
    globalThis.document = {
      createElement: vi.fn(function () {
        var el = {
          className: '',
          style: {},
          children: [],
          appendChild: function (child) {
            el.children.push(child);
          },
        };
        return el;
      }),
    };

    loadScript('js/components/progress-bar.js');
  });

  it('defines ProgressBar on globalThis', function () {
    expect(globalThis.ProgressBar).toBeDefined();
  });

  it('has create method', function () {
    expect(typeof globalThis.ProgressBar.create).toBe('function');
  });

  it('create() returns object with el and update', function () {
    var pb = globalThis.ProgressBar.create();
    expect(pb).toHaveProperty('el');
    expect(pb).toHaveProperty('update');
    expect(typeof pb.update).toBe('function');
  });

  it('create() sets correct className on container', function () {
    var pb = globalThis.ProgressBar.create();
    expect(pb.el.className).toBe('viewer-progress');
  });

  it('update() sets correct width percentage', function () {
    var pb = globalThis.ProgressBar.create();
    pb.update(3, 10);
    // The bar is the first child of the container
    var bar = pb.el.children[0];
    expect(bar.style.width).toBe('30%');
  });

  it('update() handles zero total', function () {
    var pb = globalThis.ProgressBar.create();
    pb.update(0, 0);
    var bar = pb.el.children[0];
    expect(bar.style.width).toBe('0%');
  });
});
