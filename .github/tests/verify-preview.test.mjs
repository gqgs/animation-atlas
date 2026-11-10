import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPreview } from '../scripts/verify-preview.mjs';

const head = 'a'.repeat(40), pagesSha = 'b'.repeat(40), newerSha = 'c'.repeat(40);
const config = { repository: 'owner/site', token: 'test-token', previewUrl: 'https://owner.github.io/site/pr-preview/pr-12/', pullRequest: 12, headSha: head, sourceSha: 'e'.repeat(40) };
const metadata = { repository: config.repository, pullRequest: 12, headSha: head, sourceSha: config.sourceSha };
const success = { id: 123, path: 'dynamic/pages/pages-build-deployment', head_sha: pagesSha, status: 'completed', conclusion: 'success', html_url: 'https://github.com/owner/site/actions/runs/123' };

function fixture(states) {
  let tick = 0, time = 0, observedSha = pagesSha;
  const calls = [], logs = [];
  return {
    calls, logs,
    options: {
      now: () => time, timeoutMs: 60, intervalMs: 10,
      pause: async ms => { time += ms; tick++; }, log: value => logs.push(value),
      fetchImpl: async (input, options) => {
        const url = new URL(input);
        calls.push({ url, options });
        const state = states[Math.min(tick, states.length - 1)];
        if (url.hostname === 'api.github.com') {
          assert.equal(options.headers.Authorization, 'Bearer test-token');
          if (state.apiStatus) return new Response('', { status: state.apiStatus });
          if (url.pathname.endsWith('/git/ref/heads/gh-pages')) {
            observedSha = state.refSequence?.length ? state.refSequence.shift() : state.sha || pagesSha;
            return Response.json({ object: { sha: observedSha } });
          }
          assert.ok(url.pathname.endsWith('/actions/runs'));
          assert.equal(url.searchParams.get('head_sha'), observedSha);
          return Response.json({ workflow_runs: state.runs || [success] });
        }
        if (state.liveError) throw new TypeError('fetch failed');
        assert.equal(url.origin, 'https://owner.github.io');
        assert.equal(options.headers.Authorization, undefined, 'never expose the API token to the preview');
        if (url.pathname.endsWith('/index.html')) return new Response('<html>Preview</html>', { status: state.indexStatus || 200 });
        assert.ok(url.pathname.endsWith('/preview-build.json'));
        return Response.json(state.marker ?? metadata, { status: state.markerStatus || 200 });
      },
    },
  };
}

test('successful deployment requires matching live PR identity and a working index', async () => {
  const f = fixture([{}]);
  const result = await verifyPreview(config, f.options);
  assert.equal(result.pagesSha, pagesSha);
  assert.equal(result.pagesRunUrl, success.html_url);
  assert.equal(f.calls.filter(call => call.url.hostname === 'owner.github.io').length, 2);
});

test('no-change rerun cannot hide a failed downstream Pages deployment', async () => {
  const f = fixture([{ runs: [{ ...success, conclusion: 'failure' }] }]);
  await assert.rejects(verifyPreview(config, f.options), /Pages publishing failure.*downstream Pages run.*actions\/runs\/123/);
  assert.equal(f.calls.filter(call => call.url.hostname === 'owner.github.io').length, 0);
});

test('cancelled deployments do not count as successful publication', async () => {
  const f = fixture([{ runs: [{ ...success, conclusion: 'cancelled' }] }]);
  await assert.rejects(verifyPreview(config, f.options), /Pages publishing cancelled/);
});

test('waits for pending Pages run and CDN propagation rather than accepting 404', async () => {
  const f = fixture([
    { runs: [] },
    { runs: [{ ...success, status: 'in_progress', conclusion: null }] },
    { indexStatus: 404, markerStatus: 404 },
    {},
  ]);
  await verifyPreview(config, f.options);
  assert.ok(f.logs.some(line => line.includes('not verified')));
});

test('successful Pages build with permanently missing preview fails', async () => {
  const f = fixture([{ indexStatus: 404, markerStatus: 404 }]);
  await assert.rejects(verifyPreview(config, f.options), /Timed out.*index 404, marker 404/);
});

test('stale live preview head never passes', async () => {
  const f = fixture([{ marker: { ...metadata, headSha: 'd'.repeat(40) } }]);
  await assert.rejects(verifyPreview(config, f.options), /Timed out verifying public preview/);
});

test('wrong repository or PR identity never passes', async () => {
  for (const marker of [{ ...metadata, repository: 'other/site' }, { ...metadata, pullRequest: 13 }]) {
    const f = fixture([{ marker }]);
    await assert.rejects(verifyPreview(config, f.options), /Timed out/);
  }
});

test('follows newer preserved snapshots without rewriting gh-pages', async () => {
  const newerRun = { ...success, id: 124, head_sha: newerSha, html_url: 'https://github.com/owner/site/actions/runs/124' };
  const f = fixture([{ runs: [] }, { sha: newerSha, runs: [newerRun] }]);
  const result = await verifyPreview(config, f.options);
  assert.equal(result.pagesSha, newerSha);
  assert.equal(result.pagesRunUrl, newerRun.html_url);
  assert.ok(f.calls.every(call => !call.options.method || call.options.method === 'GET'));
});

test('ignores other workflows and old deployment commits', async () => {
  const f = fixture([{ runs: [{ ...success, path: '.github/workflows/test.yml' }, { ...success, head_sha: newerSha }] }]);
  await assert.rejects(verifyPreview(config, f.options), /Timed out.*Waiting for a Pages run/);
});

test('preview cleanup verifies both index and marker are gone', async () => {
  const f = fixture([{ indexStatus: 404, markerStatus: 200 }, { indexStatus: 404, markerStatus: 404 }]);
  await verifyPreview({ ...config, remove: true }, f.options);
  assert.ok(f.logs.some(line => line.includes('removal is not verified')));
});

test('API permission failures are explicit and never produce success', async () => {
  const f = fixture([{ apiStatus: 403 }]);
  await assert.rejects(verifyPreview(config, f.options), /GitHub API 403/);
});

test('invalid inputs fail before making network requests', async () => {
  const f = fixture([{}]);
  await assert.rejects(verifyPreview({ ...config, headSha: '' }, f.options), /Missing or invalid/);
  await assert.rejects(verifyPreview({ ...config, previewUrl: 'http://owner.github.io/' }, f.options), /HTTPS/);
  assert.equal(f.calls.length, 0);
});

test('same PR head from a different merge snapshot is not accepted', async () => {
  const f = fixture([{ marker: { ...metadata, sourceSha: 'f'.repeat(40) } }]);
  await assert.rejects(verifyPreview(config, f.options), /Timed out/);
});


test('transient API failures and live network errors retry within the deadline', async () => {
  const f = fixture([{ apiStatus: 503 }, { apiStatus: 429 }, { liveError: true }, {}]);
  await verifyPreview(config, f.options);
  assert.ok(f.logs.some(line => line.includes('Retrying within')));
});


test('a failed snapshot replaced during polling does not fail the newer deployment', async () => {
  const newerRun = { ...success, id: 124, head_sha: newerSha, html_url: 'https://github.com/owner/site/actions/runs/124' };
  const f = fixture([{ sha: newerSha, refSequence: [pagesSha, newerSha], runs: [{ ...success, conclusion: 'failure' }, newerRun] }]);
  const result = await verifyPreview(config, f.options);
  assert.equal(result.pagesSha, newerSha);
});

test('branch movement during live checks forces verification of the newer snapshot', async () => {
  const newerRun = { ...success, id: 124, head_sha: newerSha, html_url: 'https://github.com/owner/site/actions/runs/124' };
  const f = fixture([{ sha: newerSha, refSequence: [pagesSha, pagesSha, newerSha], runs: [success, newerRun] }]);
  const result = await verifyPreview(config, f.options);
  assert.equal(result.pagesSha, newerSha);
  assert.equal(result.pagesRunUrl, newerRun.html_url);
  assert.equal(f.calls.filter(call => call.url.hostname === 'owner.github.io').length, 4);
});
