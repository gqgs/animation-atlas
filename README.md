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

The site is hosted at https://gqgs.github.io/animation-atlas/.

The [Deploy GitHub Pages workflow](.github/workflows/deploy-pages.yml) publishes `dist/` after every push to `main`, including merged pull requests. It can also be run manually from the Actions tab with `main` selected. Only `main` can deploy, and deployments run one at a time.

The workflow uses GitHub's built-in token; no deployment secrets or build step are required. In repository Settings → Pages → Build and deployment, the source must be **GitHub Actions**.

## Publish the repository

Commit `README.md`, `AGENTS.md`, `.github/workflows/`, and all of `dist/`, then push to the repository. Publishing the repository and hosting the site are separate steps; the deployment workflow handles hosting updates when changes reach `main`.

For `gqgs/animation-atlas`, the default Pages address is https://gqgs.github.io/animation-atlas/.
The app uses relative asset paths so it works under that repository subpath.
No Node.js installation or build step is required.
