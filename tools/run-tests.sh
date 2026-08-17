#!/bin/bash
#
# run-tests.sh — the import-pipeline regression suite.
#
# Run this after ANY change to the import path:
#   app/src/pdb/EpubReader.js, app/src/display/HTMLBook.js,
#   app/src/display/HTMLBuffer.js, app/src/display/HTMLParser.js,
#   app/src/io/Bytes.js, app/src/io/Compression/*, app/app/common/FileImporter.js,
#   app/app/common/ImportSession.js
#
# Exits non-zero if anything regresses, so it can gate a commit.
#
# What it does NOT do: predict webOS wall-clock time.  Old JavaScriptCore has
# very different costs from Node.  Use the "timers" and "writes" columns as the
# portable proxies, then confirm real timing on a device.
#
# Usage:
#   ./tools/run-tests.sh                 # real books + pathological + cancel suite
#   ./tools/run-tests.sh /path/to/books  # use a different book directory
#
set -u

cd "$(dirname "$0")/.."
TOOLS="tools"
BOOKS="${1:-/Users/jonwise/Desktop/BooksToTest}"
PATHO="$(mktemp -d)/patho"

blue()  { printf '\n\033[1;34m== %s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- dependency
if ! node -e "require('$PWD/$TOOLS/jsdom-loader.js')()" >/dev/null 2>&1; then
    blue "Installing jsdom (one time, into tools/node_modules — gitignored)"
    npm install --prefix "$TOOLS" --no-save --silent jsdom || {
        red "Could not install jsdom. Install it manually and re-run."
        exit 2
    }
fi

FAILED=0

# ------------------------------------------------------------------ syntax
blue "Syntax check (engine + app import path)"
SYNTAX_OK=1
for f in \
    app/src/io/Bytes.js \
    app/src/io/Database.js \
    app/src/io/Compression/Inflate.js \
    app/src/io/Compression/ZipFile.js \
    app/src/pdb/EpubReader.js \
    app/src/display/HTMLBook.js \
    app/src/display/HTMLBuffer.js \
    app/src/display/HTMLParser.js \
    app/app/common/ImportSession.js \
    app/app/common/FileImporter.js \
    app/app/Main.js ; do
    if ! node --check "$f" >/dev/null 2>&1; then
        red "  SYNTAX ERROR: $f"
        SYNTAX_OK=0
        FAILED=1
    fi
done
[ "$SYNTAX_OK" = "1" ] && green "  all files parse"

# ------------------------------------------------- cancellation / error suite
blue "Cancellation + error-handling suite"
if node "$TOOLS/import-cancel-test.js"; then
    green "  cancel suite passed"
else
    red "  cancel suite FAILED"
    FAILED=1
fi

# ------------------------------------------------------------- real books
if [ -d "$BOOKS" ]; then
    blue "Real books: $BOOKS"
    if node "$TOOLS/import-bench.js" "$BOOKS"; then
        green "  real books passed"
    else
        red "  real books FAILED"
        FAILED=1
    fi
else
    red "Skipping real books: no such directory $BOOKS"
fi

# ---------------------------------------------------------- pathological set
blue "Pathological books (generated: giant data: URI, unclosed tag, control)"
node "$TOOLS/make-pathological-epubs.js" "$PATHO" >/dev/null 2>&1
if node "$TOOLS/import-bench.js" "$PATHO"; then
    green "  pathological set passed"
else
    red "  pathological set FAILED"
    FAILED=1
fi
rm -rf "$PATHO"

# ------------------------------------------------------------------- verdict
echo ""
if [ "$FAILED" = "0" ]; then
    green "ALL IMPORT TESTS PASSED"
    echo "Reminder: this does not measure webOS speed. Install and time on device"
    echo "before trusting any performance conclusion (see IMPORT-REWORK-PLAN.md)."
    exit 0
fi
red "IMPORT TESTS FAILED"
exit 1
