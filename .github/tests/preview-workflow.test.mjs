import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../workflows/preview-pages.yml', import.meta.url), 'utf8');
// These focused checks protect the event guards that caused merged previews
// to survive cleanup. They intentionally do not implement a general YAML parser.
const steps = workflow.split(/^      - /m).slice(1);
const checkout = steps.find(step => /uses: actions\/checkout@/.test(step));
const verification = steps.find(step => /name: Verify static site/.test(step));
const preview = steps.find(step => /uses: rossjrw\/pr-preview-action@/.test(step));

test('preview lifecycle includes closed pull requests', () => {
  assert.match(workflow, /types: \[[^\]\n]*\bclosed\b[^\]\n]*\]/);
});

test('checkout also runs for closed events without persisting credentials', () => {
  assert.ok(checkout, 'preview lifecycle requires a repository checkout');
  assert.doesNotMatch(checkout, /^\s+if:/m, 'cleanup needs checkout on closed events');
  assert.match(checkout, /persist-credentials: false/);
});

test('closed events skip static-site verification, not preview removal', () => {
  assert.ok(verification);
  assert.match(verification, /if: github\.event\.action != 'closed'/);
  assert.ok(preview);
  assert.doesNotMatch(preview, /^\s+if:/m);
  assert.match(preview, /preview-branch: gh-pages/);
  assert.match(preview, /umbrella-dir: pr-preview/);
});

test('only same-repository pull requests may publish previews', () => {
  assert.match(workflow, /if: github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.doesNotMatch(workflow, /^  pull_request_target:/m);
});
