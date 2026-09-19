#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""List / archive / delete Gitee releases (by tag prefix).

Usage:
  python gitee_releases_tool.py list   <owner/repo> [tag-prefix]
  python gitee_releases_tool.py archive <owner/repo> <out.md> [tag-prefix]
  python gitee_releases_tool.py delete  <owner/repo> <tag>
"""
import importlib.util, json, sys, urllib.error, urllib.request

ENV_SKILL = r"C:\Users\五五\.qclaw\skills\wushenghuang-env\scripts\gitee_api.py"
_spec = importlib.util.spec_from_file_location("gitee_api", ENV_SKILL)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
TOKEN = _mod.ACCESS_TOKEN
API = "https://gitee.com/api/v5"


def call(method, url, timeout=120):
    req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except Exception as e:
        return -1, repr(e)


def all_releases(repo):
    out = []
    for page in range(1, 6):
        st, txt = call("GET", f"{API}/repos/{repo}/releases?per_page=50&page={page}&access_token={TOKEN}")
        try:
            batch = json.loads(txt)
        except Exception:
            break
        if not batch:
            break
        out += batch
    return out


mode = sys.argv[1]
repo = sys.argv[2]

if mode == "list":
    prefix = sys.argv[3] if len(sys.argv) > 3 else ""
    for r in all_releases(repo):
        tag = r.get("tag_name", "")
        if not tag.startswith(prefix):
            continue
        assets = [a.get("name") for a in (r.get("assets") or [])]
        print(f'{r.get("id")}\t{tag}\t{r.get("created_at")}\t{",".join(assets)}')
elif mode == "archive":
    out, prefix = sys.argv[3], (sys.argv[4] if len(sys.argv) > 4 else "")
    with open(out, "w", encoding="utf-8") as f:
        for r in all_releases(repo):
            tag = r.get("tag_name", "")
            if not tag.startswith(prefix):
                continue
            f.write(f'\n\n---\n\n# {tag} — {r.get("name")}\n\n'
                    f'创建：{r.get("created_at")}\n\n{r.get("body") or "(无说明)"}\n')
    print("archived ->", out)
elif mode == "delete":
    tag = sys.argv[3]
    rid = None
    for r in all_releases(repo):
        if r.get("tag_name") == tag:
            rid = r.get("id")
            break
    if rid is None:
        print("not found:", tag)
    else:
        st, txt = call("DELETE", f"{API}/repos/{repo}/releases/{rid}?access_token={TOKEN}")
        print(f"delete {tag} (id={rid}) -> {st} {txt[:200]}")
