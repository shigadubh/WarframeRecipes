class StorageManager {
    static setLS(key, value) {
        try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return true; }
        catch (e) { return false; }
    }
    static getLS(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    static removeLS(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }
    static _openDB() {
        return new Promise((res, rej) => {
            const r = indexedDB.open('WFCraft4', 1);
            r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'key' }); };
            r.onsuccess = e => res(e.target.result);
            r.onerror = e => rej(e.target.error);
        });
    }
    static async saveIDB(key, value) {
        try { const db = await this._openDB(); const tx = db.transaction('data','readwrite'); tx.objectStore('data').put({key,value,ts:Date.now()}); await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;}); } catch(e){}
    }
    static async loadIDB(key) {
        try { const db = await this._openDB(); const tx = db.transaction('data','readonly'); const req = tx.objectStore('data').get(key); return new Promise(r=>{req.onsuccess=()=>r(req.result?req.result.value:null);req.onerror=()=>r(null);}); } catch(e){ return null; }
    }
}
