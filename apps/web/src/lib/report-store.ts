import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

type BlobModule = {
  put: (pathname: string, body: string, options: {
    access: "public";
    addRandomSuffix: boolean;
    contentType: string;
  }) => Promise<{ url: string }>;
  list: (options: { prefix: string; limit: number }) => Promise<{ blobs: Array<{ url: string; pathname: string }> }>;
};

async function loadBlob(): Promise<BlobModule | null> {
  try {
    const mod = await import("@vercel/blob");
    return mod as unknown as BlobModule;
  } catch {
    return null;
  }
}

function localDir(): string {
  return process.env.REPORT_STORE_DIR ?? path.join(process.cwd(), "data", "reports");
}

export async function putReport(hash: string, raw: string): Promise<void> {
  if (!HASH_RE.test(hash)) throw new Error("invalid report hash");
  const blob = process.env.BLOB_READ_WRITE_TOKEN ? await loadBlob() : null;
  if (blob) {
    await blob.put(`reports/${hash}.json`, raw, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${hash}.json`), raw, "utf8");
}

export async function getReport(hash: string): Promise<string | null> {
  if (!HASH_RE.test(hash)) return null;
  const blob = process.env.BLOB_READ_WRITE_TOKEN ? await loadBlob() : null;
  if (blob) {
    try {
      const { blobs } = await blob.list({ prefix: `reports/${hash}.json`, limit: 1 });
      if (blobs.length === 0) return null;
      const res = await fetch(blobs[0].url);
      if (!res.ok) return null;
      return res.text();
    } catch {
      return null;
    }
  }
  try {
    return await readFile(path.join(localDir(), `${hash}.json`), "utf8");
  } catch {
    return null;
  }
}