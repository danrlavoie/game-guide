import { describe, it, expect } from 'vitest';

var { shellEscape } = require('../../server/utils/exec');

describe('shellEscape', function () {
  it('escapes backslashes', function () {
    expect(shellEscape('a\\b')).toBe('a\\\\b');
  });

  it('escapes double quotes', function () {
    expect(shellEscape('say "hello"')).toBe('say \\"hello\\"');
  });

  it('escapes dollar signs', function () {
    expect(shellEscape('$HOME')).toBe('\\$HOME');
  });

  it('escapes backticks', function () {
    expect(shellEscape('`cmd`')).toBe('\\`cmd\\`');
  });

  it('does not escape single quotes', function () {
    expect(shellEscape("it's")).toBe("it's");
  });

  it('does not escape exclamation marks', function () {
    expect(shellEscape('hello!')).toBe('hello!');
  });

  it('handles strings with no special characters', function () {
    expect(shellEscape('plain text')).toBe('plain text');
  });

  it('handles empty string', function () {
    expect(shellEscape('')).toBe('');
  });

  it('escapes multiple special characters together', function () {
    expect(shellEscape('$HOME/path\\"file`')).toBe(
      '\\$HOME/path\\\\\\"file\\`'
    );
  });
});
