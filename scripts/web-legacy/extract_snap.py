import tarfile, sys, os
snap = sys.argv[1]
outdir = sys.argv[2]
wanted = set(sys.argv[3:])
tf = tarfile.open(snap, "r:xz")
got = 0
for m in tf:
    if m.name in wanted and m.isfile():
        dst = os.path.join(outdir, m.name.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "wb") as f:
            f.write(tf.extractfile(m).read())
        got += 1
print(f"extracted {got}/{len(wanted)}", file=sys.stderr)
