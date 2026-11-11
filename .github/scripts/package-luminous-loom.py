"""Build a reproducible source bundle with the original shared import paths."""
import argparse
import io
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
SCENE = 'luminous-loom'

def bundle():
    files = {p.relative_to(DIST).as_posix(): p.read_bytes()
             for p in (DIST / 'experiments' / SCENE).rglob('*') if p.is_file()}
    for name in ['rotation-sequence.mjs', 'rotation-sequence.test.mjs',
                 'frame-export.mjs', 'frame-export.test.mjs', 'README.md',
                 'parameter-tracks.mjs', 'parameter-tracks.test.mjs',
                 'parameter-controls.mjs', 'parameter-tracks.md']:
        files['shared/' + name] = (DIST / 'shared' / name).read_bytes()
    files['index.html'] = (f'<!doctype html><meta charset="utf-8">'
                          f'<meta http-equiv="refresh" content="0;url=experiments/{SCENE}/">'
                          f'<a href="experiments/{SCENE}/">Open Luminous Loom</a>\n').encode()
    files['README.md'] = b'# Luminous Loom source\n\nServe this folder with `python3 -m http.server 8080` and open http://localhost:8080. Keep experiments/ and shared/ together. See experiments/luminous-loom/README.md.\n'
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, content in sorted(files.items()):
            entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_STORED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, content)
    return output.getvalue()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = DIST / 'downloads' / f'{SCENE}-source.zip'
    data = bundle()
    if args.check:
        if path.read_bytes() != data:
            raise SystemExit(f'Stale source bundle: {path.relative_to(ROOT)}')
    else:
        path.write_bytes(data)
    print(f'{"Verified" if args.check else "Built"} {path.relative_to(ROOT)} ({len(data)} bytes)')
