# STE200 intensity level — fork notes

Fork-local documentation for the `ste200` branch of `wunderman4/caveman`.
Not part of upstream (`JuliusBrussee/caveman`). Kept in its own file so an
upstream rebase never conflicts on `README.md`.

Base branch: `precise-rebase`. STE200 is `precise` plus a subset of ASD-STE100,
so it layers on that branch rather than on `main`.

## What STE200 is

ASD-STE100 (Simplified Technical English) is the controlled-language standard
maintained by the AeroSpace and Defence Industries Association of Europe. It
began as AECMA Simplified English for aircraft maintenance manuals, where a
misread instruction is a safety event. It has two halves: roughly 60 writing
rules, and a dictionary that admits one meaning and one part of speech per
approved word.

`precise` and ASD-STE100 already share a goal — `precise` states its priority as
zero ambiguity, which is the entire reason STE100 exists — but they pursue it
from opposite directions. STE100 *adds* words: mandatory articles, one
instruction per sentence, no noun clusters, no telegraphic style. `precise`
*adds specificity*: named tables and endpoints, `upsert` over `save`.

STE200 is the intersection worth having: STE100's ambiguity-control rules on top
of `precise`'s specificity, with STE100's vocabulary-control machinery left out.

## Rules taken from ASD-STE100

Ordered by ambiguity prevented per word added.

1. **Noun clusters capped at 3 words.** The rule this engine most needed. Dropping
   articles and prepositions is precisely what manufactures noun stacks —
   "payment processor token rotation script failure" parses at least three ways.
   Also applied as a guard on `full` and `ultra`, where the compression itself
   generates them.
2. **One operation, one verb, for the whole reply.** STE100's one-word-one-meaning
   principle, scoped to what matters here. `precise` already demands the exact
   verb; it did not demand consistency. Alternating `upsert`/`write`/`save` for
   variety leaves the reader unable to tell whether the second word names a
   second operation. Under compression this is worse than in prose, because
   there is no redundant context to disambiguate from. This also corrects
   `full`'s "short synonyms" guidance to mean *a shorter word for the same
   operation*, never a different word.
3. **Active voice, actor named.** Compression strips the agent first: "token
   rotated on deploy" — rotated by the deploy script, the lambda, or a person?
   `precise` stated no voice rule at all.
4. **One instruction per sentence.** The existing `[thing] [action] [reason].`
   pattern is adjacent but permits compound instructions. This addresses
   caveman's own Auto-Clarity trigger — "multi-step sequences where fragment
   order risks misread" — structurally, so the mode keeps compressing instead of
   exiting.
5. **Warnings precede the step they govern.** STE100 solves warning safety by
   placement. Adopting the placement rule shrinks the Auto-Clarity carve-out:
   security warnings and irreversible-action confirmations still drop to full
   prose, but ordinary cautions stay compressed and simply come first.
6. **No gerund or participle as a modifier.** Gerunds compress well and read
   ambiguously: "failing lambda check" is either the check that is failing or
   the check for failing lambdas.
7. **Sentence and paragraph targets.** 20 words procedural, 25 descriptive, 6
   sentences per paragraph. Caveman had no ceiling, only a direction. The
   failure mode under compression is not long sentences but dense ones — three
   clauses fused into one run with no signposts.

## Rules deliberately not taken

STE100's vocabulary-control half is wrong for this use case, and importing it
would be cargo-culting a standard built for a different reader.

- **The approved dictionary (~900 words).** Built for aircraft maintenance.
  Excludes nearly all software vocabulary.
- **The blanket abbreviation ban.** Upstream already measured this: invented
  abbreviations (`cfg`/`impl`/`req`) save zero tokens under the tokenizer and
  cost decode clarity, while standard acronyms (DB/API/HTTP) are fine. That
  finding is more specific than STE100's rule and it wins here. STE200 keeps
  upstream's version and does not extend the ban.
- **Mandatory articles at every level.** `full` and `ultra` drop articles *as
  the compression source*. `precise` and `ste200` keep them; the rule stops
  there.
- **The word counts as hard limits.** STE100 assumes a one-way channel: a paper
  manual, no follow-up question available. This channel is interactive, which
  buys terseness STE100 cannot allow. The counts are targets, not gates.

## Changes made

- `skills/caveman/SKILL.md`
  - Frontmatter level list and the `Default:` switch hint now include `ste200`.
  - Added the `| **ste200** |` intensity row, carrying the seven rules above.
  - Added `- ste200:` lines to both worked examples.
  - Appended the noun-cluster cap and one-verb consistency rule to the `full`
    and `ultra` rows, where those two failure modes actually bite.
- `plugins/caveman/skills/caveman/SKILL.md` — hand-synced copy of the above.
  `.github/workflows/sync-skill.yml` only fires on pushes to `main`, so a
  branch has to sync the mirror itself. `dist/caveman.skill` is left to CI, as
  on `precise-rebase`.
- `src/hooks/caveman-config.js` — added `'ste200'` to `VALID_MODES`, the
  whitelist governing mode selection, flag-file persistence, and `readFlag`.
  Without it the mode is rejected everywhere and silently falls back. The
  default stays `precise`; STE200 is opt-in via `/caveman ste200`,
  `CAVEMAN_DEFAULT_MODE=ste200`, or `defaultMode` in a config file.
- `src/hooks/caveman-activate.js` — fallback ruleset switch hint. Defensive
  only; the main path reads `SKILL.md`.
- `src/hooks/caveman-statusline.sh` and `.ps1` — added `ste200` **and**
  `precise` to the render whitelists. `precise` was missing on the base branch,
  so the statusline hit its reject arm and rendered nothing at all rather than
  `[CAVEMAN:PRECISE]`.
- `commands/caveman.toml` and `commands/caveman.md` — level list, argument
  hint, and the no-argument default (`full` to `precise`).
- `skills/caveman-help/SKILL.md` — added `Precise` and `STE200` rows, dropped
  the stale "Default." tag from `Full`, and corrected the documented default
  and resolution order to match `getDefaultMode()`.
- `tests/test_level_wiring.js` — new. Parses the intensity table out of
  `skills/caveman/SKILL.md` and asserts every documented level is in
  `VALID_MODES`, appears in both statusline whitelists, and has a worked example
  line; also checks the documented default is selectable and the plugin mirror
  is byte-identical. This is the defect class the fork has hit twice — `precise`
  shipped as prose with no engine support, then got engine support with no
  statusline support. The test fails on either gap.

## How a new level plugs into the engine

`src/hooks/caveman-activate.js` reads `skills/caveman/SKILL.md` at session start
and injects the body, filtering exactly two line shapes to the active level:

- intensity-table rows matching `^\|\s*\*\*(\S+?)\*\*\s*\|`
- example lines matching `^- (\S+?):\s`

Everything else in the file is injected verbatim at every level. A level's rules
therefore have to live **inside its table row**. A dedicated `## STE200` section
would leak into `lite`, `full`, and `ultra` sessions, which is why the long-form
rationale lives in this file instead — this file is never injected.

## Verification performed

Ran the branch's `caveman-activate.js` in an isolated `CLAUDE_CONFIG_DIR` with
`CAVEMAN_DEFAULT_MODE=ste200`:

- First line: `CAVEMAN MODE ACTIVE — level: ste200`
- Flag file contents: `ste200`
- Injected ruleset carried the `ste200` table row and both `ste200` examples,
  and no row or example for any other level
- `caveman-statusline.sh` against that flag rendered `[CAVEMAN:STE200]`
- Re-ran with no env override: still `precise`, confirming the default is
  unchanged
- `tests/test_level_wiring.js`: 7 passed, 0 failed. Negative-checked by
  temporarily removing `ste200` from `VALID_MODES` and the sh whitelist — the
  test failed on exactly those two assertions and exited 1, then passed again on
  restore.

### Pre-existing failures on the base branch

Not introduced here. Each was confirmed to fail identically on
`origin/precise-rebase` with these changes stashed.

- `tests/test_repo_local_config.js` — 8 passed, 4 failed. All four assert the
  `getDefaultMode()` fallback is `'full'`; `precise-rebase` changed it to
  `'precise'` without updating them (`'precise' !== 'full'`).
- `tests/test_hooks.py` — 2 failures, same cause: one asserts the flag file reads
  `full`, one asserts `| **full** |` appears in the emitted ruleset.
- `tests/test_mode_tracker.py` — 3 failures, all `'precise' !== 'full'` on the
  flag value.
- `tests/verify_repo.py` — `FAIL: caveman.skill payload mismatch`. `dist/caveman.skill`
  is a CI-built ZIP refreshed only by `sync-skill.yml` on pushes to `main`, so it
  is stale on any branch that edits `SKILL.md`.

The fix for the first three is mechanical — update the expected default from
`full` to `precise` — but it belongs on `precise-rebase`, since that is the
branch that changed the default. Doing it here would mix two concerns and
conflict on the next rebase.

## Branch vs merge

Same reasoning as `PRECISE-FORK-NOTES.md`: `main` stays a clean mirror of
`JuliusBrussee/main` so upstream rebases stay clean. STE200 sits on its own
branch on top of `precise-rebase`.

```
git fetch upstream
git rebase upstream/main precise-rebase
git rebase precise-rebase ste200
git push -f myfork ste200
```

A plugin refresh re-snapshots the **checked-out HEAD** into
`~/.claude/plugins/cache/caveman/caveman/<commit-sha>/`, so `ste200` has to be
the checked-out branch for the level to exist at runtime.
