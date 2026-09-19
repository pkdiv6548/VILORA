// Storage Module: LocalStorage and IndexedDB support for local files and settings
const STORAGE_PREFIX = "musiq_";

export class StorageService {
  constructor() {
    this.dbName = "MusiqLibraryDB";
    this.dbVersion = 1;
    this.db = null;
    this.initIndexedDB();
  }

  // LocalStorage wrappers
  getItem(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.warn("Storage getItem error", e);
      return defaultValue;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Storage setItem error", e);
      return false;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      console.warn("Storage removeItem error", e);
    }
  }

  // IndexedDB for storing offline local audio blob buffers
  initIndexedDB() {
    this.ensureDb();
  }

  ensureDb() {
    if (this.db) return Promise.resolve(this.db);
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("audioBlobs")) {
            db.createObjectStore("audioBlobs", { keyPath: "id" });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = (e) => {
          console.warn("IndexedDB open error", e);
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB init exception", err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async saveAudioBlob(id, blob, metadata) {
    const db = await this.ensureDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction("audioBlobs", "readwrite");
        const store = tx.objectStore("audioBlobs");
        store.put({ id, blob, metadata, timestamp: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async getAudioBlob(id) {
    const db = await this.ensureDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction("audioBlobs", "readonly");
        const store = tx.objectStore("audioBlobs");
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async getAllAudioRecords() {
    const db = await this.ensureDb();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction("audioBlobs", "readonly");
        const store = tx.objectStore("audioBlobs");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async deleteAudioBlob(id) {
    const db = await this.ensureDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction("audioBlobs", "readwrite");
        const store = tx.objectStore("audioBlobs");
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
}

export const storage = new StorageService();
