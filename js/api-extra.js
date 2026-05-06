/**
 * api-extra.js
 * Carrega receitas extras da API WarframeStat.us em background
 * Usa cache de 30 dias para evitar downloads repetidos
 */

const EXTRA_CONFIG = {
    CACHE_KEY: 'wf_extra_recipes_v1',
    CACHE_TIME_KEY: 'wf_extra_recipes_time_v1',
    CACHE_TTL: 30 * 24 * 60 * 60 * 1000, // 30 dias
    REQUEST_TIMEOUT: 15000,
    ENDPOINTS: [
        { url: 'https://api.warframestat.us/warframes', label: 'Warframes' },
        { url: 'https://api.warframestat.us/weapons', label: 'Armas' }
    ]
};

let EXTRA_LOADED = false;
let EXTRA_LOADING = false;
let EXTRA_PROGRESS = 0; // 0-100

// ============================================
// CACHE
// ============================================
function getCachedExtraRecipes() {
    try {
        const cached = StorageManager.getLS(EXTRA_CONFIG.CACHE_KEY);
        const time = StorageManager.getLS(EXTRA_CONFIG.CACHE_TIME_KEY);
        if (cached && time) {
            const age = Date.now() - parseInt(time);
            if (age < EXTRA_CONFIG.CACHE_TTL) {
                return JSON.parse(cached);
            }
        }
    } catch (e) {
        console.warn('[Extra] Cache leitura falhou:', e);
    }
    return null;
}

function saveCachedExtraRecipes(recipes) {
    try {
        StorageManager.setLS(EXTRA_CONFIG.CACHE_KEY, JSON.stringify(recipes));
        StorageManager.setLS(EXTRA_CONFIG.CACHE_TIME_KEY, Date.now().toString());
        console.log(`[Extra] Cache salvo: ${recipes.length} receitas`);
    } catch (e) {
        console.warn('[Extra] Cache salvar falhou:', e);
    }
}

// ============================================
// FETCH COM TIMEOUT
// ============================================
async function fetchExtraWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

// ============================================
// MAPEAR CATEGORIA
// ============================================
function mapExtraCategory(item) {
    const c = (item.category || '').toLowerCase();
    const t = (item.type || '').toLowerCase();
    const n = item.name || '';
    const p = n.includes('Prime');

    if (c === 'warframes' || t === 'warframe') return p ? 'Warframe Prime' : 'Warframe';
    if (c === 'primary' || t === 'primary') return p ? 'Arma Primária Prime' : 'Arma Primária';
    if (c === 'secondary' || t === 'secondary') return p ? 'Arma Secundária Prime' : 'Arma Secundária';
    if (c === 'melee' || t === 'melee') return p ? 'Corpo a Corpo Prime' : 'Corpo a Corpo';
    if (c === 'sentinels' || t === 'sentinel') return p ? 'Sentinela Prime' : 'Sentinela';
    if (c === 'archwing' || t === 'archwing') return p ? 'Archwing Prime' : 'Archwing';
    if (c === 'pets' || t === 'pet') return 'Companheiro';
    if (c === 'necramechs') return 'Necramech';
    if (t === 'arch-gun') return 'Arch-Gun';
    if (t === 'arch-melee') return 'Arch-Melee';
    return 'Outro';
}

function isExtraGenericResource(name) {
    const l = name.toLowerCase();
    const skip = new Set([
        'credits','orokin cell','neurodes','morphics','control module','gallium',
        'neural sensors','neurode','plastids','polymer bundle','rubedo','salvage',
        'ferrite','nano spores','alloy plate','circuits','oxium','cryotic',
        'argon crystal','tellurium','nitain extract','forma','kuva','void traces',
        'detonite injector','fieldron','mutagen mass','pherliac pod','thermia'
    ]);
    return skip.has(l);
}

// ============================================
// PARSE
// ============================================
function parseExtraRecipes(items, existingNames) {
    const recipes = [];

    items.forEach(item => {
        if (!item.components || !item.components.length || !item.name) return;
        if (existingNames.has(item.name)) return; // já existe localmente

        const category = mapExtraCategory(item);
        const components = [];

        item.components.forEach(comp => {
            const rawName = comp.name || comp.itemName || '';
            if (!rawName || /^\d+$/.test(rawName.trim()) || isExtraGenericResource(rawName)) return;

            const id = `${item.name}::${rawName}`;
            const displayName = rawName.toLowerCase().includes(item.name.toLowerCase()) ||
                item.name.toLowerCase().includes(rawName.toLowerCase())
                ? rawName
                : `${item.name} ${rawName}`;
            const requiredQty = comp.itemCount || 1;

            components.push({ id, displayName, rawName, requiredQty });
        });

        if (components.length < 2) return;

        recipes.push({
            name: item.name,
            category,
            components,
            wikiaUrl: item.wikiaUrl || null,
            description: item.description || '',
            imageName: item.imageName || null
        });
    });

    return recipes;
}

// ============================================
// MERGE: adiciona novas receitas ao RECIPES global
// ============================================
function mergeExtraRecipes(newRecipes) {
    if (!newRecipes || !newRecipes.length) return 0;

    const existingNames = new Set(RECIPES.map(r => r.name));
    let added = 0;

    newRecipes.forEach(r => {
        if (!existingNames.has(r.name)) {
            RECIPES.push(r);
            added++;
        }
    });

    if (added > 0) {
        // Reordena
        RECIPES.sort((a, b) => a.name.localeCompare(b.name));

        // Reconstrói os mapas
        const maps = WarframeAPI.buildComponentMaps(RECIPES);
        ALL_COMPONENTS = maps.allComps;
        COMP_MAP = maps.compMap;

        // Re-aplica raridades se já carregadas
        if (typeof applyRaritiesToCompMap === 'function' && typeof RARITY_LOADED !== 'undefined' && RARITY_LOADED) {
            applyRaritiesToCompMap();
        }

        console.log(`[Extra] +${added} receitas adicionadas | Total: ${RECIPES.length}`);
    }

    return added;
}

// ============================================
// INDICADOR DE PROGRESSO NA NAVBAR
// ============================================
function updateExtraProgressBar(percent, message) {
    EXTRA_PROGRESS = percent;
    const bar = document.getElementById('extraProgressBar');
    const fill = document.getElementById('extraProgressFill');
    const label = document.getElementById('extraProgressLabel');

    if (!bar) return;

    if (percent >= 100) {
        // Esconde após 3 segundos
        bar.classList.add('completed');
        if (label) label.textContent = message || 'Carregamento completo';
        setTimeout(() => {
            bar.classList.add('hidden');
        }, 3000);
        return;
    }

    bar.classList.remove('hidden', 'completed');
    if (fill) fill.style.width = percent + '%';
    if (label) label.textContent = message || `${percent}%`;
}

// ============================================
// LOAD: carrega cache primeiro, depois API
// ============================================
async function loadExtraRecipes(forceRefresh = false) {
    // Cache primeiro
    if (!forceRefresh) {
        const cached = getCachedExtraRecipes();
        if (cached && cached.length) {
            const added = mergeExtraRecipes(cached);
            EXTRA_LOADED = true;
            console.log(`[Extra] Carregado do cache: ${cached.length} receitas`);

            updateExtraProgressBar(100, `✓ ${RECIPES.length} receitas (cache)`);

            // Re-renderiza UI
            if (typeof renderAll === 'function') {
                invalidateProgressCache();
                renderAll();
            }

            // Repopula categorias
            if (typeof populateCategories === 'function') populateCategories();
            if (typeof populateCraftedCategories === 'function') populateCraftedCategories();

            return true;
        }
    }

    if (EXTRA_LOADING) return false;
    EXTRA_LOADING = true;

    try {
        updateExtraProgressBar(10, 'Conectando à API...');

        const existingNames = new Set(RECIPES.map(r => r.name));
        const allNewRecipes = [];

        // Busca cada endpoint sequencialmente para mostrar progresso
        for (let i = 0; i < EXTRA_CONFIG.ENDPOINTS.length; i++) {
            const ep = EXTRA_CONFIG.ENDPOINTS[i];
            const baseProgress = 10 + (i * 40);
            updateExtraProgressBar(baseProgress, `Baixando ${ep.label}...`);

            try {
                const data = await fetchExtraWithTimeout(ep.url, EXTRA_CONFIG.REQUEST_TIMEOUT);
                updateExtraProgressBar(baseProgress + 20, `Processando ${ep.label}...`);

                const parsed = parseExtraRecipes(data, existingNames);
                allNewRecipes.push(...parsed);
                parsed.forEach(r => existingNames.add(r.name));

                console.log(`[Extra] ${ep.label}: +${parsed.length} receitas`);
            } catch (e) {
                console.warn(`[Extra] Falha em ${ep.label}:`, e.message);
            }
        }

        if (allNewRecipes.length === 0) {
            updateExtraProgressBar(100, '⚠️ Sem novas receitas');
            EXTRA_LOADING = false;
            return false;
        }

        updateExtraProgressBar(95, 'Mesclando receitas...');
        const added = mergeExtraRecipes(allNewRecipes);

        // Salva cache
        saveCachedExtraRecipes(allNewRecipes);

        EXTRA_LOADED = true;
        updateExtraProgressBar(100, `✓ ${RECIPES.length} receitas carregadas!`);

        // Re-renderiza tudo
        if (typeof renderAll === 'function') {
            invalidateProgressCache();
            renderAll();
        }

        // Repopula filtros
        if (typeof populateCategories === 'function') populateCategories();
        if (typeof populateCraftedCategories === 'function') populateCraftedCategories();

        // Re-renderiza modal manual de fabricação se aberto
        const manualModal = document.getElementById('manualCraftModal');
        if (manualModal && !manualModal.classList.contains('hidden')) {
            if (typeof renderManualCraftList === 'function') renderManualCraftList();
        }

        // Toast de sucesso
        if (typeof showToast === 'function') {
            showToast(`✨ ${added} novas receitas carregadas!`, 'success');
        }

        return true;
    } catch (e) {
        console.error('[Extra] Erro:', e);
        updateExtraProgressBar(100, '⚠️ Erro ao carregar');
        return false;
    } finally {
        EXTRA_LOADING = false;
    }
}

// ============================================
// INICIA EM BACKGROUND
// ============================================
function initExtraRecipes() {
    const startBackgroundFetch = () => {
        loadExtraRecipes(false);
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(startBackgroundFetch, { timeout: 3000 });
    } else {
        setTimeout(startBackgroundFetch, 1500);
    }
}
