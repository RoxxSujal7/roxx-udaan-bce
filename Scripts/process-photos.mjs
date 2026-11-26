import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const IMPORT_DIR = path.join(ROOT, "_drive_import");
const PROCESSED_DIR = path.join(IMPORT_DIR, "_processed");
const SHEETS_DIR = path.join(IMPORT_DIR, "_sheets");
const GALLERY_DIR = path.join(ROOT, "Assets", "gallery");

const ALBUMS = [
  {
    id: "2",
    slug: "day-2",
    title: "Day 2",
    driveUrl: "https://drive.google.com/drive/folders/127F23uxuuTrDSSKu7E-r2Cpc7uIwoX8-",
    driveCount: 16,
    defaultDay: "Day 2",
  },
  {
    id: "3",
    slug: "day-3",
    title: "Day 3",
    driveUrl: "https://drive.google.com/drive/folders/1LAM5s6Bt3Z44x2aaRMm6rdFAYJvGsymN",
    driveCount: 25,
    defaultDay: "Day 3",
  },
  {
    id: "4",
    slug: "media-team",
    title: "Media team",
    driveUrl: "https://drive.google.com/drive/folders/1PRVhpjrJ0IEwPg_l6MHfTu2nNzxHEFum",
    driveCount: 386,
    defaultDay: null,
  },
  {
    id: "5",
    slug: "media-day-2",
    title: "Media day 2",
    driveUrl: "https://drive.google.com/drive/folders/1HYWPLuDDc_D2RyLIG1Sngrppy-BFqy7Yh",
    driveCount: 696,
    defaultDay: "Day 2",
  },
];

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) out.push(full);
    }
  }
  return out.sort();
}

function parseExifDay(exifBuf) {
  if (!exifBuf) return null;
  const text = exifBuf.toString("latin1");
  const m = text.match(/2026:11:(2[789]|30)/);
  if (!m) return null;
  const dayNum = Number(m[1]) - 26; // 27->1, 28->2, 29->3, 30->4
  return `Day ${dayNum}`;
}

async function computeMetrics(buf) {
  // 8x8 grayscale for average hash + 128px grayscale for brightness & sharpness
  const [{ data: hData }, { data: sData, info: sInfo }] = await Promise.all([
    sharp(buf).rotate().resize(8, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true }),
    sharp(buf).rotate().resize(128, 128, { fit: "inside" }).grayscale().raw().toBuffer({ resolveWithObject: true }),
  ]);

  // Average hash
  let sumH = 0;
  for (let i = 0; i < 64; i++) sumH += hData[i];
  const avgH = sumH / 64;
  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (hData[i] >= avgH) hash |= 1n << BigInt(i);
  }

  // Mean brightness & Laplacian variance
  const w = sInfo.width;
  const h = sInfo.height;
  let sum = 0;
  for (let i = 0; i < sData.length; i++) sum += sData[i];
  const mean = sum / sData.length;

  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        4 * sData[idx] -
        sData[idx - 1] -
        sData[idx + 1] -
        sData[idx - w] -
        sData[idx + w];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const lapMean = count ? lapSum / count : 0;
  const lapVar = count ? lapSq / count - lapMean * lapMean : 0;

  return { hash, mean, lapVar };
}

function hamming(a, b) {
  let x = a ^ b;
  let d = 0;
  while (x > 0n) {
    d += Number(x & 1n);
    x >>= 1n;
  }
  return d;
}

async function encodeWebpTarget(pipeline, maxBytes, qualities) {
  for (const q of qualities) {
    const out = await pipeline.clone().webp({ quality: q }).toBuffer();
    if (out.length <= maxBytes || q === qualities[qualities.length - 1]) {
      return out;
    }
  }
}

async function buildContactSheets(items, prefix) {
  const COLS = 5;
  const ROWS = 4;
  const CELL_W = 320;
  const CELL_H = 220;
  const LABEL_H = 28;
  const PER_SHEET = COLS * ROWS;
  const sheets = [];

  for (let i = 0; i < items.length; i += PER_SHEET) {
    const chunk = items.slice(i, i + PER_SHEET);
    const composites = [];
    for (let j = 0; j < chunk.length; j++) {
      const col = j % COLS;
      const row = Math.floor(j / COLS);
      const left = col * CELL_W;
      const top = row * (CELL_H + LABEL_H);

      const thumb = await sharp(chunk[j].thumbPath)
        .resize(CELL_W - 8, CELL_H - 8, { fit: "contain", background: "#141414" })
        .toBuffer();

      const svgLabel = Buffer.from(
        `<svg width="${CELL_W}" height="${LABEL_H}">
          <rect width="${CELL_W}" height="${LABEL_H}" fill="#1f1f23"/>
          <text x="10" y="19" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ff8a4c">${chunk[j].id}</text>
        </svg>`,
      );

      composites.push({ input: thumb, left: left + 4, top: top + 4 });
      composites.push({ input: svgLabel, left, top: top + CELL_H });
    }

    const sheetPath = path.join(SHEETS_DIR, `${prefix}-${Math.floor(i / PER_SHEET) + 1}.webp`);
    await sharp({
      create: {
        width: COLS * CELL_W,
        height: ROWS * (CELL_H + LABEL_H),
        channels: 3,
        background: "#0d0d0d",
      },
    })
      .composite(composites)
      .webp({ quality: 82 })
      .toFile(sheetPath);
    sheets.push(sheetPath);
  }
  return sheets;
}

async function main() {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.mkdirSync(SHEETS_DIR, { recursive: true });

  const seenHashes = [];
  const skipped = [];
  const photos = [];
  const albumSummaries = [];
  let totalInput = 0;
  let totalBytes = 0;

  for (const album of ALBUMS) {
    const srcDir = path.join(IMPORT_DIR, album.id);
    const files = walkFiles(srcDir);
    if (files.length === 0) {
      albumSummaries.push({ ...album, found: 0, kept: 0 });
      continue;
    }

    const outAlbumDir = path.join(PROCESSED_DIR, album.slug);
    fs.mkdirSync(outAlbumDir, { recursive: true });
    let kept = 0;

    for (let idx = 0; idx < files.length; idx++) {
      totalInput++;
      const file = files[idx];
      const baseName = `${album.slug}-${String(idx + 1).padStart(3, "0")}`;
      const id = `f${album.id}-${String(idx + 1).padStart(3, "0")}`;

      try {
        const inputBuf = fs.readFileSync(file);
        const meta = await sharp(inputBuf).metadata();
        const exifDay = parseExifDay(meta.exif);
        const { hash, mean, lapVar } = await computeMetrics(inputBuf);

        if (mean < 18) {
          skipped.push({ file: path.relative(ROOT, file), reason: `too dark (mean=${mean.toFixed(1)})` });
          continue;
        }
        if (lapVar < 20) {
          skipped.push({ file: path.relative(ROOT, file), reason: `blurry (lapVar=${lapVar.toFixed(1)})` });
          continue;
        }
        if (seenHashes.some((h) => hamming(h, hash) <= 3)) {
          skipped.push({ file: path.relative(ROOT, file), reason: "near-duplicate burst shot" });
          continue;
        }
        seenHashes.push(hash);

        const basePipe = sharp(inputBuf).rotate(); // strips EXIF/GPS by default
        const buf1600 = await encodeWebpTarget(
          basePipe.clone().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }),
          350 * 1024,
          [78, 68, 58],
        );
        const buf480 = await encodeWebpTarget(
          basePipe.clone().resize(480, 480, { fit: "inside", withoutEnlargement: true }),
          60 * 1024,
          [75, 65, 55],
        );

        const out1600 = path.join(outAlbumDir, `${baseName}-1600.webp`);
        const out480 = path.join(outAlbumDir, `${baseName}-480.webp`);
        fs.writeFileSync(out1600, buf1600);
        fs.writeFileSync(out480, buf480);

        const outMeta = await sharp(buf1600).metadata();
        totalBytes += buf1600.length + buf480.length;
        kept++;

        photos.push({
          id,
          album: album.slug,
          albumTitle: album.title,
          driveUrl: album.driveUrl,
          src1600: `Assets/archive/${album.slug}/${baseName}-1600.webp`,
          src480: `Assets/archive/${album.slug}/${baseName}-480.webp`,
          _proc1600: out1600,
          _proc480: out480,
          width: outMeta.width,
          height: outMeta.height,
          event: null,
          day: exifDay ?? album.defaultDay,
          alt: "",
          featured: false,
        });
      } catch (err) {
        skipped.push({ file: path.relative(ROOT, file), reason: `decode error: ${err.message}` });
      }
    }
    albumSummaries.push({ ...album, found: files.length, kept });
  }

  // Contact sheets for newly processed photos
  const driveSheets = await buildContactSheets(
    photos.map((p) => ({ id: p.id, thumbPath: p._proc480 })),
    "drive",
  );

  // Contact sheets for existing Assets/gallery/ photos
  const galleryFiles = walkFiles(GALLERY_DIR);
  const galleryItems = galleryFiles.map((f, i) => ({
    id: `gal-${String(i + 1).padStart(2, "0")}`,
    file: `Assets/gallery/${path.basename(f)}`,
    thumbPath: f,
  }));
  const gallerySheets = await buildContactSheets(galleryItems, "gallery");

  const manifestOut = {
    stats: {
      totalInput,
      totalKept: photos.length,
      totalSkipped: skipped.length,
      totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    },
    albums: albumSummaries,
    photos,
    galleryItems: galleryItems.map(({ id, file }) => ({ id, file })),
    skipped,
    sheets: { driveSheets, gallerySheets },
  };

  fs.writeFileSync(
    path.join(PROCESSED_DIR, "manifest.json"),
    JSON.stringify(manifestOut, null, 2),
  );
  console.log(JSON.stringify({ stats: manifestOut.stats, albums: albumSummaries, skippedCount: skipped.length, sheets: manifestOut.sheets }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
