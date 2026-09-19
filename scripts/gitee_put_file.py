#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Update a file in a Gitee repo via contents API.

Usage: python gitee_put_file.py <owner/repo> <path> <local-file> <message> [branch]
"""
import base64, importlib.util, json, sys, urllib.error, urllib.request
from pathlib import Path

ENV_SKILL = r"C:\Users\五五\.qclaw\skills\wushenghuang-env\scripts\gitee_api.py"
_spec = importlib.util.spec_from_file_location("gitee_api", ENV_SKILL)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
TOKEN = _mod.ACCESS_TOKEN
API = "https://gitee.com/api/v5"


def call(method, url, headers=None, data=None, timeout=120):
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


repo, path, local, message = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
branch = sys.argv[5] if len(sys.argv) > 5 else "master"

st, txt = call("GET", f"{API}/repos/{repo}/contents/{path}?ref={branch}&access_token={TOKEN}")
try:
    cur = json.loads(txt)
except Exception:
    cur = {}
sha = cur.get("sha") if isinstance(cur, dict) else None
print("current sha:", sha)

content = base64.b64encode(Path(local).read_bytes()).decode()
payload = json.dumps({
    "access_token": TOKEN,
    "content": content,
    "message": message,
    "branch": branch,
    "sha": sha,
}).encode()
st, txt = call("PUT", f"{API}/repos/{repo}/contents/{path}",
               {"Content-Type": "application/json"}, payload)
print("put:", st)
if st not in (200, 201):
    print(txt[:600])
