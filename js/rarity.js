/**
 * rarity.js - Sistema de Raridade
 * Busca raridades da API WarframeStat.us em background
 * Cacheia por 30 dias para não afetar performance
 */

const RARITY_CONFIG = {
    CACHE_KEY: 'wf_rarity_cache_v1',
    CACHE_TIME_KEY: 'wf_rarity_cache_time_v1',
    CACHE_TTL: 30 * 24 * 60 * 60 * 1000, // 30 dias
    REQUEST_TIMEOUT: 10000,               // 10 segundos máximo por request
    ENDPOINTS: [
        'https://api.warframestat.us/warframes',
        'https://api.warframestat.us/weapons'
    ]
};

// Mapa global de raridades: { "Nome do Item::Componente": "common" | "uncommon" | "rare" }
let RARITY_MAP = {};
let RARITY_LOADED = false;
let RARITY_LOADING = false;

// ============================================
// CACHE
// ============================================
function getCachedRarities() {
    try {
        const cached = StorageManager.getLS(RARITY_CONFIG.CACHE_KEY);
        const time = StorageManager.getLS(RARITY_CONFIG.CACHE_TIME_KEY);
        if (cached && time) {
            const age = Date.now() - parseInt(time);
            if (age < RARITY_CONFIG.CACHE_TTL) {
                return JSON.parse(cached);
            }
        }
    } catch (e) {
        console.warn('[Rarity] Cache leitura falhou:', e);
    }
    return null;
}

function saveCachedRarities(map) {
    try {
        StorageManager.setLS(RARITY_CONFIG.CACHE_KEY, JSON.stringify(map));
        StorageManager.setLS(RARITY_CONFIG.CACHE_TIME_KEY, Date.now().toString());
        console.log(`[Rarity] Cache salvo: ${Object.keys(map).length} entradas`);
    } catch (e) {
        console.warn('[Rarity] Cache salvar falhou:', e);
    }
}

// ============================================
// FETCH COM TIMEOUT
// ============================================
async function fetchWithTimeout(url, timeout) {
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
// PARSE: extrai raridade dos dados da API
// ============================================
function parseRaritiesFromAPI(items) {
    const rarities = {};
    let count = 0;

    items.forEach(item => {
        if (!item.name || !item.components) return;

        const parentName = item.name;

        item.components.forEach(comp => {
            if (!comp.name) return;

            const id = `${parentName}::${comp.name}`;

            // A API retorna o campo "drops" com as relíquias
            // Procuramos a melhor raridade entre os drops
            let bestRarity = null;

            if (comp.drops && Array.isArray(comp.drops)) {
                // Se tem drops, pega a primeira que tiver rarity
                for (const drop of comp.drops) {
                    if (drop.rarity) {
                        const r = drop.rarity.toLowerCase();
                        if (['common', 'uncommon', 'rare'].includes(r)) {
                            bestRarity = r;
                            break;
                        }
                    }
                }
            }

            // Se não achou nos drops do componente, tenta no campo "rarity" direto
            if (!bestRarity && comp.rarity) {
                const r = comp.rarity.toLowerCase();
                if (['common', 'uncommon', 'rare'].includes(r)) {
                    bestRarity = r;
                }
            }

            if (bestRarity) {
                rarities[id] = bestRarity;
                count++;
            }
        });
    });

    console.log(`[Rarity] ${count} raridades extraídas`);
    return rarities;
}

// ============================================
// LOAD: carrega cache primeiro, depois API se necessário
// ============================================
async function loadRarities(forceRefresh = false) {
    // 1. Tenta cache primeiro
    if (!forceRefresh) {
        const cached = getCachedRarities();
        if (cached) {
            RARITY_MAP = cached;
            RARITY_LOADED = true;
            console.log(`[Rarity] Carregado do cache: ${Object.keys(RARITY_MAP).length} entradas`);
            applyRaritiesToCompMap();
            return true;
        }
    }

    // 2. Se já tá carregando, não inicia outro
    if (RARITY_LOADING) {
        console.log('[Rarity] Já está carregando...');
        return false;
    }

    // 3. Busca da API em background
    RARITY_LOADING = true;
    showRarityIndicator(true);

    try {
        console.log('[Rarity] Buscando da API...');

        // Busca os 2 endpoints em paralelo
        const promises = RARITY_CONFIG.ENDPOINTS.map(url =>
            fetchWithTimeout(url, RARITY_CONFIG.REQUEST_TIMEOUT)
                .catch(e => {
                    console.warn(`[Rarity] Falha em ${url}:`, e.message);
                    return null;
                })
        );

        const results = await Promise.all(promises);
        const allItems = results.flat().filter(Boolean);

        if (allItems.length === 0) {
            throw new Error('Nenhum dado retornado da API');
        }

        const rarities = parseRaritiesFromAPI(allItems);

        if (Object.keys(rarities).length > 0) {
            RARITY_MAP = rarities;
            RARITY_LOADED = true;
            saveCachedRarities(RARITY_MAP);
            applyRaritiesToCompMap();

            // Re-renderiza para mostrar as novas raridades
            if (typeof renderAll === 'function') {
                setTimeout(() => renderAll(), 100);
            }

            showRarityIndicator(false, true);
            return true;
        } else {
            throw new Error('Nenhuma raridade encontrada nos dados');
        }
    } catch (e) {
        console.warn('[Rarity] Erro ao buscar:', e.message);
        showRarityIndicator(false, false);
        return false;
    } finally {
        RARITY_LOADING = false;
    }
}

// ============================================
// APLICA as raridades no COMP_MAP
// ============================================
function applyRaritiesToCompMap() {
    if (typeof COMP_MAP === 'undefined') return;

    let applied = 0;
    Object.keys(COMP_MAP).forEach(id => {
        if (RARITY_MAP[id]) {
            COMP_MAP[id].rarity = RARITY_MAP[id];
            applied++;
        } else {
            // Componentes sem raridade conhecida
            COMP_MAP[id].rarity = 'unknown';
        }
    });

    // Aplica em ALL_COMPONENTS também
    if (typeof ALL_COMPONENTS !== 'undefined') {
        ALL_COMPONENTS.forEach(c => {
            c.rarity = COMP_MAP[c.id]?.rarity || 'unknown';
        });
    }

    console.log(`[Rarity] Aplicado em ${applied}/${Object.keys(COMP_MAP).length} componentes`);
}

// ============================================
// INDICADOR VISUAL DE LOADING
// ============================================
function showRarityIndicator(loading, success = null) {
    let indicator = document.getElementById('rarityIndicator');

    if (!indicator) {
        // Cria o indicador se não existir
        indicator = document.createElement('span');
        indicator.id = 'rarityIndicator';
        indicator.className = 'rarity-indicator';
        const userSection = document.querySelector('.user-section');
        if (userSection) {
            userSection.insertBefore(indicator, userSection.firstChild);
        }
    }

    if (loading) {
        indicator.className = 'rarity-indicator loading';
        indicator.textContent = '⏳ RARIDADES';
        indicator.title = 'Buscando raridades em background...';
    } else if (success === true) {
        indicator.className = 'rarity-indicator success';
        indicator.textContent = '⭐ RARIDADES';
        indicator.title = `${Object.keys(RARITY_MAP).length} raridades carregadas (cache 30 dias)`;
        // Remove o indicador depois de 5 segundos
        setTimeout(() => {
            if (indicator) indicator.style.opacity = '0.5';
        }, 5000);
    } else if (success === false) {
        indicator.className = 'rarity-indicator error';
        indicator.textContent = '⚠️ RARIDADES';
        indicator.title = 'Não foi possível carregar raridades. App funciona normalmente.';
    }
}

// ============================================
// INICIA EM BACKGROUND (idle callback)
// ============================================
function initRarities() {
    // Carrega cache imediatamente (instantâneo)
    const cached = getCachedRarities();
    if (cached) {
        RARITY_MAP = cached;
        RARITY_LOADED = true;
        applyRaritiesToCompMap();
        console.log('[Rarity] Cache aplicado no boot');
        return;
    }

    // Se não tem cache, busca em background quando o navegador estiver ocioso
    const startBackgroundFetch = () => {
        console.log('[Rarity] Iniciando busca em background...');
        loadRarities(false);
    };

    if (typeof requestIdleCallback === 'function') {
        // Espera o navegador ficar ocioso (não impacta UX)
        requestIdleCallback(startBackgroundFetch, { timeout: 5000 });
    } else {
        // Fallback: espera 2 segundos para não competir com o boot
        setTimeout(startBackgroundFetch, 2000);
    }
}
