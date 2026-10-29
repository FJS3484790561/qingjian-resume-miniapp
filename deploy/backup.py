"""Create a consistent, private SQLite snapshot (including committed WAL data). Never overwrite a backup."""
import argparse
import os
from pathlib import Path
import sqlite3
from contextlib import closing

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
source = Path(args.database).resolve(strict=True)
output = Path(args.output).resolve()
if not source.is_file() or source == output:
    parser.error('数据库必须是现有文件，备份必须使用独立路径')
output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
descriptor = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
os.close(descriptor)
try:
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as origin, closing(sqlite3.connect(output)) as copy:
        origin.backup(copy, pages=256)
        if copy.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('备份完整性检查未通过')
    print('备份创建并通过完整性检查；包含私有数据，请妥善保存。')
except BaseException:
    output.unlink(missing_ok=True)
    raise
