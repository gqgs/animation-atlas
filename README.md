# Animation Atlas

An interactive collection of geometry, fractal, and Three.js animation experiments. Search or filter the gallery and launch one scene at a time. Favorites are stored in your browser; scene links use `#scene=stable-id`.

## Run locally

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. No build or package installation is required.

The catalog is `dist/experiments.json`. Original standalone experiments and their supporting code are under `dist/experiments`; illustrated covers are under `dist/covers`. Three.js dependencies and their licenses are bundled under `dist/vendor`. Some experiments optionally request external resources, including RCSB protein references.

## What to commit

Commit the entire `dist/` directory, including the catalog, experiments, covers, downloadable source archives, and vendored dependencies with their licenses. Despite its name, `dist/` is the maintained site and contains original source files and precomputed data. There is no build pipeline that recreates it from another source directory; do not ignore or delete it as generated output.

## Contributing

Read `AGENTS.md` before adding experiments. Preserve original renderers, stable scene IDs, and alternate versions.

## Hosting

Production: https://gqgs.github.io/animation-atlas/

The [production workflow](.github/workflows/deploy-pages.yml) publishes `dist/` from `main` to the root of `gh-pages`. The [PR preview workflow](.github/workflows/preview-pages.yml) publishes a copy of `dist/` for each same-repository pull request to `gh-pages/pr-preview/pr-<number>/`, posts the URL to the PR, updates it when commits are pushed, and deletes it when the PR closes. Both workflows preserve other deployments and never force-push.

No build or Node.js installation is required. Site assets use relative paths, so a preview works under its nested URL. Previews are **public**; do not commit secrets to preview branches.

### One-time migration from Actions-hosted Pages

The old site deploys directly with the official GitHub Pages artifact action. These previews require switching to **Deploy from a branch**. Follow this order to preserve the existing production site:

1. Create a **fine-grained GitHub personal access token** scoped only to `gqgs/animation-atlas`, with **Contents: Read and write**. Add it under **Settings → Secrets and variables → Actions** as repository secret `PAGES_DEPLOY_TOKEN`. The token's owner must have permission to publish Pages from this repository. Keep the token private and rotate it before expiration.
2. Merge the workflow change. The push to `main` publishes `dist/` to a new `gh-pages` branch while the existing Pages deployment remains live. In **Actions → Publish GitHub Pages**, confirm the run succeeded and the `gh-pages` branch now exists. If necessary, rerun the workflow manually with `main` selected.
3. Under **Settings → Pages → Build and deployment**, change **Source** to **Deploy from a branch**, select **gh-pages**, choose **/(root)**, and save.
4. Confirm https://gqgs.github.io/animation-atlas/ still works. Open or update a same-repository PR to test a preview such as `https://gqgs.github.io/animation-atlas/pr-preview/pr-42/`. After closing the test PR, confirm its preview is removed.

A normal `GITHUB_TOKEN` push does **not** trigger a Pages build when deploying from a branch, which is why both workflows explicitly require `PAGES_DEPLOY_TOKEN`. See [GitHub's documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#troubleshooting-publishing-from-a-branch). GitHub Pages does not provide access controls for preview URLs. The preview action does not support pull requests from forks.

If the secret is not yet configured, the preview workflow on this migration PR can fail its token check. This is expected until step 1 is complete. GitHub Actions and Pages settings cannot be changed by merging a workflow file alone.

### Routine publishing

Push or merge into `main` to update production. Production deployments preserve `pr-preview/`, and each preview deployment preserves production and the other previews. Both publishing actions use non-force pushes to reduce concurrent update conflicts.

Preview success means both the downstream **pages build and deployment** run and the live preview have been verified. A generated `preview-build.json` identifies the PR head served at the public URL. Verification also runs when copying files makes no changes, and success comments are posted only afterward. Cleanup verifies that the removed preview returns 404. The verification window allows for CDN propagation; it does not extend GitHub Pages' own deployment timeout.

If Pages publishing fails, follow the downstream run link in the verification error and use **Re-run failed jobs** there. Rerunning only **Preview GitHub Pages** may have nothing new to push and cannot restart a failed Pages build. An unchanged-copy rerun will now correctly fail until Pages and the live URL are healthy. If Pages repeatedly stalls at `syncing_files`, inspect GitHub Status or contact GitHub Support rather than disabling verification. Never publish an old `gh-pages` snapshot over newer production or preview changes.

## Publish the repository

Commit the repository's source and the entire maintained `dist/` tree, then push to `main`. The publishing workflow copies the site into `gh-pages`; the `gh-pages` branch is a deployment output and should not be edited manually.

The production URL is https://gqgs.github.io/animation-atlas/. All assets are relative to the current site path, so the same files run locally, at production, and under PR preview paths.
