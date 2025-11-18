// F0 Phase 35 - Offline Storage & Queue Management

import type { QueueItem } from './types';

/**
 * LocalStorage-based queue (fallback)
 */
export class LocalQueue {
  private key: string;

  constructor(deviceId: string) {
    this.key = `f0_queue_${deviceId}`;
  }

  async enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<void> {
    const queue = await this.getAll();
    const newItem: QueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
    };
    queue.push(newItem);
    localStorage.setItem(this.key, JSON.stringify(queue));
  }

  async dequeue(): Promise<QueueItem | null> {
    const queue = await this.getAll();
    if (queue.length === 0) return null;
    const item = queue.shift()!;
    localStorage.setItem(this.key, JSON.stringify(queue));
    return item;
  }

  async getAll(): Promise<QueueItem[]> {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }

  async size(): Promise<number> {
    const queue = await this.getAll();
    return queue.length;
  }
}

/**
 * IndexedDB-based queue (preferred for larger data)
 */
export class IndexedDBQueue {
  private dbName = 'f0_sync';
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(deviceId: string) {
    this.storeName = `queue_${deviceId}`;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<void> {
    if (!this.db) await this.init();

    const newItem: QueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.add(newItem);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async dequeue(): Promise<QueueItem | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('createdAt');
      const request = index.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(null);
          return;
        }

        const item = cursor.value as QueueItem;
        cursor.delete();
        resolve(item);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<QueueItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async size(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Queue factory - uses IndexedDB if available, falls back to LocalStorage
 */
export async function createQueue(deviceId: string) {
  if (typeof indexedDB !== 'undefined') {
    const queue = new IndexedDBQueue(deviceId);
    try {
      await queue.init();
      return queue;
    } catch (error) {
      console.warn('IndexedDB unavailable, falling back to LocalStorage', error);
    }
  }

  return new LocalQueue(deviceId);
}


