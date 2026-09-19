#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create a Gitee release and attach an APK, for an arbitrary repo.

Usage: python gitee_release_any.py <owner/repo> <tag> <apk> [notes.md]
"""
import importlib.util, json, sys, urllib.error, urllib.request, uuid
from pathlib import Path

ENV_SKILL = r"C:\Users\五五\.qclaw\skills\wushenghuang-env\scripts\gitee_api.py"
_spec = importlib.util.spec_from_file_location("gitee_api", ENV_SKILL)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
TOKEN = _mod.ACCESS_TOKEN
API = "https://gitee.com/api/v5"


def call(method, url, headers=None, data=None, timeout=1800):
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except Exception as e:
        return -1, repr(e)


def main():
    repo, tag, apk = sys.argv[1], sys.argv[2], sys.argv[3]
    notes = sys.argv[4] if len(sys.argv) > 4 else None
    body = Path(notes).read_text(encoding="utf-8") if notes else tag
    apk = Path(apk)
    fname = apk.name

    st, txt = call("GET", f"{API}/repos/{repo}/releases/tags/{tag}?access_token={TOKEN}")
    try:
        rel = json.loads(txt)
    except Exception:
        rel = {}
    if not isinstance(rel, dict):
        rel = {}
    if not rel.get("id"):
        payload = json.dumps({"access_token": TOKEN, "tag_name": tag,
                              "name": f"DSH-Mobile {tag.replace('apk-', 'v')}",
                              "body": body, "target_commitish": "master"}).encode()
        st, txt = call("POST", f"{API}/repos/{repo}/releases",
                       {"Content-Type": "application/json"}, payload)
        try:
            rel = json.loads(txt)
        except Exception:
            rel = {}
        if not isinstance(rel, dict):
            rel = {}
        print("create_release:", st, rel.get("id"))
        if st not in (200, 201):
            print(txt[:500])
            return
    rid = rel["id"]
    have = {a.get("name") for a in (rel.get("assets") or [])}
    if fname in have:
        print("upload: skipped (already attached)")
        print(f"download: https://gitee.com/{repo}/releases/download/{tag}/{fname}")
        return

    blob = apk.read_bytes()
    boundary = "----dshmobile" + uuid.uuid4().hex
    head = (f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n").encode()
    tail = f"\r\n--{boundary}--\r\n".encode()
    st, txt = call("POST", f"{API}/repos/{repo}/releases/{rid}/attach_files?access_token={TOKEN}",
                   {"Content-Type": f"multipart/form-data; boundary={boundary}",
                    "Content-Length": str(len(head) + len(blob) + len(tail))},
                   head + blob + tail)
    print("upload:", st, "ok" if st in (200, 201) else txt[:400])
    print(f"download: https://gitee.com/{repo}/releases/download/{tag}/{fname}")


if __name__ == "__main__":
    main()
