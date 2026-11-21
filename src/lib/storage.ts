import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat, statfs, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";

// Runtime uploads live outside public/ (Next only serves public/ files present at build time).
// "public" = product photos served by /api/uploads, "private" = quote attachments, owner-only.
export type Bucket = "public" | "private";

const root = path.join(process.cwd(), "storage");
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PRIVATE_BYTES = 1024 * 1024 * 1024; // 1 GiB cap on unauthenticated quote attachments
const MAX_PRIVATE_FILES = 5000;
const MIN_FREE_DISK_BYTES = 100 * 1024 * 1024; // leave at least 100 MiB free on disk

export class InvalidUploadError extends Error {
  constructor(message = "Invalid upload") {
    super(message);
    this.name = "InvalidUploadError";
  }
}

export class UploadQuotaError extends Error {
  constructor(message = "Upload storage quota reached") {
    super(message);
    this.name = "UploadQuotaError";
  }
}

export const allowedExtensions: Record<Bucket, string[]> = {
  public: [".jpg", ".jpeg", ".png", ".webp"],
  private: [".pdf", ".dxf", ".dwg", ".step", ".stp", ".jpg", ".jpeg", ".png", ".webp"],
};

export const contentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const RASTER_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/** Returns true when the uploaded file's size and extension can be accepted for this bucket. */
export function isAcceptable(file: File, bucket: Bucket) {
  const ext = path.extname(file.name).toLowerCase();
  return file.size > 0 && file.size <= MAX_BYTES && allowedExtensions[bucket].includes(ext);
}

function hasValidMagicSignature(buf: Buffer, ext: string): boolean {
  if (ext === ".jpg" || ext === ".jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === ".png") {
    return buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (ext === ".webp") {
    return buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (ext === ".pdf") {
    const head = buf.subarray(0, 16).toString("latin1");
    const idx = head.indexOf("%PDF-");
    return idx >= 0 && idx <= 8;
  }
  if (ext === ".dwg") {
    return buf.length >= 6 && /^AC1[0-9.]/.test(buf.subarray(0, 6).toString("ascii"));
  }
  if (ext === ".dxf") {
    if (buf.subarray(0, 18).toString("ascii") === "AutoCAD Binary DXF") return true;
    const sample = buf.subarray(0, 8192);
    if (sample.includes(0)) return false;
    return /\b(SECTION|HEADER|TABLES|BLOCKS|ENTITIES|EOF)\b/.test(sample.toString("utf8"));
  }
  if (ext === ".step" || ext === ".stp") {
    const sample = buf.subarray(0, 4096);
    if (sample.includes(0)) return false;
    return /^\s*ISO-10303-21;/i.test(sample.toString("utf8").replace(/^\uFEFF/, ""));
  }
  return false;
}

const PUBLIC_MAX_DIMENSION = 1600;
const PRIVATE_QUOTA_TTL_MS = 5 * 60_000;

let privateQuotaCache: { count: number; bytes: number; syncedAt: number } | null = null;

/** Validates image pixels via sharp, auto-orients, resizes oversized public assets, and strips EXIF/XMP/GPS metadata. */
async function sanitizeRasterImage(buf: Buffer, ext: string, bucket: Bucket): Promise<Buffer | null> {
  try {
    let pipeline = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
    if (bucket === "public") {
      pipeline = pipeline.resize({
        width: PUBLIC_MAX_DIMENSION,
        height: PUBLIC_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    if (ext === ".png") return await pipeline.png().toBuffer();
    if (ext === ".webp") return await pipeline.webp({ quality: 88 }).toBuffer();
    return await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}

async function getPrivateQuota(dir: string): Promise<{ count: number; bytes: number }> {
  const now = Date.now();
  if (privateQuotaCache && now - privateQuotaCache.syncedAt < PRIVATE_QUOTA_TTL_MS) {
    return { count: privateQuotaCache.count, bytes: privateQuotaCache.bytes };
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const stats = await Promise.all(fileNames.map((name) => stat(path.join(dir, name)).catch(() => null)));
  let bytes = 0;
  for (const s of stats) {
    if (s) bytes += s.size;
  }
  privateQuotaCache = { count: entries.length, bytes, syncedAt: now };
  return { count: entries.length, bytes };
}

async function ensurePrivateQuota(dir: string, incomingBytes: number) {
  const fsStats = await statfs(dir).catch(() => null);
  if (fsStats) {
    const freeBytes = Number(fsStats.bavail) * Number(fsStats.bsize);
    if (freeBytes < incomingBytes + MIN_FREE_DISK_BYTES) {
      throw new UploadQuotaError("Insufficient free disk space");
    }
  }
  const quota = await getPrivateQuota(dir);
  if (quota.count >= MAX_PRIVATE_FILES) {
    throw new UploadQuotaError("Private upload file limit reached");
  }
  if (quota.bytes + incomingBytes > MAX_PRIVATE_BYTES) {
    throw new UploadQuotaError("Private upload storage cap reached");
  }
}

export async function saveUpload(file: File, bucket: Bucket) {
  const ext = path.extname(file.name).toLowerCase();
  if (!isAcceptable(file, bucket)) throw new InvalidUploadError("Disallowed file size or extension");

  const raw = Buffer.from(await file.arrayBuffer());
  if (raw.length === 0 || raw.length > MAX_BYTES || !hasValidMagicSignature(raw, ext)) {
    throw new InvalidUploadError("Invalid file signature");
  }

  let output: Buffer = raw;
  if (RASTER_EXTS.has(ext)) {
    const clean = await sanitizeRasterImage(raw, ext, bucket);
    if (!clean || clean.length === 0) throw new InvalidUploadError("Invalid raster image");
    output = clean;
  }

  const stored = `${randomUUID()}${ext}`;
  const dir = path.join(root, bucket);
  await mkdir(dir, { recursive: true });
  if (bucket === "private") await ensurePrivateQuota(dir, output.length);

  await writeFile(path.join(dir, stored), output, { flag: "wx" });
  if (bucket === "private" && privateQuotaCache) {
    privateQuotaCache.count += 1;
    privateQuotaCache.bytes += output.length;
  }
  return stored;
}

// Stored names are always "<uuid>.<ext>"; anything else is rejected to prevent path traversal.
const storedName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

export async function readUpload(name: string, bucket: Bucket) {
  if (!storedName.test(name) || !allowedExtensions[bucket].includes(path.extname(name))) return null;
  try {
    return await readFile(path.join(root, bucket, name));
  } catch {
    return null;
  }
}

/** Opens a stored file as a Web ReadableStream with size and ETag metadata (avoids buffering entire files in RAM). */
export async function openUploadStream(
  name: string,
  bucket: Bucket,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number; etag: string } | null> {
  if (!storedName.test(name) || !allowedExtensions[bucket].includes(path.extname(name))) return null;
  const filePath = path.join(root, bucket, name);
  const info = await stat(filePath).catch(() => null);
  if (!info || !info.isFile()) return null;
  const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return { stream, size: info.size, etag };
}

export async function deleteUpload(name: string | null | undefined, bucket: Bucket) {
  if (!name || !storedName.test(name) || !allowedExtensions[bucket].includes(path.extname(name))) return;
  await unlink(path.join(root, bucket, name)).catch(() => {});
  if (bucket === "private") privateQuotaCache = null;
}
