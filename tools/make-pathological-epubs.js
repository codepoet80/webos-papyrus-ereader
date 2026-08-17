#!/usr/bin/env node
/**
 * make-pathological-epubs.js — generates ePubs that trigger the two known
 * structural cliffs in the import engine, so fixes for them can be verified
 * instead of assumed.
 *
 *   giant-datauri.epub  a single <img src="data:..."> tag larger than one
 *                       16KB storage chunk.  Triggers audit F8: HTMLBook
 *                       treats "no parseable bytes in this chunk" as
 *                       end-of-book and SILENTLY TRUNCATES the rest.
 *
 *   unclosed-tag.epub   a "<" that never closes, so every 4KB filter round
 *                       carries and re-parses an ever-growing buffer.
 *                       Triggers audit F7: quadratic re-parse.
 *
 * Both files end with a distinctive sentinel sentence.  If the sentinel is
 * missing from the imported book, content was lost.
 *
 * Usage: node tools/make-pathological-epubs.js [outDir]
 */

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var outDir = process.argv[2] || path.join(require('os').tmpdir(), 'papyrus-pathological');
if (!fs.existsSync(outDir)) { fs.mkdirSync(outDir, { recursive: true }); }

var SENTINEL = 'SENTINELTAILTEXT the quick brown fox jumped over the lazy dog completely.';

// ---------------------------------------------------------------- zip writer
function crc32(buf) {
	var table = crc32.table;
	if (!table) {
		table = crc32.table = [];
		for (var n = 0; n < 256; n++) {
			var c = n;
			for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
			table[n] = c >>> 0;
		}
	}
	var crc = 0xFFFFFFFF;
	for (var i = 0; i < buf.length; i++) { crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF]; }
	return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeZip(entries) {
	var locals = [], central = [], offset = 0;
	entries.forEach(function (e) {
		var nameBuf = Buffer.from(e.name, 'utf8');
		var raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
		var stored = e.store === true;
		var data = stored ? raw : zlib.deflateRawSync(raw);
		var crc = crc32(raw);

		var lh = Buffer.alloc(30);
		lh.writeUInt32LE(0x04034b50, 0);
		lh.writeUInt16LE(20, 4);
		lh.writeUInt16LE(0, 6);
		lh.writeUInt16LE(stored ? 0 : 8, 8);
		lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
		lh.writeUInt32LE(crc, 14);
		lh.writeUInt32LE(data.length, 18);
		lh.writeUInt32LE(raw.length, 22);
		lh.writeUInt16LE(nameBuf.length, 26);
		lh.writeUInt16LE(0, 28);
		locals.push(lh, nameBuf, data);

		var ch = Buffer.alloc(46);
		ch.writeUInt32LE(0x02014b50, 0);
		ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
		ch.writeUInt16LE(0, 8);
		ch.writeUInt16LE(stored ? 0 : 8, 10);
		ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
		ch.writeUInt32LE(crc, 16);
		ch.writeUInt32LE(data.length, 20);
		ch.writeUInt32LE(raw.length, 24);
		ch.writeUInt16LE(nameBuf.length, 28);
		ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
		ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
		ch.writeUInt32LE(0, 38);
		ch.writeUInt32LE(offset, 42);
		central.push(ch, nameBuf);

		offset += lh.length + nameBuf.length + data.length;
	});

	var centralBuf = Buffer.concat(central);
	var eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(centralBuf.length, 12);
	eocd.writeUInt32LE(offset, 16);
	eocd.writeUInt16LE(0, 20);
	return Buffer.concat([Buffer.concat(locals), centralBuf, eocd]);
}

function buildEpub(name, chapters) {
	var manifest = '', spine = '';
	chapters.forEach(function (ch, i) {
		manifest += '<item id="c' + i + '" href="' + ch.file + '" media-type="application/xhtml+xml"/>\n';
		spine += '<itemref idref="c' + i + '"/>\n';
	});
	var opf = '<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bid">\n' +
		'<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
		'<dc:title>' + name + '</dc:title>\n<dc:creator>Test Harness</dc:creator>\n' +
		'<dc:language>en</dc:language>\n<dc:identifier id="bid">urn:uuid:test-' + name + '</dc:identifier>\n' +
		'</metadata>\n<manifest>\n' + manifest + '</manifest>\n<spine toc="ncx">\n' + spine + '</spine>\n</package>';

	var container = '<?xml version="1.0"?>\n' +
		'<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
		'<rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n' +
		'</container>';

	var entries = [
		{ name: 'mimetype', data: 'application/epub+zip', store: true },
		{ name: 'META-INF/container.xml', data: container },
		{ name: 'content.opf', data: opf }
	];
	chapters.forEach(function (ch) { entries.push({ name: ch.file, data: ch.body }); });
	return makeZip(entries);
}

function wrap(inner) {
	return '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n' +
		'<head><title>t</title></head>\n<body>\n' + inner + '\n</body>\n</html>';
}

function filler(paras, tag) {
	var s = '';
	for (var i = 0; i < paras; i++) {
		s += '<p>' + tag + ' paragraph ' + i + ' with enough words in it to occupy a ' +
			'reasonable amount of space in the text stream so chunk boundaries are ' +
			'exercised properly during this test run.</p>\n';
	}
	return s;
}

// ------------------------------------------------------- giant data: URI (F8)
// One base64 blob well past HTMLBook.chunkSize (16384) inside a single tag.
var bigB64 = Buffer.alloc(40000, 0x41).toString('base64');   // ~53KB of base64
var giant = buildEpub('giant-datauri', [
	{ file: 'c0.html', body: wrap(filler(30, 'before') +
		'<p><img src="data:image/png;base64,' + bigB64 + '" alt="huge"/></p>\n' +
		filler(30, 'after') + '<p>' + SENTINEL + '</p>') }
]);
fs.writeFileSync(path.join(outDir, 'giant-datauri.epub'), giant);

// --------------------------------------------------------- unclosed tag (F7)
// A "<" with no ">" for the rest of the file: every filter round re-parses a
// growing carry buffer.
var unclosed = buildEpub('unclosed-tag', [
	{ file: 'c0.html', body: wrap(filler(20, 'intro') +
		'<p>text then a runaway bracket <span class="never closed ' +
		filler(400, 'trapped').replace(/[<>]/g, '') +
		' ' + SENTINEL + '</p>') }
]);
fs.writeFileSync(path.join(outDir, 'unclosed-tag.epub'), unclosed);

// ------------------------------------------------------------- sanity control
var control = buildEpub('control', [
	{ file: 'c0.html', body: wrap(filler(40, 'one') + '<p>' + SENTINEL + '</p>') },
	{ file: 'c1.html', body: wrap(filler(40, 'two')) }
]);
fs.writeFileSync(path.join(outDir, 'control.epub'), control);

console.log('wrote pathological test epubs to ' + outDir);
console.log('  giant-datauri.epub  (F8 silent truncation)');
console.log('  unclosed-tag.epub   (F7 quadratic re-parse)');
console.log('  control.epub        (sanity)');
console.log('sentinel: ' + SENTINEL);
