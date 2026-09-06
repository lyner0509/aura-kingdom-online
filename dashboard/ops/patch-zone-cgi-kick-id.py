#!/usr/bin/env python3
"""Patch the verified ZoneServer build to expose ID-based kick through CGI."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import struct
import sys
from datetime import datetime


EXPECTED_SOURCE_SHA256 = "dbde544ec3b0fcacf04e45015278d59757bec2e029e96ef6cc5b599e911f05cb"
PRIVILEGE_OFFSET = 0x53BF20
CGI_ENTRY_OFFSET = 0x106E778

# Previous patch: privilege 7 plus the name-based RootCommands kick handler.
EXPECTED_PRIVILEGE = bytes.fromhex("b0 07 c3")
EXPECTED_CGI_ENTRY = struct.pack(
    "<5Q", 0x1118618, 0, 0x1112F21, 0x11D8F49, 0x8FF960
)

# Production fix: restore CGI privilege 0 and use the internal ID-based handler.
PATCHED_PRIVILEGE = bytes.fromhex("31 c0 c3")
PATCHED_CGI_ENTRY = struct.pack(
    "<5Q", 0x1110610, 0, 0x1110530, 0x11D8F49, 0x8F4AB0
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_at(path: Path, offset: int, size: int) -> bytes:
    with path.open("rb") as source:
        source.seek(offset)
        return source.read(size)


def main() -> int:
    if len(sys.argv) != 2:
        print(f"Usage: {Path(sys.argv[0]).name} /absolute/path/to/ZoneServer.bin", file=sys.stderr)
        return 2

    target = Path(sys.argv[1]).resolve(strict=True)
    current_privilege = read_at(target, PRIVILEGE_OFFSET, len(PATCHED_PRIVILEGE))
    current_entry = read_at(target, CGI_ENTRY_OFFSET, len(PATCHED_CGI_ENTRY))
    if current_privilege == PATCHED_PRIVILEGE and current_entry == PATCHED_CGI_ENTRY:
        print(f"Already patched: {sha256(target)}")
        return 0

    current_hash = sha256(target)
    if current_hash != EXPECTED_SOURCE_SHA256:
        raise SystemExit(f"Refusing unverified binary SHA-256: {current_hash}")
    if current_privilege != EXPECTED_PRIVILEGE or current_entry != EXPECTED_CGI_ENTRY:
        raise SystemExit("Refusing binary whose expected patch locations do not match")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = target.with_name(f"{target.name}.pre-kick-id-cgi-{stamp}")
    temporary = target.with_name(f".{target.name}.kick-id.tmp")
    if temporary.exists():
        raise SystemExit(f"Temporary path already exists: {temporary}")

    shutil.copy2(target, backup)
    shutil.copy2(target, temporary)
    try:
        with temporary.open("r+b") as output:
            output.seek(PRIVILEGE_OFFSET)
            output.write(PATCHED_PRIVILEGE)
            output.seek(CGI_ENTRY_OFFSET)
            output.write(PATCHED_CGI_ENTRY)
            output.flush()
            os.fsync(output.fileno())
        new_hash = sha256(temporary)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()

    print(f"Backup: {backup}")
    print(f"Patched SHA-256: {new_hash}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
