/**
 * Utility for identifying and filtering auto-generated files in diffs.
 */

import type { DiffFile } from '../types';

export const DEFAULT_GENERATED_PATTERNS = [
  '*.lock',
  '*-lock.json',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.snap',
  '*.generated.*',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'go.sum',
  'bun.lockb',
  'dist/**',
  'vendor/**',
  '__generated__/**',
];

const regexCache = new Map<string, RegExp>();

function globToRegex(pattern: string): RegExp {
  const cached = regexCache.get(pattern);
  if (cached) return cached;

  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      // ** — match anything including path separators
      if (pattern[i + 2] === '/') {
        regex += '(?:.*/)?';
        i += 3;
      } else {
        regex += '.*';
        i += 2;
      }
    } else if (char === '*') {
      regex += '[^/]*';
      i++;
    } else if (char === '?') {
      regex += '[^/]';
      i++;
    } else if (char === '{') {
      // Brace expansion: {a,b,c} → (?:a|b|c)
      const close = pattern.indexOf('}', i);
      if (close !== -1) {
        const alternatives = pattern.slice(i + 1, close).split(',');
        regex += '(?:' + alternatives.map(escapeRegex).join('|') + ')';
        i = close + 1;
      } else {
        regex += '\\{';
        i++;
      }
    } else if ('.+^$}()|[]\\'.includes(char)) {
      regex += '\\' + char;
      i++;
    } else {
      regex += char;
      i++;
    }
  }

  const compiled = new RegExp('^' + regex + '$');
  regexCache.set(pattern, compiled);
  return compiled;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isGeneratedFile(file: DiffFile, patterns: string[]): boolean {
  if (file.generated_file) return true;
  const path = file.new_path;
  return patterns.some((pattern) => globToRegex(pattern).test(path));
}

export function partitionFiles(
  files: DiffFile[],
  patterns: string[]
): { visible: DiffFile[]; generated: DiffFile[] } {
  const visible: DiffFile[] = [];
  const generated: DiffFile[] = [];
  for (const file of files) {
    if (isGeneratedFile(file, patterns)) {
      generated.push(file);
    } else {
      visible.push(file);
    }
  }
  return { visible, generated };
}
