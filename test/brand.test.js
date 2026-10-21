import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  OPENING_SEEN_KEY,
  BRAND_COLORS,
  OPENING_ANIMATION_CONFIG
} from '../src/lib/brandConstants.js';

describe('Brand Identity & Opening Animation Tests', () => {
  test('OPENING_SEEN_KEY has expected session storage key', () => {
    assert.strictEqual(OPENING_SEEN_KEY, 'typeddoc_opening_seen_v1');
  });

  test('BRAND_COLORS defines authoritative color palette tokens', () => {
    assert.strictEqual(BRAND_COLORS.brown, '#3D2E1C');
    assert.strictEqual(BRAND_COLORS.paper, '#FFFBF5');
    assert.strictEqual(BRAND_COLORS.amber, '#C4853C');
    assert.strictEqual(BRAND_COLORS.gold, '#D99A4A');
    assert.strictEqual(BRAND_COLORS.border, '#E8DFD0');
  });

  test('OPENING_ANIMATION_CONFIG specifies appropriate pacing under 2.5s', () => {
    assert.ok(OPENING_ANIMATION_CONFIG.standardDurationMs <= 2500);
    assert.ok(OPENING_ANIMATION_CONFIG.reducedMotionDurationMs <= 500);
  });

  test('public/favicon.svg exists and contains valid document mark paths', () => {
    const faviconPath = path.resolve('public', 'favicon.svg');
    assert.ok(fs.existsSync(faviconPath), 'public/favicon.svg must exist');

    const content = fs.readFileSync(faviconPath, 'utf8');
    assert.ok(content.includes('<svg'), 'Favicon must be an SVG element');
    assert.ok(content.includes('#C8873B') || content.includes('#D99A4A') || content.includes('td-doc-grad'), 'Favicon must use brand amber');
    assert.ok(content.includes('rect') && content.includes('path'), 'Favicon must render document body and text lines');
  });

  test('public/brand/logo.jpg, brand-mark.png, and logo.png exist and are accessible', () => {
    const markPath = path.resolve('public', 'brand', 'brand-mark.png');
    const logoPngPath = path.resolve('public', 'brand', 'logo.png');
    const logoJpgPath = path.resolve('public', 'brand', 'logo.jpg');
    assert.ok(fs.existsSync(markPath), 'public/brand/brand-mark.png must exist');
    assert.ok(fs.existsSync(logoPngPath), 'public/brand/logo.png must exist');
    assert.ok(fs.existsSync(logoJpgPath), 'public/brand/logo.jpg must exist');
    const stats = fs.statSync(logoJpgPath);
    assert.ok(stats.size > 5000, 'Brand logo file size should be substantial for high-DPI displays');
  });

  test('index.html links to /favicon.svg and defines brand theme-color', () => {
    const indexPath = path.resolve('index.html');
    const content = fs.readFileSync(indexPath, 'utf8');
    assert.ok(content.includes('href="/favicon.svg"'), 'index.html must reference /favicon.svg');
    assert.ok(content.includes('content="#FFFBF5"'), 'index.html must set theme-color to #FFFBF5');
  });

  test('Brand JSX component source files exist and have correct component signatures', () => {
    const markFile = path.resolve('src', 'components', 'brand', 'TypedDocMark.jsx');
    const logoFile = path.resolve('src', 'components', 'brand', 'TypedDocLogo.jsx');
    const animFile = path.resolve('src', 'components', 'brand', 'TypedDocOpeningAnimation.jsx');

    assert.ok(fs.existsSync(markFile), 'TypedDocMark.jsx must exist');
    assert.ok(fs.existsSync(logoFile), 'TypedDocLogo.jsx must exist');
    assert.ok(fs.existsSync(animFile), 'TypedDocOpeningAnimation.jsx must exist');

    const markSrc = fs.readFileSync(markFile, 'utf8');
    assert.ok(markSrc.includes('export function TypedDocMark'), 'TypedDocMark must export component');

    const logoSrc = fs.readFileSync(logoFile, 'utf8');
    assert.ok(logoSrc.includes('export function TypedDocLogo'), 'TypedDocLogo must export component');

    const animSrc = fs.readFileSync(animFile, 'utf8');
    assert.ok(animSrc.includes('export function TypedDocOpeningAnimation'), 'TypedDocOpeningAnimation must export component');
    assert.ok(animSrc.includes('useReducedMotion'), 'Animation must check reduced motion preferences');
  });
});
