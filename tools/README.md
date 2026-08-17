# Import pipeline test harness

Regression tests for the ePub import path. Run them after **any** change to:

```
app/src/pdb/EpubReader.js        app/src/display/HTMLBook.js
app/src/display/HTMLBuffer.js    app/src/display/HTMLParser.js
app/src/io/Bytes.js              app/src/io/Compression/*
app/app/common/FileImporter.js   app/app/common/ImportSession.js
```

## Run everything

```
./tools/run-tests.sh
./tools/run-tests.sh /path/to/other/books    # different book directory
```

Installs `jsdom` on first run (into `tools/node_modules`, which is gitignored —
this repo intentionally keeps `package.json`/`node_modules` out of git). Exits
non-zero if anything regresses, so it can gate a commit.

## What each tool does

| tool | purpose |
|---|---|
| `import-bench.js` | Imports every `.epub` in a directory through the **real engine sources**, twice (chapter-breaks off and on). Reports work counts, checks for silent truncation, and re-opens each book from storage. |
| `import-cancel-test.js` | 16 assertions that an import can actually be **stopped**, that a thrown step is **reported** rather than swallowed, and that the single-flight lock is released correctly. |
| `make-pathological-epubs.js` | Generates books that trigger known structural cliffs, so fixes for them can be verified instead of assumed. |
| `jsdom-loader.js` | Finds jsdom, or explains how to install it. Not a test. |

## Reading `import-bench.js` output

```
book                     config      status    ms  timers  steps  chunks  writes  chaps  breaks  trunc  reopen
Being Human - Star Trek  breaks-OFF  ok       716      27    458      30      17     22       1     ok      ok
```

| column | meaning |
|---|---|
| `status` | `ok`, or `CHAIN-DEATH` (a step threw), `TIMEOUT`, `REOPEN-FAIL`, `BUFFER-FAIL` |
| `ms` | Node wall-clock. **Does not predict device time** — see the warning below. |
| `timers` | `setTimeout` calls. **The best portable proxy for device cost**: each one was a ~10ms floor on webOS. Watch this, not `ms`. |
| `steps` | Chain steps executed. Roughly "work done"; should stay flat unless the algorithm changed. |
| `chunks` | `HTMLBook.readFromReader` cycles |
| `writes` | WebSQL transactions. Each is a disk flush on device, so fewer is materially faster. |
| `chaps` / `breaks` | Chapters parsed / chapter-break positions recorded |
| `trunc` | `ok`, or the number of bytes **silently lost**. Never accept a number here. |
| `reopen` | Book re-opened from storage with matching length and readable first/last buffers. Proves the import actually persisted. |

## The one rule

**These tests cannot measure webOS speed.** Old JavaScriptCore has wildly
different per-operation costs than V8; a change that looks free here has been
catastrophic on a TouchPad before. Use `timers` and `writes` as the portable
proxies, then confirm real wall-clock on a device:

```
./build.sh
palm-install com.palm.codepoet.papyrus_*.ipk
printf 'initctl restart LunaSysMgr\nexit\n' | novacom open tty://   # REQUIRED: webOS caches app code
palm-log -f com.palm.codepoet.papyrus | grep IMPORTSTATS
```

Every import logs one summary line:

```
IMPORTSTATS status=ok file=Book.epub total=88.4s load=1.2s parse=31.0s cover=4.1s store=52.1s chunks=30 dbWrites=17 textKB=459 images=12
```

That line is the whole diagnostic — it says which phase regressed without
needing a live debugging session.

## Pathological books

`make-pathological-epubs.js` writes three ePubs, each ending in a sentinel
sentence so lost content is detectable:

- **`giant-datauri.epub`** — one `<img src="data:...">` tag bigger than a 16KB
  storage chunk. Used to make the engine treat "nothing parsed in this chunk"
  as end-of-book and **silently discard the rest of the book** while reporting
  success (audit F8).
- **`unclosed-tag.epub`** — a `<` that never closes, so each filter round
  carries and re-parses a growing buffer.
- **`control.epub`** — ordinary book; if this fails, the harness is broken, not
  the engine.

## Background

- `IMPORT-AUDIT.html` (repo root) — the full findings, F1–F16
- `IMPORT-REWORK-PLAN.md` (repo root) — the phased plan, status, and the
  device benchmark protocol

The headline finding, for context on why these tests exist: `concatArray` in
`src/io/Bytes.js` appended **backwards**, writing past the end of the
destination array first, which permanently degraded every growing byte buffer
into a sparse array. Accumulating 1.3MB in 4KB pieces measured **58.5 seconds**
backwards versus **31 milliseconds** forwards (~1900×). Because the penalty
scales with bytes already accumulated, short books were fine and long ones
appeared to hang — which is what made the bug read as random for so long.
