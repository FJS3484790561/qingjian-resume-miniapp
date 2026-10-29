"""Package only the verified server bundle and explicit deployment inputs.

No .env, SQLite files, local photos, frontend drafts or node_modules enter the archive.
Run npm run server:build first; output stays under ignored dist/.
"""
from pathlib import Path
import hashlib
import tarfile

ROOT = Path(__file__).resolve().parent.parent
FILES = {
    'deploy/runtime/package.json': 'package.json',
    'deploy/runtime/package-lock.json': 'package-lock.json',
    **{name: name for name in [
        'dist/server/index.cjs', 'deploy/qingyu-api.service',
        'deploy/api.env.example', 'deploy/backup.py', 'deploy/preflight.sh',
        'deploy/install-release.sh',
    ]},
}


def main():
    for name in FILES:
        if not (ROOT / name).is_file():
            raise SystemExit(f'Missing required input: {name}')
    output = ROOT / 'dist/qingyu-server.tgz'
    with tarfile.open(output, 'w:gz') as archive:
        for name, destination in FILES.items():
            archive.add(ROOT / name, arcname=destination, recursive=False)
    with tarfile.open(output) as archive:
        assert archive.getnames() == list(FILES.values())
        assert all(item.isfile() for item in archive.getmembers())
    print('Server archive: dist/qingyu-server.tgz')
    print('SHA256:', hashlib.sha256(output.read_bytes()).hexdigest())
    print('Explicit files:', len(FILES), '; credentials/data/dependencies excluded')


if __name__ == '__main__':
    main()
