/**
 * sync.js
 * Sincronização com Supabase.
 * - Login/cadastro por username + PIN
 * - Push: envia inventário local para o banco
 * - Pull: busca dados do banco e sobrescreve o local
 * - Modo offline: funciona só com localStorage quando sem internet
 */

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

class CloudSync {

    constructor() {
        this.userId = null;
        this.isOnline = navigator.onLine;
        this.syncTimer = null;
        this.periodicTimer = null;
        this._setupConnectivityListeners();
    }

    // ===== Conectividade =====
    _setupConnectivityListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('[Sync] Online — sincronizando...');
            this.push();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('[Sync] Offline');
            setSyncStatus('offline', '📴 OFFLINE');
        });
    }

    // ===== Login/Cadastro =====
    async loginOrCreate(username, pin) {
        setSyncStatus('syncing', '⏳ ENTRANDO');

        try {
            // Busca usuário existente
            const { data: existing } = await supabaseClient
                .from('profiles')
                .select('id, username, pin_hash')
                .eq('username', username.toLowerCase().trim())
                .maybeSingle();

            if (existing) {
                // Usuário existe — valida PIN se tiver
                if (existing.pin_hash && existing.pin_hash !== this._hashPin(pin)) {
                    setSyncStatus('error', '❌ ERRO');
                    return { success: false, error: 'PIN incorreto' };
                }

                this.userId = existing.id;
                StorageManager.setLS('wf_cloud_user_id', existing.id);
                StorageManager.setLS('wf_last_user', username.toLowerCase().trim());

                // Puxa dados da nuvem
                await this.pull();
                this._startPeriodicSync();
                setSyncStatus('synced', '☁️ SYNC ✓');
                return { success: true, isNew: false };

            } else {
                // Novo usuário — cria perfil
                const { data: newProfile, error } = await supabaseClient
                    .from('profiles')
                    .insert({
                        username: username.toLowerCase().trim(),
                        pin_hash: pin ? this._hashPin(pin) : null
                    })
                    .select()
                    .single();

                if (error) {
                    setSyncStatus('error', '❌ ERRO');
                    return { success: false, error: error.message };
                }

                this.userId = newProfile.id;
                StorageManager.setLS('wf_cloud_user_id', newProfile.id);
                StorageManager.setLS('wf_last_user', username.toLowerCase().trim());

                this._startPeriodicSync();
                setSyncStatus('synced', '☁️ SYNC ✓');
                return { success: true, isNew: true };
            }
        } catch (e) {
            console.error('[Sync] Login error:', e);
            setSyncStatus('error', '❌ SEM CONEXÃO');
            return { success: false, error: 'Sem conexão com o servidor' };
        }
    }

    // Login rápido usando ID salvo (retorno do usuário)
    async resumeSession(userId) {
        this.userId = userId;
        try {
            const { data } = await supabaseClient
                .from('profiles')
                .select('id, username')
                .eq('id', userId)
                .maybeSingle();

            if (data) {
                await this.pull();
                this._startPeriodicSync();
                setSyncStatus('synced', '☁️ SYNC ✓');
                return true;
            }
        } catch (e) {
            console.warn('[Sync] Resume failed, going offline:', e);
            setSyncStatus('offline', '📴 LOCAL');
        }
        return false;
    }

    // ===== PUSH: Local → Supabase =====
    async push() {
        if (!this.userId || !this.isOnline) return;
        setSyncStatus('syncing', '⏳ SYNC');

        try {
            const inventory = inv ? inv.inventory : {};
            const crafted = inv ? inv.crafted : {};

            // Monta array de itens do inventário
            const inventoryRows = Object.entries(inventory)
                .filter(([_, qty]) => qty > 0)
                .map(([componentId, quantity]) => ({
                    user_id: this.userId,
                    component_id: componentId,
                    quantity
                }));

            // Monta array de fabricados
            const craftedRows = Object.entries(crafted)
                .map(([recipeName, ts]) => ({
                    user_id: this.userId,
                    recipe_name: recipeName,
                    crafted_at: new Date(ts).toISOString()
                }));

            // Envia inventário (upsert)
            if (inventoryRows.length > 0) {
                const { error: invError } = await supabaseClient
                    .from('inventory_items')
                    .upsert(inventoryRows, { onConflict: 'user_id,component_id' });
                if (invError) throw invError;
            }

            // Remove itens que foram zerados/deletados
            const activeIds = Object.keys(inventory).filter(k => inventory[k] > 0);
            if (activeIds.length > 0) {
                await supabaseClient
                    .from('inventory_items')
                    .delete()
                    .eq('user_id', this.userId)
                    .not('component_id', 'in', `(${activeIds.map(id => `"${id.replace(/"/g, '\\"')}"`).join(',')})`);
            } else {
                // Limpa tudo se inventário está vazio
                await supabaseClient
                    .from('inventory_items')
                    .delete()
                    .eq('user_id', this.userId);
            }

            // Envia fabricados
            if (craftedRows.length > 0) {
                const { error: craftError } = await supabaseClient
                    .from('crafted_items')
                    .upsert(craftedRows, { onConflict: 'user_id,recipe_name' });
                if (craftError) throw craftError;
            }

            // Remove fabricados que foram desmarcados
            const activeRecipes = Object.keys(crafted);
            if (activeRecipes.length > 0) {
                await supabaseClient
                    .from('crafted_items')
                    .delete()
                    .eq('user_id', this.userId)
                    .not('recipe_name', 'in', `(${activeRecipes.map(r => `"${r.replace(/"/g, '\\"')}"`).join(',')})`);
            } else {
                await supabaseClient
                    .from('crafted_items')
                    .delete()
                    .eq('user_id', this.userId);
            }

            StorageManager.setLS('wf_last_sync', Date.now().toString());
            setSyncStatus('synced', '☁️ SYNC ✓');
            console.log('[Sync] Push OK');

        } catch (e) {
            console.error('[Sync] Push failed:', e);
            setSyncStatus('error', '❌ SYNC FALHOU');
        }
    }

    // ===== PULL: Supabase → Local =====
    async pull() {
        if (!this.userId) return;

        try {
            const [invResult, craftedResult] = await Promise.all([
                supabaseClient
                    .from('inventory_items')
                    .select('component_id, quantity')
                    .eq('user_id', this.userId),
                supabaseClient
                    .from('crafted_items')
                    .select('recipe_name, crafted_at')
                    .eq('user_id', this.userId)
            ]);

            if (invResult.error) throw invResult.error;
            if (craftedResult.error) throw craftedResult.error;

            // Reconstrói objetos
            const newInventory = {};
            (invResult.data || []).forEach(row => {
                newInventory[row.component_id] = row.quantity;
            });

            const newCrafted = {};
            (craftedResult.data || []).forEach(row => {
                newCrafted[row.recipe_name] = new Date(row.crafted_at).getTime();
            });

            // Atualiza inventário local
            if (inv) {
                inv.inventory = newInventory;
                inv.crafted = newCrafted;
                inv.save();
            }

            console.log(`[Sync] Pull OK — ${Object.keys(newInventory).length} itens, ${Object.keys(newCrafted).length} fabricados`);

        } catch (e) {
            console.error('[Sync] Pull failed:', e);
        }
    }

    // ===== Sync com debounce (dispara após inatividade) =====
    schedulePush() {
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.push(), CONFIG.SYNC_DEBOUNCE_MS);
    }

    // ===== Sync periódico =====
    _startPeriodicSync() {
        clearInterval(this.periodicTimer);
        this.periodicTimer = setInterval(() => {
            if (this.isOnline) this.push();
        }, CONFIG.SYNC_INTERVAL_MS);
    }

    // ===== Utilitários =====
    _hashPin(pin) {
        // Hash simples (não use em sistemas críticos; para segurança real, use bcrypt no backend)
        if (!pin) return null;
        let hash = 0;
        const str = pin + 'wf_salt_2024';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    getLastSyncTime() {
        const t = StorageManager.getLS('wf_last_sync');
        return t ? parseInt(t) : null;
    }

    logout() {
        this.userId = null;
        clearInterval(this.periodicTimer);
        clearTimeout(this.syncTimer);
        StorageManager.removeLS('wf_cloud_user_id');
        setSyncStatus('idle', '☁️ SYNC');
    }
}

// ===== Instância global =====
const cloudSync = new CloudSync();

// ===== Helper para atualizar o badge de sync =====
function setSyncStatus(state, text) {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    badge.className = `sync-badge ${state}`;
    badge.textContent = text;
    badge.title = `Último sync: ${timeAgo(cloudSync.getLastSyncTime())}`;
}