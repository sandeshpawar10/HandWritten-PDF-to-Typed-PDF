import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_AI_STATES,
  DEFAULT_WORKFLOW_STEPS,
  DEFAULT_FAQ_ITEMS,
  extractHeadingsFromMarkdown
} from '../src/lib/rareUiConstants.js';
import {
  addNotification,
  getStoredNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications
} from '../src/lib/notifications.js';

describe('Rare UI Component Suite & Architecture Tests', () => {
  beforeEach(() => {
    // Setup mock localStorage if running under Node.js test runner
    if (typeof globalThis.localStorage === 'undefined') {
      let store = {};
      globalThis.localStorage = {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { store = {}; }
      };
    }
    clearAllNotifications();
  });

  test('InlineAIStatus DEFAULT_AI_STATES contains all canonical pipeline states', () => {
    const requiredStates = ['queued', 'reading', 'ocr', 'transcribing', 'verifying', 'formatting', 'done', 'error'];
    for (const state of requiredStates) {
      assert.ok(DEFAULT_AI_STATES[state], `State "${state}" should be defined`);
      assert.ok(typeof DEFAULT_AI_STATES[state].label === 'string', `State "${state}" must have a label`);
      assert.ok(DEFAULT_AI_STATES[state].color, `State "${state}" must have a color`);
    }
  });

  test('StepPlayer DEFAULT_WORKFLOW_STEPS defines 6-stage authoritative pipeline', () => {
    assert.strictEqual(DEFAULT_WORKFLOW_STEPS.length, 6);
    const stepIds = DEFAULT_WORKFLOW_STEPS.map(s => s.id);
    assert.deepStrictEqual(stepIds, ['upload', 'render', 'ocr', 'verify', 'export', 'done']);
  });

  test('RailTOC extractHeadingsFromMarkdown parses markdown headings into slugified outline', () => {
    const sampleMarkdown = `
# Module 5: Discrete Mathematics
Some introductory text.

## 1. Graph Theory
Graphs consist of vertices and edges.

### 1.1 Directed Graphs
Edges have direction.

## 2. Trees and Spanning Trees
Definitions and properties.
    `;

    const headings = extractHeadingsFromMarkdown(sampleMarkdown);
    assert.strictEqual(headings.length, 4);

    assert.strictEqual(headings[0].label, 'Module 5: Discrete Mathematics');
    assert.strictEqual(headings[0].level, 1);
    assert.strictEqual(headings[0].depth, 0);
    assert.strictEqual(headings[0].id, 'module-5-discrete-mathematics');

    assert.strictEqual(headings[1].label, '1. Graph Theory');
    assert.strictEqual(headings[1].level, 2);
    assert.strictEqual(headings[1].depth, 1);
    assert.strictEqual(headings[1].id, '1-graph-theory');

    assert.strictEqual(headings[2].label, '1.1 Directed Graphs');
    assert.strictEqual(headings[2].level, 3);
    assert.strictEqual(headings[2].depth, 2);

    assert.strictEqual(headings[3].label, '2. Trees and Spanning Trees');
    assert.strictEqual(headings[3].level, 2);
  });

  test('FAQDrawer DEFAULT_FAQ_ITEMS contains essential academic help items', () => {
    assert.ok(DEFAULT_FAQ_ITEMS.length >= 4);
    const ids = DEFAULT_FAQ_ITEMS.map(item => item.id);
    assert.ok(ids.includes('accepted-files'));
    assert.ok(ids.includes('page-modes'));
    assert.ok(ids.includes('math-tables'));
    assert.ok(ids.includes('server-pdf'));
  });

  test('Durable Notification store adds, deduplicates, and manages unread state', () => {
    clearAllNotifications();
    assert.deepStrictEqual(getStoredNotifications(), []);

    // Add first notification
    addNotification({
      title: 'Batch OCR Finished',
      message: 'module5.pdf was transcribed.',
      type: 'success',
      docId: 'doc_123'
    });

    let items = getStoredNotifications();
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].title, 'Batch OCR Finished');
    assert.strictEqual(items[0].read, false);
    assert.strictEqual(items[0].docId, 'doc_123');

    // Deduplication test: rapid identical call should be ignored
    addNotification({
      title: 'Batch OCR Finished',
      message: 'module5.pdf was transcribed.',
      type: 'success',
      docId: 'doc_123'
    });

    items = getStoredNotifications();
    assert.strictEqual(items.length, 1, 'Duplicate notification within 15s should be deduplicated');

    // Mark as read
    markNotificationAsRead(items[0].id);
    items = getStoredNotifications();
    assert.strictEqual(items[0].read, true);

    // Clear all
    clearAllNotifications();
    assert.deepStrictEqual(getStoredNotifications(), []);
  });

  test('Notifications are strictly scoped by user UID and isolated between users', () => {
    clearAllNotifications('user_alice');
    clearAllNotifications('user_bob');
    assert.deepStrictEqual(getStoredNotifications('user_alice'), []);
    assert.deepStrictEqual(getStoredNotifications('user_bob'), []);

    addNotification({
      title: 'Alice Document Ready',
      message: 'Document A formatted.',
      userId: 'user_alice'
    });

    addNotification({
      title: 'Bob Document Ready',
      message: 'Document B formatted.',
      userId: 'user_bob'
    });

    const aliceNotifs = getStoredNotifications('user_alice');
    const bobNotifs = getStoredNotifications('user_bob');

    assert.strictEqual(aliceNotifs.length, 1);
    assert.strictEqual(aliceNotifs[0].title, 'Alice Document Ready');

    assert.strictEqual(bobNotifs.length, 1);
    assert.strictEqual(bobNotifs[0].title, 'Bob Document Ready');

    // Clearing Alice does not affect Bob
    clearAllNotifications('user_alice');
    assert.strictEqual(getStoredNotifications('user_alice').length, 0);
    assert.strictEqual(getStoredNotifications('user_bob').length, 1);

    clearAllNotifications('user_bob');
  });
});

