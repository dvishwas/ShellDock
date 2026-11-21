# Issue #2 — Update ReadMe file

- step 1: read existing README.md, preserved macOS signing / unsigned-install `xattr` / tech stack / license prose
- step 2: rewrote README.md with 14 sections (features, 6-row shortcuts, getting started, CLI, config + file location, project structure, architecture + security note, building & packaging, signing, troubleshooting, tech stack, license)
- step 3: accuracy guardrails applied — no msi/snap, no drag-reorder claim, auto-update phrased as `publish: null` needing a provider, no test-suite instruction
- step 4: single trailing newline, no trailing whitespace (`git diff --check` clean)
- step 5: verified `git diff --stat` = 1 file (README.md); `grep -c -i "msi\|snap\|npm test" README.md` = 0

next: run docs verification profile (`git diff --check`) via agent-verify, push branch
