"""Isolated snapshot/restore check; never touches the business database."""
from contextlib import closing
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


class BackupTest(unittest.TestCase):
    def test_wal_snapshot_restore_and_no_overwrite(self):
        script = Path(__file__).with_name('backup.py')
        with tempfile.TemporaryDirectory(prefix='qingyu-backup-') as directory:
            source, output = Path(directory) / 'source.sqlite', Path(directory) / 'snapshot.sqlite'
            with closing(sqlite3.connect(source)) as connection:
                connection.execute('PRAGMA journal_mode=WAL')
                connection.execute('CREATE TABLE sample(value TEXT, data BLOB)')
                connection.execute('INSERT INTO sample VALUES(?,?)', ('fictional backup fixture', b'private-photo-fixture'))
                connection.commit()
                subprocess.run([sys.executable, str(script), '--database', str(source), '--output', str(output)], check=True, capture_output=True)
                with closing(sqlite3.connect(output)) as restored:
                    self.assertEqual(restored.execute('SELECT value,data FROM sample').fetchone(), ('fictional backup fixture', b'private-photo-fixture'))
                    self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                saved = output.read_bytes()
                repeat = subprocess.run([sys.executable, str(script), '--database', str(source), '--output', str(output)], capture_output=True)
                self.assertNotEqual(repeat.returncode, 0)
                self.assertEqual(output.read_bytes(), saved)
                self.assertEqual(connection.execute('SELECT COUNT(*) FROM sample').fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main()
