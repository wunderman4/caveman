# Precise intensity level — fork notes

Fork-local documentation for the `precise-rebase` branch of `wunderman4/caveman`.
Not part of upstream (`JuliusBrussee/caveman`). Kept in its own file so an
upstream rebase never conflicts on `README.md`.

## What this branch adds

The `precise` intensity level, fully wired into the engine.

Background: upstream PR #302 ("Add precise intensity level to caveman skill")
and the local doc commits only edited `skills/caveman/SKILL.md` — prose. They
described `precise` as an option (and this fork's docs called it the default),
but the runtime engine never learned it. Result: `/caveman precise` was a
no-op and the mode silently fell back to `full`.

This branch closes that gap.

## Changes made

- `src/hooks/caveman-config.js`
  - Added `'precise'` to `VALID_MODES`. This is the whitelist used for mode
    selection, flag-file persistence, and `readFlag`. Without it, `precise`
    was rejected everywhere.
  - Changed the `getDefaultMode()` fallback from `'full'` to `'precise'`, so a
    session with no `CAVEMAN_DEFAULT_MODE` env var and no config file starts in
    precise.
- `src/hooks/caveman-activate.js`
  - Updated the fallback ruleset's switch hint from `/caveman lite|full|ultra`
    to `/caveman lite|precise|full|ultra`. Defensive only — the main path reads
    `SKILL.md`, which already contains the precise row and examples.
- `skills/caveman/SKILL.md` and `plugins/caveman/skills/caveman/SKILL.md`
  - Already carried the precise row, examples, and `Default: **precise**` from
    earlier doc commits. No change needed on this branch.

## How the plugin loads at runtime (why this mattered)

The marketplace is a `directory` source pointing at this repo
(`/Users/christianwunder/caveman`). Claude Code does **not** read the working
tree live. On install/refresh it takes a snapshot into a cache directory named
by commit SHA:

```
~/.claude/plugins/cache/caveman/caveman/<commit-sha>/
```

`~/.claude/plugins/installed_plugins.json` pins that `installPath` and
`gitCommitSha`. At runtime `CLAUDE_PLUGIN_ROOT` = the cache dir. So:

- Editing only the live repo does not affect the running plugin until a
  re-snapshot happens.
- The snapshot follows the **checked-out HEAD**, not `main`. Evidence at the
  time of this work: the installed `gitCommitSha` matched the `precise-rebase`
  tip while `main` was a different, older commit.

When this change was made, the pinned cache copy was patched in place as well
(no runtime checksum enforcement exists), so precise took effect on the next
session without waiting for a refresh.

## Keeping precise active

- Keep `precise-rebase` the **checked-out branch** in this repo. A plugin
  refresh re-snapshots the current HEAD; if you switch to `main` (which lacks
  precise) and a refresh fires, precise is lost at runtime until you check
  `precise-rebase` back out.
- Setting `CAVEMAN_DEFAULT_MODE=precise` is **not** a safety net on its own: if
  the running engine lacks `precise` in `VALID_MODES`, that env value is
  invalid and falls back to `full`. The engine code having `precise` is the
  only thing that makes it work.

## Branch vs merge — why this stays a branch

Goal: keep pulling from upstream (`JuliusBrussee`) and rebasing.

- Merging into `main` makes `main` diverge from `JuliusBrussee/main`, turning
  future upstream pulls into merge commits and conflicts.
- Keeping precise on its own branch lets `main` stay a clean mirror of
  upstream, so rebases stay clean.

### Rebase-sync workflow

```
git fetch upstream
git rebase upstream/main precise-rebase
git push -f myfork precise-rebase
```

After a rebase, if the running plugin was snapshotted from an old commit,
re-snapshot / refresh the plugin (or re-apply the in-place cache patch) so the
runtime picks up the rebased code.

## Verification performed

Ran the cache copy's `caveman-activate.js` in an isolated `CLAUDE_CONFIG_DIR`
with no env override:

- First line: `CAVEMAN MODE ACTIVE — level: precise`
- Flag file written: `precise`
- Emitted ruleset filtered to the precise table row only
- `/caveman precise` via the mode-tracker set the flag to `precise`
