#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gitee APK release helper for dsh-mobile-releases.

Token is NOT stored here — imported from the credential skill:
  C:\\Users\\五五\\.qclaw\\skills\\wushenghuang-env\\scripts\\gitee_api.py

Usage:
  python gitee_release_apk.py <tag> <apk-path> [title] [--notes-file notes.md]

Example:
  python gitee_release_apk.py apk-v0.12.8 D:\\Desktop\\DSH-Mobile-0.12.8-debug.apk

Verified working (2026-08-22): attachment upload uses multipart field name
`file` -> HTTP 201. Field names `files` / `files[]` fail with 400 file is
missing. Release creation: POST /repos/{owner}/{repo}/releases.
"""
import importlib.util
import json
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ENV_SKILL = r"C:\Users\五五\.qclaw\skills\wushenghuang-env\scripts\gitee_api.py"
OWNER = "wushenghuang"
REPO = "dsh-mobile-releases"
API = "https://gitee.com/api/v5"

_spec = importlib.util.spec_from_file_location("gitee_api", ENV_SKILL)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
TOKEN = _mod.ACCESS_TOKEN


def call(method, url, headers=None, data=None, timeout=300):
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return
    tag, apk_path = args[0], args[1]
    title = f"DSH-Mobile {tag.replace('apk-', 'v')}"
    notes_file = None
    argv = sys.argv[1:]
    if "--notes-file" in argv:
        notes_file = argv[argv.index("--notes-file") + 1]
    body = Path(notes_file).read_text(encoding="utf-8") if notes_file else title
    fname = Path(apk_path).name

    status, rel = call("GET", f"{API}/repos/{OWNER}/{REPO}/releases/tags/{tag}?access_token={TOKEN}")
    if not isinstance(rel, dict) or not rel.get("id"):
        payload = json.dumps({
            "access_token": TOKEN, "tag_name": tag, "name": title,
            "body": body, "target_commitish": "master",
        }).encode("utf-8")
        status, rel = call("POST", f"{API}/repos/{OWNER}/{REPO}/releases",
                           {"Content-Type": "application/json"}, payload)
        print(json.dumps({"step": "create_release", "status": status,
                          "id": rel.get("id")}, ensure_ascii=False))
        if status not in (200, 201) or not isinstance(rel, dict) or not rel.get("id"):
            return
    rid = rel["id"]
    have = {a.get("name") for a in (rel.get("assets") or [])}
    if fname in have:
        print(json.dumps({"step": "upload", "status": "skipped", "reason": "already attached"},
                         ensure_ascii=False))
        print(f"download: https://gitee.com/{OWNER}/{REPO}/releases/download/{tag}/{fname}")
        return

    boundary = "----dshmobile" + uuid.uuid4().hex
    blob = Path(apk_path).read_bytes()
    head = (f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n").encode("utf-8")
    tail = f"\r\n--{boundary}--\r\n".encode("utf-8")
    st, resp = call("POST",
                    f"{API}/repos/{OWNER}/{REPO}/releases/{rid}/attach_files?access_token={TOKEN}",
                    {"Content-Type": f"multipart/form-data; boundary={boundary}",
                     "Content-Length": str(len(head) + len(blob) + len(tail))},
                    head + blob + tail, timeout=1800)
    ok = st in (200, 201)
    print(json.dumps({"step": "upload", "status": st, "ok": ok,
                      "asset_id": resp.get("id") if isinstance(resp, dict) else None},
                     ensure_ascii=False))
    print(f"download: https://gitee.com/{OWNER}/{REPO}/releases/download/{tag}/{fname}")


if __name__ == "__main__":
    main()
