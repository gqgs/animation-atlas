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

test('no-change reruns still verify Pages and the live preview before commenting', () => {
  const liveVerification = steps.find(step => /name: Verify published preview/.test(step));
  const successComment = steps.find(step => /name: Report verified preview/.test(step));
  assert.ok(liveVerification);
  assert.doesNotMatch(liveVerification, /^\s+if:/m, 'verification must run even if the copy was skipped');
  assert.match(liveVerification, /node \.github\/scripts\/verify-preview\.mjs/);
  assert.match(workflow, /actions: read/);
  assert.match(preview, /wait-for-pages-deployment: 'false'/);
  assert.match(preview, /comment: 'false'/, 'the upstream action must not post unverified success');
  assert.ok(steps.indexOf(liveVerification) < steps.indexOf(successComment));
  assert.match(successComment, /steps\.verify\.outputs\.pages_run_url/);
  assert.match(workflow, /name: Report preview failure\n\s+if: failure\(\)/);
});

test('preview identity is stable across retries and does not enter closed-event cleanup', () => {
  const marker = steps.find(step => /name: Identify preview contents/.test(step));
  assert.match(marker, /if: github\.event\.action != 'closed'/);
  assert.match(marker, /PR_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(marker, /preview-build\.json/);
  assert.doesNotMatch(marker, /run_id|run_attempt|Date\.now/);
});
