"""Build portable, reproducible source bundles, preserving shared import paths."""
import argparse
import io
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'


def bundle(scene):
    files = {p.relative_to(DIST).as_posix(): p.read_bytes()
             for p in (DIST / 'experiments' / scene).iterdir() if p.is_file()}
    for name in ['rotation-sequence.mjs', 'rotation-sequence.test.mjs', 'README.md']:
        files['shared/' + name] = (DIST / 'shared' / name).read_bytes()
    if scene == 'chromatic-unwinding':
        for name in ['frame-export.mjs', 'frame-export.test.mjs']:
            files['shared/' + name] = (DIST / 'shared' / name).read_bytes()
    files['index.html'] = (f'<!doctype html><meta charset="utf-8">'
                          f'<meta http-equiv="refresh" content="0;url=experiments/{scene}/">'
                          f'<a href="experiments/{scene}/">Open {scene}</a>\n').encode()
    files['README.md'] = (f'# {scene} source\n\nRun `python3 -m http.server 8080` here and open '
                          f'http://localhost:8080/experiments/{scene}/. Keep the experiments/ and '
                          f'shared/ folders together. See experiments/{scene}/README.md.\n').encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in sorted(files.items()):
            entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, content)
    return output.getvalue()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for scene in ['chromatic-unwinding', 'chromatic-chamber']:
        path = DIST / 'downloads' / f'{scene}-source.zip'
        data = bundle(scene)
        if args.check:
            if path.read_bytes() != data:
                raise SystemExit(f'Stale source bundle: {path.relative_to(ROOT)}')
        else:
            path.write_bytes(data)
        print(f'{"Verified" if args.check else "Built"} {path.relative_to(ROOT)} ({len(data)} bytes)')
