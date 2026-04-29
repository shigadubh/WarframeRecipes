/**
 * storage.js
 * Camada de persistência local: localStorage + IndexedDB
 * O localStorage é o cache rápido; o IndexedDB é o backup local robusto.
 */

class StorageManager {

    // ===== localStorage =====

    static setLS(key, value) {
        try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('[Storage] localStorage write failed:', e);
            return false;
        }
    }

    static getLS(key) {
        try { return localStorage.getItem(key); }
        catch (e) { return null; }
    }

    static removeLS(key) {
        try { localStorage.removeItem(key); } catch (e) { }
    }

    // ===== IndexedDB =====

    static _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('WFCraft4', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('data')) {
                    db.createObjectStore('data', { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    static async saveIDB(key, value) {
        try {
            const db = await this._openDB();
            const tx = db.transaction('data', 'readwrite');
            tx.objectStore('data').put({ key, value, ts: Date.now() });
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        } catch (e) {
            console.warn('[Storage] IndexedDB write failed:', e);
        }
    }

    static async loadIDB(key) {
        try {
            const db = await this._openDB();
            const tx = db.transaction('data', 'readonly');
            const req = tx.objectStore('data').get(key);
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result ? req.result.value : null);
                req.onerror = () => resolve(null);
            });
        } catch (e) { return null; }
    }
}