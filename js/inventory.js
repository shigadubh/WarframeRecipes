/**
 * inventory.js
 * Gerencia inventário local com Supabase sync
 */

class InventoryManager {

    constructor() {
        this.currentUser = null;
        this.inventory = {};
        this.crafted = {};
        this._dirty = false;
        this._lastHash = '';
    }

    // ===== Métodos estáticos =====
    static getLastUser() {
        try { return localStorage.getItem('wf_last_user'); }
        catch (e) { return null; }
    }

    static getSavedCloudUserId() {
        try { return localStorage.getItem('wf_cloud_user_id'); }
        catch (e) { return null; }
    }

    // ===== Chaves de storage =====
    _key() { return `wf_inv4_${this.currentUser}`; }
    _craftedKey() { return `wf_crafted4_${this.currentUser}`; }
    _bkKey(slot) { return `wf_bk4_${this.currentUser}_${slot}`; }
    _hash() { return JSON.stringify(this.inventory) + JSON.stringify(this.crafted); }

    // ===== Carregar usuário =====
    loadUser(username) {
        this.currentUser = username.toLowerCase().trim();

        let d = StorageManager.getLS(this._key());
        try { this.inventory = d ? JSON.parse(d) : {}; }
        catch (e) { this.inventory = {}; }

        d = StorageManager.getLS(this._craftedKey());
        try { this.crafted = d ? JSON.parse(d) : {}; }
        catch (e) { this.crafted = {}; }

        if (!Object.keys(this.inventory).length) this._recoverIDB();

        StorageManager.setLS('wf_last_user', this.currentUser);
        this._lastHash = this._hash();
        this._dirty = false;
    }

    async _recoverIDB() {
        const data = await StorageManager.loadIDB(`inv4_${this.currentUser}`);
        if (data && data.inventory && Object.keys(data.inventory).length) {
            this.inventory = data.inventory;
            this.crafted = data.crafted || {};
            this.save();
        }
    }

    // ===== Salvar =====
    save() {
        if (!this.currentUser) return;
        StorageManager.setLS(this._key(), JSON.stringify(this.inventory));
        StorageManager.setLS(this._craftedKey(), JSON.stringify(this.crafted));
        StorageManager.saveIDB(`inv4_${this.currentUser}`, {
            inventory: this.inventory,
            crafted: this.crafted
        });
        const h = this._hash();
        if (h !== this._lastHash) {
            this._dirty = true;
            this._lastHash = h;
        }
        StorageManager.setLS(`wf_lastsave_${this.currentUser}`, Date.now().toString());
    }

    getLastSave() {
        const t = StorageManager.getLS(`wf_lastsave_${this.currentUser}`);
        return t ? parseInt(t) : null;
    }

    isDirty() { return this._dirty; }

    // ===== Backups locais =====
    createBackup() {
        if (!this.currentUser) return;
        const bd = JSON.stringify({
            inventory: this.inventory,
            crafted: this.crafted,
            ts: Date.now(),
            count: Object.keys(this.inventory).length
        });
        for (let i = CONFIG.MAX_LOCAL_BACKUPS - 1; i > 0; i--) {
            const prev = StorageManager.getLS(this._bkKey(i - 1));
            if (prev) StorageManager.setLS(this._bkKey(i), prev);
        }
        StorageManager.setLS(this._bkKey(0), bd);
        this._dirty = false;
    }

    getBackups() {
        const backups = [];
        for (let i = 0; i < CONFIG.MAX_LOCAL_BACKUPS; i++) {
            const d = StorageManager.getLS(this._bkKey(i));
            if (d) {
                try {
                    const p = JSON.parse(d);
                    p.slot = i;
                    backups.push(p);
                } catch (e) { }
            }
        }
        return backups;
    }

    restoreBackup(slot) {
        const d = StorageManager.getLS(this._bkKey(slot));
        if (!d) return false;
        try {
            const p = JSON.parse(d);
            if (p.inventory) {
                this.createBackup();
                this.inventory = p.inventory;
                this.crafted = p.crafted || {};
                this.save();
                if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
                return true;
            }
        } catch (e) { }
        return false;
    }

    // ===== Import/Export =====
    exportData() {
        return JSON.stringify({
            user: this.currentUser,
            inventory: this.inventory,
            crafted: this.crafted,
            count: Object.keys(this.inventory).length,
            date: new Date().toISOString(),
            version: 4
        }, null, 2);
    }

    importData(json) {
        try {
            const data = JSON.parse(json);
            if (data.inventory && typeof data.inventory === 'object') {
                this.createBackup();
                this.inventory = data.inventory;
                this.crafted = data.crafted || {};
                this.save();
                if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
                return true;
            }
        } catch (e) { }
        return false;
    }

    // ===== CRUD =====
    hasItem(id) { return (this.inventory[id] || 0) > 0; }
    getQty(id) { return this.inventory[id] || 0; }

    addItem(id, qty = 1) {
        this.inventory[id] = (this.inventory[id] || 0) + qty;
        this.save();
        if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
    }

    removeItem(id) {
        delete this.inventory[id];
        this.save();
        if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
    }

    setQty(id, qty) {
        if (qty <= 0) delete this.inventory[id];
        else this.inventory[id] = qty;
        this.save();
        if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
    }

    getAllItems() {
        return Object.entries(this.inventory)
            .filter(([_, q]) => q > 0)
            .map(([id, quantity]) => ({ id, quantity }))
            .sort((a, b) => {
                const da = COMP_MAP[a.id]?.displayName || a.id;
                const db = COMP_MAP[b.id]?.displayName || b.id;
                return da.localeCompare(db);
            });
    }

    // ===== Estado de fabricação =====
    isCrafted(name) { return !!this.crafted[name]; }
    getCraftedTime(name) { return this.crafted[name] || null; }

    setCrafted(name) {
        this.crafted[name] = Date.now();
        this.save();
        if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
    }

    unsetCrafted(name) {
        delete this.crafted[name];
        this.save();
        if (typeof cloudSync !== 'undefined') cloudSync.schedulePush();
    }

    // ===== Progresso da receita =====
    getRecipeProgress(recipe) {
        const total = recipe.components.length;
        let owned = 0;
        const details = recipe.components.map(comp => {
            const hasQty = this.getQty(comp.id);
            const needed = comp.requiredQty || 1;
            const hasEnough = hasQty >= needed;
            if (hasEnough) owned++;
            return {
                id: comp.id,
                displayName: comp.displayName,
                rawName: comp.rawName,
                requiredQty: needed,
                owned: hasEnough,
                quantity: hasQty
            };
        });
        const canCraft = details.every(d => d.quantity >= d.requiredQty);
        let maxCrafts = 0;
        if (canCraft) {
            maxCrafts = Math.min(...details.map(d => Math.floor(d.quantity / d.requiredQty)));
        }
        return {
            total, owned, details,
            percentage: total > 0 ? (owned / total) * 100 : 0,
            canCraft, maxCrafts
        };
    }

    // ===== Ações de fabricação =====
    craftRecipe(recipe) {
        const progress = this.getRecipeProgress(recipe);
        if (!progress.canCraft) return false;
        recipe.components.forEach(comp => {
            const current = this.getQty(comp.id);
            const needed = comp.requiredQty || 1;
            this.setQty(comp.id, current - needed);
        });
        this.setCrafted(recipe.name);
        return true;
    }

    uncraftRecipe(recipe) {
        recipe.components.forEach(comp => {
            const needed = comp.requiredQty || 1;
            this.addItem(comp.id, needed);
        });
        this.unsetCrafted(recipe.name);
        return true;
    }

    findRecipesUsing(compId) {
        return RECIPES.filter(r => r.components.some(c => c.id === compId));
    }
}
