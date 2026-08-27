<?php
/**
 * Papyrus dictionary proxy
 *
 * Why this exists
 * ---------------
 * Papyrus originally called https://api.dictionaryapi.dev directly.  In August
 * 2026 that service's origin server stopped answering: Cloudflare kept serving
 * stale cached entries (some with an `age` of 30 days against a declared
 * max-age of 4 hours) while every uncached word timed out.  Common words
 * appeared to work, uncommon ones hung, and the failure looked intermittent.
 * A free API dying under a legacy client is not a one-off — the same thing
 * happened to AccuWeather's XML API (see the accuweatherxml-proxy project) —
 * so lookups now go through a proxy we control.  When the next provider dies,
 * this one file changes and every installed copy of Papyrus keeps working,
 * including webOS devices that will never be updated again.
 *
 * Contract
 * --------
 *   GET dictionary.php?w=<word>
 *
 *   200  JSON array, dictionaryapi.dev-compatible (see below)
 *   404  {"title":"No Definitions Found", ...}  -> app shows "No definition found."
 *   502  {"title":"Upstream Unavailable", ...}  -> app shows "Couldn't reach the dictionary."
 *
 * The 200 payload deliberately mirrors the old dictionaryapi.dev shape so the
 * app's DefinitionPopup.js renders it without any changes:
 *
 *   [{"word":"thither",
 *     "phonetic":"", "phonetics":[],
 *     "meanings":[{"partOfSpeech":"adverb",
 *                  "definitions":[{"definition":"To that place.","example":""}]}],
 *     "source":"datamuse"}]
 *
 * Sources, in order
 * -----------------
 *   1. Datamuse (WordNet)  - concise, plain-text glosses, tiny payloads.
 *   2. Wiktionary REST     - broader coverage; HTML is stripped here, server
 *                            side, so the device never parses markup.
 *
 * Both were verified to cover the literary/archaic vocabulary that actually
 * turns up in old public-domain books (whilom, bedizened, susurrus, ere, hast,
 * gainsay...).  Neither needs an API key.
 *
 * Caching
 * -------
 * Definitions are effectively immutable, so hits are cached on disk for 30
 * days (negative results for 7, so a transient upstream miss doesn't stick).
 * If every upstream fails we serve a stale cache entry rather than an error —
 * the one genuinely good behaviour dictionaryapi.dev's CDN had.  A read-only
 * or missing cache directory is not fatal; the proxy just stops caching.
 *
 * Deployment
 * ----------
 * Lives in the repo root, so it syncs to http://papyrus.wosa.link/dictionary.php.
 * The app calls it over plain http on webOS on purpose: TouchPads that were
 * never patched for modern TLS can still reach it.  Definitions are public,
 * non-personal data, so there is nothing here worth protecting in transit.
 * On the PWA the app uses the page's own scheme, which keeps the request
 * same-origin (the PWA is served from this same host) and avoids tripping
 * browsers' mixed-content blocking.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

$CACHE_DIR         = __DIR__ . '/cache/dictionary';
$CACHE_TTL         = 30 * 24 * 60 * 60;   // successful lookups
$CACHE_TTL_MISS    = 7  * 24 * 60 * 60;   // "no such word" results
$CACHE_STALE_MAX   = 365 * 24 * 60 * 60;  // how far back we'll reach when upstreams are down
$UPSTREAM_TIMEOUT  = 6;                   // seconds, per upstream
$MAX_WORD_LEN      = 64;

// Wikimedia's API policy asks for a descriptive User-Agent with a contact URL;
// requests with a generic or absent one may be throttled or blocked.
$USER_AGENT = 'Papyrus-eReader/1.6 (+https://github.com/codepoet80/webos-papyrus-ereader)';

// nginx on papyrus.wosa.link already emits Access-Control-Allow-Origin: *
// for this host.  Emitting it here too would produce a DUPLICATE header, and
// browsers reject a CORS response carrying two ACAO values — which would break
// the PWA in a way that looks exactly like a network error.  Only turn this on
// if you deploy somewhere without server-level CORS headers.
$SEND_CORS_HEADERS = false;

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

if ($SEND_CORS_HEADERS) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
}

// A preflight should never cost an upstream call.  (dictionaryapi.dev's OPTIONS
// endpoint returning 522 was the first hard evidence its origin was down.)
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$raw = '';
if (isset($_GET['w']))         { $raw = $_GET['w']; }
elseif (isset($_GET['word']))  { $raw = $_GET['word']; }

$word = normalize_word($raw, $MAX_WORD_LEN);
if ($word === '') {
    send_not_found('');
}

// ---------------------------------------------------------------------------
// Cache lookup
// ---------------------------------------------------------------------------

$cachePath = cache_path($CACHE_DIR, $word);
$cached    = cache_read($cachePath, $CACHE_STALE_MAX);

if ($cached !== null) {
    $ttl = ($cached['status'] === 200) ? $CACHE_TTL : $CACHE_TTL_MISS;
    if ((time() - $cached['time']) <= $ttl) {
        header('X-Papyrus-Cache: hit');
        header('Cache-Control: public, max-age=86400');
        http_response_code($cached['status']);
        echo $cached['body'];
        exit;
    }
}

// ---------------------------------------------------------------------------
// Upstreams
// ---------------------------------------------------------------------------

$entry     = null;
$anyReached = false;

$res = fetch_datamuse($word, $UPSTREAM_TIMEOUT, $USER_AGENT);
if ($res['reached']) { $anyReached = true; }
if ($res['entry'])   { $entry = $res['entry']; }

if ($entry === null) {
    $res = fetch_wiktionary($word, $UPSTREAM_TIMEOUT, $USER_AGENT);
    if ($res['reached']) { $anyReached = true; }
    if ($res['entry'])   { $entry = $res['entry']; }
}

// ---------------------------------------------------------------------------
// Respond
// ---------------------------------------------------------------------------

if ($entry !== null) {
    $body = json_encode(array($entry));
    cache_write($cachePath, 200, $body);
    header('X-Papyrus-Cache: miss');
    header('Cache-Control: public, max-age=86400');
    echo $body;
    exit;
}

if (!$anyReached) {
    // Every upstream was unreachable.  A stale definition beats an error.
    if ($cached !== null) {
        header('X-Papyrus-Cache: stale');
        http_response_code($cached['status']);
        echo $cached['body'];
        exit;
    }
    http_response_code(502);
    echo json_encode(array(
        'title'      => 'Upstream Unavailable',
        'message'    => 'No dictionary source could be reached.',
        'resolution' => 'Try again later.'
    ));
    exit;
}

// Upstreams answered, they simply have no such word.
send_not_found($word, $cachePath);


// ===========================================================================
// Helpers
// ===========================================================================

function send_not_found($word, $cachePath = null) {
    $body = json_encode(array(
        'title'      => 'No Definitions Found',
        'message'    => 'Sorry pal, we couldn\'t find definitions for the word you were looking for.',
        'resolution' => 'You can try the search again at later time or head to the web instead.'
    ));
    if ($cachePath) { cache_write($cachePath, 404, $body); }
    http_response_code(404);
    echo $body;
    exit;
}

/**
 * Accept only what a tapped word can legitimately be.  Mirrors the client-side
 * cleanup in Dictionary.js so both ends agree on the cache key.
 */
function normalize_word($raw, $maxLen) {
    if (!is_string($raw)) { return ''; }
    $w = trim($raw);

    // ePubs typeset apostrophes as U+2019, not ASCII "'".  Datamuse indexes the
    // ASCII form only: "o'clock" hits, "o’clock" misses entirely, and "don’t"
    // quietly matches the unrelated entry for "dont".  Fold the typographic
    // variants down before querying.  (Wiktionary accepts either.)
    $w = str_replace(
        array("\xE2\x80\x98", "\xE2\x80\x99", "\xCA\xBC", "\xE2\x80\xB2"),  // ‘ ’ ʼ ′
        "'", $w);
    $w = str_replace(array("\xE2\x80\x90", "\xE2\x80\x91"), '-', $w);       // ‐ ‑

    $w = function_exists('mb_strtolower') ? mb_strtolower($w, 'UTF-8') : strtolower($w);

    // Keep letters of any alphabet.  An [a-z] whitelist strips accents and
    // silently turns one word into a DIFFERENT one -- "naïve" becomes "nave",
    // the body of a church -- which is far worse than reporting no definition.
    // Both upstreams handle accented words natively.
    $w = preg_replace("/[^\\p{L}\\p{N}'\\-]/u", '', $w);
    if ($w === null) { return ''; }   // also catches malformed UTF-8

    $len = function_exists('mb_strlen') ? mb_strlen($w, 'UTF-8') : strlen($w);
    if ($len === 0 || $len > $maxLen) { return ''; }
    return $w;
}

// -------------------------- HTTP ------------------------------------------

/**
 * Returns array(status, body).  status 0 means "could not reach at all",
 * which is what distinguishes a dead upstream from an honest 404.
 */
function http_get($url, $timeout, $userAgent) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_USERAGENT, $userAgent);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Accept: application/json'));
        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false) { return array('status' => 0, 'body' => ''); }
        return array('status' => $status, 'body' => $body);
    }

    $ctx = stream_context_create(array('http' => array(
        'method'        => 'GET',
        'timeout'       => $timeout,
        'ignore_errors' => true,
        'header'        => "Accept: application/json\r\nUser-Agent: " . $userAgent . "\r\n"
    )));
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) { return array('status' => 0, 'body' => ''); }

    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) { $status = (int) $m[1]; }
        }
    }
    return array('status' => $status, 'body' => $body);
}

// -------------------------- Datamuse ---------------------------------------

/**
 * Datamuse returns defs as "pos\tdefinition" strings, e.g.
 *   ["n\t\"Hello!\" or an equivalent greeting. ", "v\t(transitive) To greet..."]
 * No phonetics and no examples, which is fine: webOS suppresses IPA anyway
 * (its font set has no coverage) and examples are optional in the popup.
 */
function fetch_datamuse($word, $timeout, $userAgent) {
    $url = 'https://api.datamuse.com/words?md=d&max=1&sp=' . rawurlencode($word);
    $res = http_get($url, $timeout, $userAgent);

    if ($res['status'] === 0) { return array('reached' => false, 'entry' => null); }
    if ($res['status'] !== 200) { return array('reached' => true, 'entry' => null); }

    $data = json_decode($res['body'], true);
    if (!is_array($data) || !count($data)) { return array('reached' => true, 'entry' => null); }

    $first = $data[0];
    // sp= is an exact-spelling match, but guard anyway so we never define a
    // different word than the one the reader tapped.
    if (!isset($first['word']) || strtolower($first['word']) !== $word) {
        return array('reached' => true, 'entry' => null);
    }
    if (!isset($first['defs']) || !is_array($first['defs']) || !count($first['defs'])) {
        return array('reached' => true, 'entry' => null);
    }

    // Group senses under their part of speech, preserving first-seen order.
    $order  = array();
    $byPos  = array();
    foreach ($first['defs'] as $def) {
        if (!is_string($def)) { continue; }
        $pos  = '';
        $text = $def;
        $tab  = strpos($def, "\t");
        if ($tab !== false) {
            $pos  = expand_pos(substr($def, 0, $tab));
            $text = substr($def, $tab + 1);
        }
        $text = tidy_text($text);
        if ($text === '') { continue; }
        if (!isset($byPos[$pos])) { $byPos[$pos] = array(); $order[] = $pos; }
        $byPos[$pos][] = array('definition' => $text, 'example' => '');
    }
    if (!count($order)) { return array('reached' => true, 'entry' => null); }

    $meanings = array();
    foreach ($order as $pos) {
        $meanings[] = array('partOfSpeech' => $pos, 'definitions' => $byPos[$pos]);
    }
    return array('reached' => true, 'entry' => make_entry($word, $meanings, 'datamuse'));
}

/** Datamuse uses WordNet's short POS tags. */
function expand_pos($abbr) {
    switch (trim($abbr)) {
        case 'n':    return 'noun';
        case 'v':    return 'verb';
        case 'adj':  return 'adjective';
        case 'adv':  return 'adverb';
        case 'u':    return '';        // WordNet's "unknown"
        default:     return trim($abbr);
    }
}

// -------------------------- Wiktionary -------------------------------------

/**
 * Wiktionary REST keys its response by language code and returns definitions
 * as HTML.  We take English only ("la", "fr", ... are dropped) and strip the
 * markup here so the device receives plain text.
 */
function fetch_wiktionary($word, $timeout, $userAgent) {
    $url = 'https://en.wiktionary.org/api/rest_v1/page/definition/' . rawurlencode($word);
    $res = http_get($url, $timeout, $userAgent);

    if ($res['status'] === 0) { return array('reached' => false, 'entry' => null); }
    if ($res['status'] === 404) { return array('reached' => true, 'entry' => null); }
    if ($res['status'] !== 200) { return array('reached' => true, 'entry' => null); }

    $data = json_decode($res['body'], true);
    if (!is_array($data) || !isset($data['en']) || !is_array($data['en'])) {
        return array('reached' => true, 'entry' => null);
    }

    $meanings = array();
    foreach ($data['en'] as $group) {
        if (!isset($group['definitions']) || !is_array($group['definitions'])) { continue; }

        $pos  = isset($group['partOfSpeech']) ? strtolower(trim($group['partOfSpeech'])) : '';
        $defs = array();

        foreach ($group['definitions'] as $d) {
            if (!isset($d['definition'])) { continue; }
            $text = tidy_text(strip_html($d['definition']));
            // Usage-label spans can be the entire content of a sense; once the
            // markup is gone there is nothing left to show.
            if ($text === '') { continue; }

            $example = '';
            if (isset($d['parsedExamples'][0]['example'])) {
                $example = tidy_text(strip_html($d['parsedExamples'][0]['example']));
            } elseif (isset($d['examples'][0])) {
                $example = tidy_text(strip_html($d['examples'][0]));
            }

            $defs[] = array('definition' => $text, 'example' => $example);
        }

        if (count($defs)) {
            $meanings[] = array('partOfSpeech' => $pos, 'definitions' => $defs);
        }
    }

    if (!count($meanings)) { return array('reached' => true, 'entry' => null); }
    return array('reached' => true, 'entry' => make_entry($word, $meanings, 'wiktionary'));
}

function strip_html($html) {
    // Drop whole elements whose text content is not part of the definition.
    $s = preg_replace('#<(script|style)\b[^>]*>.*?</\1>#is', ' ', $html);
    $s = str_replace(array('<br>', '<br/>', '<br />'), ' ', $s);
    $s = strip_tags($s);
    return html_entity_decode($s, ENT_QUOTES, 'UTF-8');
}

/** Collapse whitespace and trim the stray punctuation stripping can leave behind. */
function tidy_text($s) {
    $s = preg_replace('/\s+/u', ' ', $s);
    if ($s === null) { return ''; }
    $s = trim($s);
    $s = preg_replace('/^[,;:\s]+/u', '', $s);
    return $s === null ? '' : trim($s);
}

/** phonetic/phonetics are always empty: neither source supplies IPA. */
function make_entry($word, $meanings, $source) {
    return array(
        'word'      => $word,
        'phonetic'  => '',
        'phonetics' => array(),
        'meanings'  => $meanings,
        'source'    => $source
    );
}

// -------------------------- Cache ------------------------------------------

function cache_path($dir, $word) {
    $hash = md5($word);
    // Shard so a large cache doesn't end up as one enormous directory.
    return $dir . '/' . substr($hash, 0, 2) . '/' . $hash . '.json';
}

function cache_read($path, $staleMax) {
    if (!is_readable($path)) { return null; }
    $rec = json_decode(@file_get_contents($path), true);
    if (!is_array($rec) || !isset($rec['time'], $rec['status'], $rec['body'])) { return null; }
    if ((time() - $rec['time']) > $staleMax) { return null; }
    return $rec;
}

function cache_write($path, $status, $body) {
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) { return; }

    $rec = json_encode(array('time' => time(), 'status' => $status, 'body' => $body));
    // Write-then-rename so a concurrent reader never sees a half-written file.
    $tmp = $path . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, $rec) === false) { return; }
    if (!@rename($tmp, $path)) { @unlink($tmp); }
}
