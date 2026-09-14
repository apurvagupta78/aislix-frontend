/**
 * Offline queue for Digital Audits — cache session + defer line/photo writes until online.
 */

import type { DigitalAuditSession, RcaCode } from "@/lib/digital-audit";

const DB_NAME = "aislix-audit-offline";
const DB_VERSION = 1;

type PendingLine = {
  id: string;
  lineId: string;
  actual_qty: number;
  rca_code?: RcaCode | null;
  rca_notes?: string | null;
  createdAt: string;
};

type PendingPhoto = {
  id: string;
  scanId: string;
  binKey: string;
  blob: Blob;
  fileName: string;
  createdAt: string;
};

type CachedSession = {
  assignmentId: string;
  session: DigitalAuditSession;
  cachedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "assignmentId" });
      }
      if (!db.objectStoreNames.contains("pendingLines")) {
        db.createObjectStore("pendingLines", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pendingPhotos")) {
        db.createObjectStore("pendingPhotos", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open offline storage."));
  });
}

function txStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("Offline storage error."));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("Offline transaction failed."));
      }),
  );
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function cacheAuditSession(assignmentId: string, session: DigitalAuditSession): Promise<void> {
  const row: CachedSession = {
    assignmentId,
    session,
    cachedAt: new Date().toISOString(),
  };
  await txStore("sessions", "readwrite", (s) => s.put(row));
}

export async function getCachedAuditSession(assignmentId: string): Promise<DigitalAuditSession | null> {
  const row = await txStore<CachedSession | undefined>("sessions", "readonly", (s) =>
    s.get(assignmentId),
  );
  return row?.session ?? null;
}

export async function queueLineUpdate(input: {
  lineId: string;
  actual_qty: number;
  rca_code?: RcaCode | null;
  rca_notes?: string | null;
}): Promise<void> {
  const row: PendingLine = {
    id: `${input.lineId}-${Date.now()}`,
    lineId: input.lineId,
    actual_qty: input.actual_qty,
    rca_code: input.rca_code ?? null,
    rca_notes: input.rca_notes ?? null,
    createdAt: new Date().toISOString(),
  };
  await txStore("pendingLines", "readwrite", (s) => s.put(row));
}

export async function queuePhotoUpload(input: {
  scanId: string;
  binKey: string;
  file: File;
}): Promise<void> {
  const row: PendingPhoto = {
    id: `${input.scanId}-${input.binKey}-${Date.now()}`,
    scanId: input.scanId,
    binKey: input.binKey,
    blob: input.file,
    fileName: input.file.name,
    createdAt: new Date().toISOString(),
  };
  await txStore("pendingPhotos", "readwrite", (s) => s.put(row));
}

export async function listPendingCounts(): Promise<{ lines: number; photos: number }> {
  const [lines, photos] = await Promise.all([
    txStore<PendingLine[]>("pendingLines", "readonly", (s) => s.getAll()),
    txStore<PendingPhoto[]>("pendingPhotos", "readonly", (s) => s.getAll()),
  ]);
  return { lines: lines.length, photos: photos.length };
}

export async function flushOfflineQueue(handlers: {
  updateLine: (input: {
    lineId: string;
    actual_qty: number;
    rca_code?: RcaCode | null;
    rca_notes?: string | null;
  }) => Promise<void>;
  uploadPhoto: (input: { scanId: string; binKey: string; file: File }) => Promise<void>;
}): Promise<{ syncedLines: number; syncedPhotos: number }> {
  const [lines, photos] = await Promise.all([
    txStore<PendingLine[]>("pendingLines", "readonly", (s) => s.getAll()),
    txStore<PendingPhoto[]>("pendingPhotos", "readonly", (s) => s.getAll()),
  ]);

  let syncedLines = 0;
  let syncedPhotos = 0;

  for (const row of lines.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    await handlers.updateLine({
      lineId: row.lineId,
      actual_qty: row.actual_qty,
      rca_code: row.rca_code,
      rca_notes: row.rca_notes,
    });
    await txStore("pendingLines", "readwrite", (s) => s.delete(row.id));
    syncedLines++;
  }

  for (const row of photos.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const file = new File([row.blob], row.fileName, { type: row.blob.type || "image/jpeg" });
    await handlers.uploadPhoto({ scanId: row.scanId, binKey: row.binKey, file });
    await txStore("pendingPhotos", "readwrite", (s) => s.delete(row.id));
    syncedPhotos++;
  }

  return { syncedLines, syncedPhotos };
}
