import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

// The copy action can report "skipped" when a previous Pages publish failed.
// Verify the actual Pages run and its public output, including on no-op retries.
export async function verifyPreview({ repository, token, previewUrl, pullRequest, headSha, sourceSha, remove = false }, {
  fetchImpl = fetch, now = Date.now, pause = sleep, log = console.log,
  timeoutMs = 20 * 60_000, intervalMs = 15_000,
} = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token || !/^\d+$/.test(String(pullRequest)) || !/^[a-f0-9]{40}$/.test(headSha) || !/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new Error('Missing or invalid repository, token, pull-request number, head SHA, or source SHA.');
  }
  const url = new URL(previewUrl);
  if (url.protocol !== 'https:' || url.username || url.password || !url.pathname.endsWith('/')) {
    throw new Error('Expected an HTTPS preview directory URL.');
  }
  const deadline = now() + timeoutMs;
  let lastState = 'Waiting for GitHub Pages to create a deployment.';
  let lastRunUrl = `https://github.com/${repository}/actions`;
  let previousState;

  async function request(input, options) {
    try { return await fetchImpl(input, options); }
    catch (error) {
      if (error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name)) {
        const transient = new Error(`Temporary network error: ${error.message}`);
        transient.retryable = true;
        throw transient;
      }
      throw error;
    }
  }

  async function api(path) {
    const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const error = new Error(`GitHub API ${response.status} reading ${path}.`);
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }
    return response.json();
  }

  async function live(path) {
    // Never send the GitHub token to the public site. A unique query and no-cache
    // request encourage revalidation, but we still verify content, not cache age.
    const target = new URL(path, url);
    target.searchParams.set('verify', String(now()));
    return request(target, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30_000) });
  }

  while (now() < deadline) {
    try {
      // Follow the latest branch snapshot rather than republishing an old one.
      // Concurrent production/other-preview pushes preserve this preview and can
      // supersede the original Pages run without changing its expected marker.
      const sha = (await api('git/ref/heads/gh-pages')).object.sha;
      const { workflow_runs: runs } = await api(`actions/runs?branch=gh-pages&head_sha=${sha}&per_page=100`);
      const run = runs.filter(run => run.path === 'dynamic/pages/pages-build-deployment' && run.head_sha === sha)
        .sort((a, b) => b.id - a.id)[0];
      if (run) {
        lastRunUrl = run.html_url;
        lastState = `Pages run ${run.id}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}.`;
        if (run.status === 'completed') {
          // Do not fail or report success from a snapshot replaced during polling.
          if ((await api('git/ref/heads/gh-pages')).object.sha !== sha) continue;
          if (run.conclusion !== 'success') {
            throw new Error(`Pages publishing ${run.conclusion}. Re-run failed jobs in the downstream Pages run, not the preview-copy workflow: ${lastRunUrl}`);
          }
          const [index, marker] = await Promise.all([live('index.html'), live('preview-build.json')]);
          let verified = remove && index.status === 404 && marker.status === 404;
          if (!remove && index.status === 200 && marker.status === 200) {
            let metadata;
            try { metadata = await marker.json(); } catch { /* Cached error page or invalid marker: keep waiting. */ }
            verified = metadata?.repository === repository && metadata?.pullRequest === Number(pullRequest) && metadata?.headSha === headSha && metadata?.sourceSha === sourceSha;
          }
          if (verified) {
            if ((await api('git/ref/heads/gh-pages')).object.sha !== sha) continue;
            log(`Verified preview ${remove ? 'removal' : headSha} at ${previewUrl} via ${lastRunUrl}`);
            return { pagesRunUrl: lastRunUrl, pagesSha: sha };
          }
          lastState = `Pages run succeeded, but public preview ${remove ? 'removal' : `for ${headSha}`} is not verified (index ${index.status}, marker ${marker.status}).`;
        }
      } else {
        lastState = `Waiting for a Pages run for the current gh-pages commit ${sha}.`;
      }
    } catch (error) {
      if (!error.retryable) throw error;
      lastState = `${error.message} Retrying within the verification window.`;
    }
    if (lastState !== previousState) log(lastState);
    previousState = lastState;
    await pause(intervalMs);
  }
  throw new Error(`Timed out verifying public preview. ${lastState} Inspect ${lastRunUrl}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyPreview({
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
      previewUrl: process.env.PREVIEW_URL,
      pullRequest: process.env.PR_NUMBER,
      headSha: process.env.PR_HEAD_SHA,
      sourceSha: process.env.GITHUB_SHA,
      remove: process.env.PR_ACTION === 'closed',
    });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `pages_run_url=${result.pagesRunUrl}\npages_sha=${result.pagesSha}\n`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
