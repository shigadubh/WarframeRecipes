/**
 * app.js — Controller Principal (OTIMIZADO)
 * Inicializa o app, vincula eventos com debounce,
 * gerencia login com Supabase e controla o boot.
 */

// ===== REFERÊNCIAS DOM =====
const el = {
    loadingScreen:     document.getElementById('loadingScreen'),
    loadingBar:        document.getElementById('loadingBar'),
    loadingStatus:     document.getElementById('loadingStatus'),
    loadingError:      document.getElementById('loadingError'),
    app:               document.getElementById('app'),
    loginModal:        document.getElementById('loginModal'),
    loginInput:        document.getElementById('loginInput'),
    pinSection:        document.getElementById('pinSection'),
    pinInput:          document.getElementById('pinInput'),
    pinHint:           document.getElementById('pinHint'),
    loginSubtitle:     document.getElementById('loginSubtitle'),
    btnLogin:          document.getElementById('btnLogin'),
    loginStatus:       document.getElementById('loginStatus'),
    userName:          document.getElementById('userName'),
    btnChangeUser:     document.getElementById('btnChangeUser'),
    apiStatusBadge:    document.getElementById('apiStatusBadge'),
    backupBadge:       document.getElementById('backupBadge'),
    syncBadge:         document.getElementById('syncBadge'),
    recipeSearch:      document.getElementById('recipeSearch'),
    categoryFilter:    document.getElementById('categoryFilter'),
    progressFilter:    document.getElementById('progressFilter'),
    recipesGrid:       document.getElementById('recipesGrid'),
    recipesStats:      document.getElementById('recipesStats'),
    inventorySearch:   document.getElementById('inventorySearch'),
    inventoryList:     document.getElementById('inventoryList'),
    inventoryStats:    document.getElementById('inventoryStats'),
    btnAddItem:        document.getElementById('btnAddItem'),
    addItemModal:      document.getElementById('addItemModal'),
    addItemSearch:     document.getElementById('addItemSearch'),
    addItemList:       document.getElementById('addItemList'),
    recipeDetailModal: document.getElementById('recipeDetailModal'),
    recipeDetailTitle: document.getElementById('recipeDetailTitle'),
    recipeDetailBody:  document.getElementById('recipeDetailBody'),
    btnImportExport:   document.getElementById('btnImportExport'),
    importExportModal: document.getElementById('importExportModal'),
    exportData:        document.getElementById('exportData'),
    importData:        document.getElementById('importData'),
    btnCopyExport:     document.getElementById('btnCopyExport'),
    btnImport:         document.getElementById('btnImport'),
    btnRefreshApi:     document.getElementById('btnRefreshApi'),
    btnForceSync:      document.getElementById('btnForceSync'),
    backupInfoSection: document.getElementById('backupInfoSection'),
    backupSlots:       document.getElementById('backupSlots'),
    toast:             document.getElementById('toast'),
};

// ===== INSTÂNCIA DO INVENTÁRIO =====
const inv = new InventoryManager();

// ===== TOAST =====
let toastTimeout = null;

function showToast(message, type = 'success') {
    el.toast.textContent = message;
    el.toast.className = `toast ${type}`;
    el.toast.classList.remove('hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        el.toast.classList.add('hidden');
    }, 2500);
}

// ===== UTILITÁRIOS GLOBAIS =====
function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function setProgress(percent, status) {
    el.loadingBar.style.width = percent + '%';
    el.loadingStatus.textContent = status;
}

function timeAgo(ts) {
    if (!ts) return 'Nunca';
    const d = Date.now() - ts;
    if (d < 60000)    return 'Agora';
    if (d < 3600000)  return `${Math.floor(d / 60000)}min atrás`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h atrás`;
    return new Date(ts).toLocaleString('pt-BR');
}

// ===== RENDER ALL (com invalidação de cache) =====
function renderAll() {
    invalidateProgressCache();
    renderRecipes();
    renderRecipeStats();
    renderInventory();
    renderInventoryStats();
    updateBackupBadge();
}

// ===== BADGES DE STATUS =====
function updateBackupBadge() {
    const ls = inv.getLastSave();
    el.backupBadge.className = 'backup-indicator ok';
    el.backupBadge.textContent = ls ? '💾 SALVO' : '⚠️';
    el.backupBadge.title = ls ? `Save local: ${timeAgo(ls)}` : 'Sem dados salvos';
}

function updateApiStatus() {
    if (!API_LOADED) {
        el.apiStatusBadge.className = 'api-status offline';
        el.apiStatusBadge.textContent = 'ERRO';
        return;
    }

    if (API_SOURCE === 'cache-expired') {
        el.apiStatusBadge.className = 'api-status offline';
        el.apiStatusBadge.textContent = 'OFFLINE';
    } else {
        el.apiStatusBadge.className = 'api-status online';
        el.apiStatusBadge.textContent = API_SOURCE === 'cache' ? 'CACHE ✓' : 'API ✓';
    }

    el.apiStatusBadge.title = `${RECIPES.length} receitas | ${ALL_COMPONENTS.length} componentes | via ${API_SOURCE}`;
}

function populateCategories() {
    const cats = WarframeAPI.getCategories(RECIPES);
    el.categoryFilter.innerHTML = '<option value="all">Todas Categorias</option>';
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        el.categoryFilter.appendChild(opt);
    });
}

// ============================================
// LOGIN COM SUPABASE
// ============================================

let loginCheckTimeout = null;

function setupLoginUsernameCheck() {
    el.loginInput.addEventListener('input', () => {
        clearTimeout(loginCheckTimeout);
        const username = el.loginInput.value.trim();

        // Esconde PIN até ter nome suficiente
        if (username.length < 2) {
            el.pinSection.style.display = 'none';
            el.loginSubtitle.textContent = 'Digite seu nome para entrar ou criar sua conta';
            return;
        }

        // Debounce: espera 500ms antes de checar no banco
        loginCheckTimeout = setTimeout(async () => {
            try {
                const { data } = await supabaseClient
                    .from('profiles')
                    .select('id, pin_hash')
                    .eq('username', username.toLowerCase().trim())
                    .maybeSingle();

                if (data) {
                    // Usuário existente
                    el.loginSubtitle.textContent = `Bem-vindo de volta, ${username}!`;
                    if (data.pin_hash) {
                        el.pinSection.style.display = 'block';
                        el.pinHint.textContent = 'Digite seu PIN para entrar';
                        el.pinInput.placeholder = 'PIN (4 dígitos)';
                    } else {
                        el.pinSection.style.display = 'none';
                    }
                } else {
                    // Novo usuário
                    el.loginSubtitle.textContent = `Criar conta para "${username}"`;
                    el.pinSection.style.display = 'block';
                    el.pinHint.textContent = 'Crie um PIN de 4 dígitos (opcional, mas recomendado)';
                    el.pinInput.placeholder = 'PIN novo (opcional)';
                }
            } catch (e) {
                // Sem conexão — login offline
                el.loginSubtitle.textContent = 'Modo offline — PIN não necessário';
                el.pinSection.style.display = 'none';
            }
        }, 500);
    });
}

async function handleLogin() {
    const username = el.loginInput.value.trim();
    if (!username || username.length < 2) {
        el.loginStatus.className = 'login-status error';
        el.loginStatus.textContent = 'Nome precisa ter pelo menos 2 caracteres';
        return;
    }

    const pin = el.pinInput ? el.pinInput.value.trim() : '';

    // Desabilita botão enquanto processa
    el.btnLogin.disabled = true;
    el.loginStatus.className = 'login-status loading';
    el.loginStatus.textContent = 'Conectando...';

    // 1. Carrega inventário local primeiro (resposta instantânea)
    inv.loadUser(username);
    el.userName.textContent = username.toUpperCase();

    // 2. Tenta sincronizar com Supabase
    if (navigator.onLine) {
        const result = await cloudSync.loginOrCreate(username, pin);

        if (!result.success) {
            el.loginStatus.className = 'login-status error';
            el.loginStatus.textContent = result.error || 'Erro ao conectar';
            el.btnLogin.disabled = false;
            return;
        }

        el.loginStatus.className = 'login-status success';
        el.loginStatus.textContent = result.isNew
            ? '✅ Conta criada! Dados sincronizados.'
            : '✅ Logado! Dados sincronizados.';
    } else {
        // Modo offline — usa dados locais
        el.loginStatus.className = 'login-status loading';
        el.loginStatus.textContent = '📴 Modo offline — dados locais carregados';
        setSyncStatus('offline', '📴 OFFLINE');
    }

    // 3. Fecha modal e renderiza
    setTimeout(() => {
        el.loginModal.classList.add('hidden');
        el.btnLogin.disabled = false;
        el.loginStatus.textContent = '';
        invalidateProgressCache();
        renderAll();
    }, 800);
}

// ============================================
// SETUP DE TODOS OS EVENTOS
// ============================================

function setupEvents() {

    // ----- LOGIN -----
    el.btnLogin.addEventListener('click', handleLogin);

    el.loginInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Se PIN está visível, foca nele primeiro
            if (el.pinSection.style.display !== 'none' && !el.pinInput.value) {
                el.pinInput.focus();
            } else {
                handleLogin();
            }
        }
    });

    if (el.pinInput) {
        el.pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Verificação do username (se já existe no banco)
    setupLoginUsernameCheck();

    // Trocar de usuário
    el.btnChangeUser.addEventListener('click', () => {
        // Salva e faz backup do usuário atual antes de trocar
        if (inv.currentUser) {
            inv.save();
            inv.createBackup();
            cloudSync.push();
        }

        cloudSync.logout();

        el.loginModal.classList.remove('hidden');
        el.loginInput.value = '';
        if (el.pinInput) el.pinInput.value = '';
        el.pinSection.style.display = 'none';
        el.loginStatus.textContent = '';
        el.loginSubtitle.textContent = 'Digite seu nome para entrar ou criar sua conta';

        setTimeout(() => el.loginInput.focus(), 100);
    });

    // ----- NAVEGAÇÃO POR TABS -----
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tab.dataset.tab}Tab`).classList.add('active');
        });
    });

    // ----- BUSCA DE RECEITAS (com debounce) -----
    setupRecipeSearchDebounce();

    // Filtros de categoria e progresso (ação deliberada, sem debounce)
    el.categoryFilter.addEventListener('change', () => {
        recipePage = 0;
        renderRecipes();
    });

    el.progressFilter.addEventListener('change', () => {
        recipePage = 0;
        renderRecipes();
    });

    // ----- BUSCA DO INVENTÁRIO (com debounce) -----
    let invSearchTimer = null;
    el.inventorySearch.addEventListener('input', () => {
        clearTimeout(invSearchTimer);
        invSearchTimer = setTimeout(renderInventory, 300);
    });

    // ----- MODAL ADICIONAR ITEM -----
    el.btnAddItem.addEventListener('click', () => {
        el.addItemModal.classList.remove('hidden');
        el.addItemSearch.value = '';
        renderAddItemList();
        setTimeout(() => el.addItemSearch.focus(), 100);
    });

    // Busca dentro do modal "Adicionar Item" (com debounce)
    let addSearchTimer = null;
    el.addItemSearch.addEventListener('input', () => {
        clearTimeout(addSearchTimer);
        addSearchTimer = setTimeout(renderAddItemList, 300);
    });

    // ----- IMPORT/EXPORT -----
    el.btnImportExport.addEventListener('click', () => {
        el.exportData.value = inv.exportData();
        el.importData.value = '';
        renderBackupInfo();
        el.importExportModal.classList.remove('hidden');
    });

    el.btnCopyExport.addEventListener('click', () => {
        el.exportData.select();
        navigator.clipboard.writeText(el.exportData.value)
            .then(() => showToast('Dados copiados!'))
            .catch(() => {
                document.execCommand('copy');
                showToast('Dados copiados!');
            });
    });

    el.btnImport.addEventListener('click', () => {
        const data = el.importData.value.trim();
        if (!data) {
            showToast('Cole seus dados antes de importar', 'error');
            return;
        }

        if (inv.importData(data)) {
            showToast('Importado e sincronizado com a nuvem!');
            el.importExportModal.classList.add('hidden');
            invalidateProgressCache();
            renderAll();
        } else {
            showToast('Formato inválido — verifique o JSON', 'error');
        }
    });

    // ----- ATUALIZAR RECEITAS DA API -----
    el.btnRefreshApi.addEventListener('click', async () => {
        showToast('Atualizando receitas da API...');

        el.loadingScreen.classList.remove('hidden');
        el.loadingScreen.style.opacity = '1';

        const success = await loadAPI(true);

        if (success) {
            populateCategories();
            invalidateProgressCache();
            renderAll();
            updateApiStatus();
            showToast(`${RECIPES.length} receitas atualizadas!`);
        } else {
            showToast('Falha ao atualizar', 'error');
        }

        el.loadingScreen.classList.add('hidden');
    });

    // ----- SYNC MANUAL COM NUVEM -----
    el.btnForceSync.addEventListener('click', async () => {
        if (!cloudSync.userId) {
            showToast('Faça login primeiro para sincronizar', 'error');
            return;
        }

        showToast('Sincronizando com a nuvem...');
        await cloudSync.push();
        showToast('Dados sincronizados!');
    });

    // ----- FECHAR MODAIS -----
    setupModalCloseHandlers();

    // ----- AUTO-BACKUP LOCAL (a cada 60s se houve mudança) -----
    setInterval(() => {
        if (inv.currentUser && inv.isDirty()) {
            inv.createBackup();
            updateBackupBadge();
            console.log('[Backup] Auto-backup local criado');
        }
    }, 60000);

    // ----- SALVA TUDO ANTES DE FECHAR A PÁGINA -----
    window.addEventListener('beforeunload', () => {
        if (inv.currentUser) {
            inv.save();
            if (inv.isDirty()) inv.createBackup();
            // Push síncrono não é garantido, mas tenta
            if (cloudSync.userId && navigator.onLine) {
                // Usa sendBeacon como fallback para garantir que o push sai
                try {
                    const payload = JSON.stringify({
                        inventory: inv.inventory,
                        crafted: inv.crafted
                    });
                    navigator.sendBeacon(
                        `${CONFIG.SUPABASE_URL}/rest/v1/rpc/heartbeat`,
                        payload
                    );
                } catch (e) { }
                // Tenta push normal também
                cloudSync.push();
            }
        }
    });

    // ----- ATALHOS DE TECLADO -----
    document.addEventListener('keydown', (e) => {
        // Ctrl+S = Forçar sync
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (inv.currentUser) {
                inv.save();
                inv.createBackup();
                cloudSync.push();
                showToast('Salvo e sincronizado! (Ctrl+S)');
            }
        }
    });
}

// ============================================
// BOOT SEQUENCE
// ============================================

async function boot() {
    setProgress(0, 'Inicializando...');

    // 1. Carrega receitas da API
    const apiOk = await loadAPI();

    if (!apiOk) {
        el.loadingError.style.display = 'block';
        el.loadingError.innerHTML = `
            <p>⚠️ Não foi possível carregar os dados do Warframe.</p>
            <p style="margin-top:8px;font-size:12px;color:var(--text-muted);">
                Verifique sua conexão e tente novamente.
            </p>
            <button onclick="location.reload()">TENTAR NOVAMENTE</button>`;
        return;
    }

    // 2. Popula filtros e status
    populateCategories();
    updateApiStatus();

    // 3. Vincula todos os eventos
    setupEvents();

    // 4. Verifica se tem sessão salva
    const savedCloudId = InventoryManager.getSavedCloudUserId();
    const lastUser = InventoryManager.getLastUser();

    if (savedCloudId && lastUser) {
        // Caso 1: Tem sessão na nuvem salva
        // Carrega dados locais instantaneamente
        inv.loadUser(lastUser);
        el.userName.textContent = lastUser.toUpperCase();

        // Mostra o app com dados locais (resposta imediata)
        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
            el.app.style.display = 'block';
            renderAll();
        }, 500);

        // Em background, tenta puxar dados mais recentes da nuvem
        cloudSync.resumeSession(savedCloudId).then(ok => {
            if (ok) {
                invalidateProgressCache();
                renderAll();
                showToast('Dados sincronizados da nuvem!');
            }
        });

    } else if (lastUser) {
        // Caso 2: Tem usuário local mas sem sync de nuvem
        // Carrega local e abre modal de login para conectar à nuvem
        inv.loadUser(lastUser);
        el.userName.textContent = lastUser.toUpperCase();
        el.loginInput.value = lastUser;

        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
            el.app.style.display = 'block';
            el.loginModal.classList.remove('hidden');
            renderAll();
        }, 500);

    } else {
        // Caso 3: Primeiro acesso — mostra login
        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
            el.app.style.display = 'block';
            el.loginModal.classList.remove('hidden');
            setTimeout(() => el.loginInput.focus(), 300);
        }, 500);
    }
}

// ===== INICIA O APP =====
boot();
