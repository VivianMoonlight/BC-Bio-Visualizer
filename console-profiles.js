(async () => {
  // 1) Load LZString (creates global LZString)
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });

  function byteStringToUtf8(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return utf8Decoder.decode(bytes);
  }

  function scoreText(s) {
    if (!s || typeof s !== 'string') return -1;
    let control = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 9 || (c > 10 && c < 32) || c === 127) control++;
    }
    return s.length - control * 5;
  }

  function tryDecode(fn, input) {
    try {
      return fn(input);
    } catch {
      return null;
    }
  }

  function decodeDescription(input) {
    if (typeof input !== 'string' || input.length === 0) return '';

    // Match original logic: substring(1) before decompress
    const sliced = input.substring(1);

    const candidates = [];

    const d1 = tryDecode(LZString.decompressFromUTF16, sliced);
    if (d1) {
      candidates.push(d1);
      candidates.push(byteStringToUtf8(d1));
    }

    const d2 = tryDecode(LZString.decompressFromBase64, sliced);
    if (d2) {
      candidates.push(d2);
      candidates.push(byteStringToUtf8(d2));
    }

    const d3 = tryDecode(LZString.decompressFromEncodedURIComponent, sliced);
    if (d3) {
      candidates.push(d3);
      candidates.push(byteStringToUtf8(d3));
    }

    // Fallback: raw input
    candidates.push(input);

    // Pick the most readable candidate
    let best = '';
    let bestScore = -1;
    for (const c of candidates) {
      const sc = scoreText(c);
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    return best;
  }

  function pickBasicInfo(row, bundle) {
    return {
      memberNumber: row.memberNumber ?? bundle?.MemberNumber ?? null,
      name: row.name ?? bundle?.Name ?? null,
      lastNick: row.lastNick ?? null,
      seen: row.seen ?? null,
      title: bundle?.Title ?? null,
      nickname: bundle?.Nickname ?? null,
      assetFamily: bundle?.AssetFamily ?? null
    };
  }

  function exportJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function readAllFromStore(dbName, storeName) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const all = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            all.push(cursor.value);
            cursor.continue();
          } else {
            db.close();
            resolve(all);
          }
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  const dbName = 'bce-past-profiles';
  const storeName = 'profiles';

  // 2) Export raw data
  const raw = await readAllFromStore(dbName, storeName);
  //exportJson(raw, 'testprofiles.json');

  // 3) Extract + decode
  const simplified = raw.map(row => {
    let bundle = null;
    try {
      bundle = JSON.parse(row.characterBundle || '{}');
    } catch {
      bundle = null;
    }

    return {
      ...pickBasicInfo(row, bundle),
      ownership: bundle?.Ownership ?? null,
      lovership: bundle?.Lovership ?? null,
      descriptionDecoded: decodeDescription(bundle?.Description ?? ''),
      descriptionRaw: bundle?.Description ?? ''
    };
  });

  // 4) Export simplified data
  exportJson(simplified, 'testprofiles.extracted.json');

  console.log('Done: testprofiles.json and testprofiles.extracted.json');
})();