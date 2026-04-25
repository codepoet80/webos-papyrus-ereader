# Optimization Ideas

Notes from the current import/rendering performance review. These are candidates for a later session, not committed design decisions.

## Highest Impact

1. Cache rendered image tags during page fitting

`PageFitter.handleImages()` fetches image data and creates `Image()` objects during every fit attempt. Because pagination binary-searches page length, the same image can be decoded/measured several times before one page is finalized.

- Idea: add a small cache keyed by image label and max height, returning the generated `<img ...>` tag for repeated fit attempts.
- Payoff: high for image-heavy books.
- Risk: medium.

2. Limit background preloading for image-heavy pages

`EpubRenderer.schedulePreload()` preloads next and previous pages after every display. For pages with embedded base64 images, this can render and hold huge HTML strings in the background.

- Idea: preload only the next page, delay preloading longer, or skip preloading when rendered HTML is above a size threshold.
- Payoff: high for large/image-heavy books.
- Risk: low-medium.

3. Avoid caching huge rendered HTML strings

Rendered page HTML can be very large because images are embedded as base64. `pageCache.nextHtml` and `pageCache.prevHtml` can hold large strings and increase memory/GC pressure.

- Idea: do not cache image-heavy pages, or cache page positions only and recompute on demand.
- Payoff: high memory/GC improvement.
- Risk: medium, because image page turns may become less instant.

## Import Path

4. Test larger import chunks

`HTMLBook.chunkSize` is currently larger than the original default, which reduces WebSQL writes. A larger value may reduce import time further.

- Idea: test `32768` against text-heavy and image-heavy books.
- Payoff: medium.
- Risk: low if page turning is tested afterward.

5. Use a map for duplicate image detection

`imgNameBuffer.indexOf(label)` is O(n). Most books are fine, but image-heavy books with repeated assets may pay unnecessary lookup cost.

- Idea: use an object map for seen image labels during import.
- Payoff: low-medium.
- Risk: low.

6. Revisit image write sequencing

Image storage currently writes image data without waiting for the WebSQL callback. This can queue writes during image-heavy imports.

- Idea: serialize image writes or wait for each image write callback before continuing.
- Payoff: medium stability improvement; speed impact uncertain.
- Risk: medium, because the import async chain is delicate.

## Rendering And Page Turn

7. Expand the image data cache

`HTMLBook` currently caches only one image via `lastImageLabel` and `lastImageData`.

- Idea: replace it with a tiny LRU cache, maybe 4-8 images.
- Payoff: medium-high for illustrated books.
- Risk: low-medium memory tradeoff.

8. Memoize repeated fit calculations

Page fitting repeatedly calls `readReplaceAndFit()` with similar ranges during binary search. Buffers may be reused, but assembled HTML and image replacement are redone.

- Idea: memoize per-fit `(start,length)` results, or memoize buffer-to-HTML conversion inside one page calculation.
- Payoff: medium.
- Risk: medium complexity.

## Low-Hanging Cleanup

9. Trim remaining non-hot logs

Some normal-path logs remain in startup/import paths. They are unlikely to dominate, but can be reduced for production builds.

- Payoff: low.
- Risk: low.

10. Remove ZIP magic scan debug logging

`ZipFile.scanBackwardForMagic()` still logs scan details during import.

- Payoff: low-medium for imports.
- Risk: low.

## Recommended Next Experiment

Start by limiting or disabling preloading for image-heavy pages. It likely offers the best payoff/risk balance because it reduces background work and memory pressure without touching the fragile import chain.
