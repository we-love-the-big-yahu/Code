"""Create a Mac application ZIP without losing framework symlinks or execute bits."""
from pathlib import Path
import os, stat, sys, zipfile
source, destination = Path(sys.argv[1]), Path(sys.argv[2])
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for folder, directories, files in os.walk(source, followlinks=False):
        for name in directories + files:
            item = Path(folder) / name
            relative = str(Path(source.name) / item.relative_to(source))
            info = zipfile.ZipInfo(relative + ('/' if item.is_dir() and not item.is_symlink() else ''))
            info.create_system = 3
            info.external_attr = item.lstat().st_mode << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            if item.is_symlink():
                archive.writestr(info, os.readlink(item))
            elif item.is_file():
                with item.open('rb') as handle, archive.open(info, 'w') as out:
                    while block := handle.read(1024 * 1024): out.write(block)
            else:
                archive.writestr(info, b'')
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
print(f'ZIP verified: {destination.name}, {destination.stat().st_size:,} bytes')
