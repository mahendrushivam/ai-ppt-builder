const DATABASE_NAME = "ai-ppt-builder";
const DATABASE_VERSION = 1;
const IMAGES_STORE = "images";

/** Bytes rather than a Blob, because every browser can store an ArrayBuffer in IndexedDB. */
type StoredImage = { id: string; bytes: ArrayBuffer; type: string; createdAt: number };

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(IMAGES_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    // A later call tries again, e.g. after the user allows storage.
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

/** Stores an uploaded image under its upload id. */
export async function saveImage(id: string, blob: Blob, now: number = Date.now()): Promise<void> {
  const image: StoredImage = { id, bytes: await blob.arrayBuffer(), type: blob.type, createdAt: now };
  const database = await openDatabase();
  const transaction = database.transaction(IMAGES_STORE, "readwrite");
  transaction.objectStore(IMAGES_STORE).put(image);
  await transactionDone(transaction);
}

/** Reads an uploaded image, or `null` when this browser doesn't have it. */
export async function loadImage(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const request = database.transaction(IMAGES_STORE).objectStore(IMAGES_STORE).get(id);
  const image = await new Promise<StoredImage | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return image ? new Blob([image.bytes], { type: image.type }) : null;
}

/** Deletes images that no deck uses and that were stored before `createdBefore`. Returns how many were deleted. */
export async function deleteUnusedImages(usedIds: ReadonlySet<string>, createdBefore: number): Promise<number> {
  const database = await openDatabase();
  const transaction = database.transaction(IMAGES_STORE, "readwrite");
  const request = transaction.objectStore(IMAGES_STORE).openCursor();
  let deletedCount = 0;

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const image: StoredImage = cursor.value;
    if (!usedIds.has(image.id) && image.createdAt < createdBefore) {
      cursor.delete();
      deletedCount++;
    }
    cursor.continue();
  };

  await transactionDone(transaction);
  return deletedCount;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new DOMException("The transaction was aborted.", "AbortError"));
  });
}
