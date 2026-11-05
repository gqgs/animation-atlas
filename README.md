# EigenDynamics Animation Atlas

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

Serve `dist/` as a static website. For GitHub Pages, deploy that directory as the Pages artifact.

## Publish the repository

Commit `README.md`, `AGENTS.md`, and all of `dist/`, then push to the repository. Publishing the repository and hosting the site are separate steps. This checkout does not include a GitHub Pages deployment workflow; add one that uploads `dist/` as the Pages artifact if Pages hosting is wanted.

For `gqgs/animation-atlas`, the default Pages address is https://gqgs.github.io/animation-atlas/.
The app uses relative asset paths so it works under that repository subpath.
No Node.js installation or build step is required.
