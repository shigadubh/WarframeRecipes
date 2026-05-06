let RECIPES=[], ALL_COMPONENTS=[], COMP_MAP={}, API_LOADED=false, API_SOURCE='';

class WarframeAPI {

    // Fonte rápida (~2MB em vez de 80MB)
    static async fetchItems() {
        // Tenta endpoints menores primeiro
        const sources = [
            { url: 'https://api.warframestat.us/items', name: 'warframestat' },
            { url: 'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Warframes.json', name: 'github-wf', partial: true },
        ];

        for (const source of sources) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

                const r = await fetch(source.url, { signal: controller.signal });
                clearTimeout(timeout);

                if (!r.ok) continue;
                const data = await r.json();
                return { items: data, source: source.name };
            } catch (e) {
                console.warn(`[API] ${source.name} failed:`, e.message);
                continue;
            }
        }

        // Se tudo falhar, tenta GitHub completo como último recurso
        try {
            const r = await fetch('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/All.json');
            if (r.ok) {
                const data = await r.json();
                return { items: data, source: 'github-all' };
            }
        } catch (e) { }

        return null;
    }

    static mapCategory(item) {
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
        return 'Outro';
    }

    static isGenericResource(name) {
        const l = name.toLowerCase();
        const skip = new Set([
            'credits','orokin cell','neurodes','morphics','control module','gallium',
            'neural sensors','neurode','plastids','polymer bundle','rubedo','salvage',
            'ferrite','nano spores','alloy plate','circuits','oxium','cryotic',
            'argon crystal','tellurium','nitain extract','forma','kuva','void traces',
            'detonite injector','fieldron','mutagen mass','pherliac pod','thermia',
            'cubic diodes','carbides','copernics','bracoids','thaumica','namalon',
            'hesperon','travocyte','pustulite','ganglion','scintillant','entrati lanthorn',
            'voidplume quill','voidplume down','voidplume crest','voidplume pinion',
            'lucent teroglobe','steel essence','vitus essence','cetus wisp','breath of the eidolon',
            'fish oil','iradite','grokdrul','maprico','thermal sludge','mytocardia spore',
            'gorgaricus spore','tepa nodule','dusklight sarracenia','moonlight dragonlily',
            'sunlight threshcone','ruk\'s claw','lunar pitcher','frostleaf','vestan moss',
            'star crimzian','star amarast','star veridos','star azureus',
            'amarast','azureus','veridos','crimzian','marquise veridos','marquise thyst',
            'esher devar','orb vallis','plains of eidolon','tralok eyes','murkray liver',
            'norg brain','cuthol tendon','heart of the eidolon','sentirum','nyth',
            'radian sentirum','marquise veridos','marquise thyst','zodian','thyst',
            'heart nyth','star crimzian','axidite','pustrelite','connla sprout',
            'ganglion','saturated muscle mass','lucent teroglobe','entrati lanthorn',
            'sporulate sac','biotic filter','cranial foremount','damaged necramech weapon barrel',
            'damaged necramech weapon receiver','damaged necramech weapon stock',
            'gyromag systems','atmo systems','repeller systems'
        ]);
        return skip.has(l);
    }

    static parseRecipes(items) {
        const recipes = [];
        const seen = new Set();
        const validCats = new Set(['warframes','primary','secondary','melee','sentinels','archwing','necramechs','pets']);
        const validTypes = new Set(['warframe','primary','secondary','melee','sentinel','archwing','pet','necramech','arch-gun','arch-melee']);

        for (const item of items) {
            if (!item.components || !item.components.length || !item.name) continue;
            const c = (item.category || '').toLowerCase();
            const t = (item.type || '').toLowerCase();
            if (!validCats.has(c) && !validTypes.has(t)) continue;
            if (seen.has(item.name)) continue;
            seen.add(item.name);

            const parentName = item.name;
            const components = [];

            for (const comp of item.components) {
                const rawName = comp.name || comp.itemName || '';
                if (!rawName || /^\d+$/.test(rawName.trim()) || this.isGenericResource(rawName)) continue;

                const id = `${parentName}::${rawName}`;
                let displayName;
                const rawLower = rawName.toLowerCase();
                const parentLower = parentName.toLowerCase();

                if (rawLower.includes(parentLower) || parentLower.includes(rawLower)) {
                    displayName = rawName;
                } else {
                    displayName = `${parentName} ${rawName}`;
                }

                const requiredQty = comp.itemCount || 1;
                components.push({ id, displayName, rawName, requiredQty });
            }

            if (components.length < 2) continue;

            recipes.push({
                name: parentName,
                category: this.mapCategory(item),
                components,
                wikiaUrl: item.wikiaUrl || null,
                description: item.description || '',
                imageName: item.imageName || null
            });
        }

        recipes.sort((a, b) => a.name.localeCompare(b.name));
        return recipes;
    }

    static buildComponentMaps(recipes) {
        const allComps = [];
        const compMap = {};
        for (const recipe of recipes) {
            for (const comp of recipe.components) {
                if (!compMap[comp.id]) {
                    compMap[comp.id] = {
                        displayName: comp.displayName,
                        parentName: recipe.name,
                        rawName: comp.rawName,
                        requiredQty: comp.requiredQty
                    };
                    allComps.push({
                        id: comp.id,
                        displayName: comp.displayName,
                        parentName: recipe.name
                    });
                }
            }
        }
        allComps.sort((a, b) => a.displayName.localeCompare(b.displayName));
        return { allComps, compMap };
    }

    static getCategories(recipes) {
        return [...new Set(recipes.map(r => r.category))].sort();
    }
}

// ===== CACHE =====
function cacheRecipes(recipes) {
    try {
        // Salva versão compacta (sem description e wikiaUrl)
        const compact = recipes.map(r => ({
            name: r.name,
            category: r.category,
            components: r.components,
            imageName: r.imageName
        }));
        StorageManager.setLS('wf_rc5', JSON.stringify(compact));
        StorageManager.setLS('wf_rc5_t', Date.now().toString());
    } catch (e) {
        console.warn('[Cache] Falha ao salvar:', e.message);
        // Se localStorage estiver cheio, tenta limpar caches antigos
        try {
            StorageManager.removeLS('wf_rc4');
            StorageManager.removeLS('wf_rc4_t');
            StorageManager.removeLS('wf_rc3');
            StorageManager.removeLS('wf_rc3_t');
            StorageManager.setLS('wf_rc5', JSON.stringify(recipes));
            StorageManager.setLS('wf_rc5_t', Date.now().toString());
        } catch (e2) { }
    }
}

function getCachedRecipes() {
    try {
        const c = StorageManager.getLS('wf_rc5');
        const t = StorageManager.getLS('wf_rc5_t');
        if (c && t && Date.now() - parseInt(t) < CONFIG.CACHE_TTL_MS) {
            return JSON.parse(c);
        }
    } catch (e) { }
    return null;
}

// ===== LOAD API =====
async function loadAPI(force = false) {
    setProgress(5, 'Verificando cache...');

    // 1. Cache primeiro (instantâneo)
    if (!force) {
        const cached = getCachedRecipes();
        if (cached && cached.length) {
            setProgress(50, 'Carregando do cache...');
            RECIPES = cached;
            const maps = WarframeAPI.buildComponentMaps(RECIPES);
            ALL_COMPONENTS = maps.allComps;
            COMP_MAP = maps.compMap;
            API_SOURCE = 'cache';
            API_LOADED = true;
            setProgress(100, `${RECIPES.length} receitas (cache)`);
            return true;
        }
    }

    // 2. Busca da API
    setProgress(10, 'Conectando...');
    const result = await WarframeAPI.fetchItems();

    if (result) {
        setProgress(60, `Processando ${result.items.length} itens...`);
        RECIPES = WarframeAPI.parseRecipes(result.items);
        const maps = WarframeAPI.buildComponentMaps(RECIPES);
        ALL_COMPONENTS = maps.allComps;
        COMP_MAP = maps.compMap;
        API_SOURCE = result.source;
        API_LOADED = true;
        setProgress(90, 'Salvando cache...');
        cacheRecipes(RECIPES);
        setProgress(100, `${RECIPES.length} receitas!`);
        return true;
    }

    // 3. Cache expirado como fallback
    try {
        const old = StorageManager.getLS('wf_rc5');
        if (old) {
            RECIPES = JSON.parse(old);
            const maps = WarframeAPI.buildComponentMaps(RECIPES);
            ALL_COMPONENTS = maps.allComps;
            COMP_MAP = maps.compMap;
            API_SOURCE = 'cache-expired';
            API_LOADED = true;
            setProgress(100, 'Cache antigo');
            return true;
        }
    } catch (e) { }

    return false;
}
