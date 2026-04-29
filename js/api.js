/**
 * api.js
 * Busca e parseia dados de receitas da API WFCD / WarframeStat.us
 * Cada componente recebe um ID único: "NomeDoPai::NomeDoComponente"
 */

// ===== Estado global das receitas =====
let RECIPES = [];
let ALL_COMPONENTS = [];
let COMP_MAP = {};
let API_LOADED = false;
let API_SOURCE = '';

class WarframeAPI {

    static async fetchFromGitHub() {
        const r = await fetch(CONFIG.WFCD_URL);
        if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
        return r.json();
    }

    static async fetchFromWarframeStat() {
        const r = await fetch(CONFIG.WFSTAT_URL);
        if (!r.ok) throw new Error(`WarframeStat HTTP ${r.status}`);
        return r.json();
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
        const lower = name.toLowerCase();
        const skip = [
            'credits','orokin cell','neurodes','morphics','control module','gallium',
            'neural sensors','plastids','polymer bundle','rubedo','salvage','ferrite',
            'nano spores','alloy plate','circuits','oxium','cryotic','argon crystal',
            'tellurium','nitain extract','forma','kuva','void traces','detonite injector',
            'fieldron','mutagen mass','pherliac pod','thermia','cubic diodes','carbides',
            'copernics','bracoids','thaumica','namalon','hesperon','travocyte','pustulite',
            'ganglion','scintillant','entrati lanthorn','voidplume quill','voidplume down',
            'voidplume crest','voidplume pinion','lucent teroglobe'
        ];
        return skip.includes(lower);
    }

    static parseRecipes(items) {
        const recipes = [];
        const seen = new Set();
        const validCats = ['warframes','primary','secondary','melee','sentinels','archwing','necramechs','pets'];
        const validTypes = ['warframe','primary','secondary','melee','sentinel','archwing','pet','necramech','arch-gun','arch-melee'];

        items.forEach(item => {
            if (!item.components || !item.components.length || !item.name) return;
            const c = (item.category || '').toLowerCase();
            const t = (item.type || '').toLowerCase();
            if (!validCats.includes(c) && !validTypes.includes(t)) return;
            if (seen.has(item.name)) return;
            seen.add(item.name);

            const parentName = item.name;
            const components = [];

            item.components.forEach(comp => {
                const rawName = comp.name || comp.itemName || '';
                if (!rawName || /^\d+$/.test(rawName.trim()) || this.isGenericResource(rawName)) return;

                const id = `${parentName}::${rawName}`;
                const displayName = rawName.toLowerCase().includes(parentName.toLowerCase()) ||
                    parentName.toLowerCase().includes(rawName.toLowerCase())
                    ? rawName
                    : `${parentName} ${rawName}`;

                components.push({ id, displayName, rawName });
            });

            if (components.length < 2) return;

            recipes.push({
                name: parentName,
                category: this.mapCategory(item),
                components,
                wikiaUrl: item.wikiaUrl || null,
                description: item.description || ''
            });
        });

        return recipes.sort((a, b) => a.name.localeCompare(b.name));
    }

    static buildComponentMaps(recipes) {
        const allComps = [];
        const compMap = {};
        recipes.forEach(recipe => {
            recipe.components.forEach(comp => {
                if (!compMap[comp.id]) {
                    compMap[comp.id] = { displayName: comp.displayName, parentName: recipe.name, rawName: comp.rawName };
                    allComps.push({ id: comp.id, displayName: comp.displayName, parentName: recipe.name });
                }
            });
        });
        return { allComps: allComps.sort((a, b) => a.displayName.localeCompare(b.displayName)), compMap };
    }

    static getCategories(recipes) {
        return [...new Set(recipes.map(r => r.category))].sort();
    }
}

// ===== Cache de receitas =====
function cacheRecipes(recipes) {
    try {
        StorageManager.setLS('wf_rc4', JSON.stringify(recipes));
        StorageManager.setLS('wf_rc4_t', Date.now().toString());
    } catch (e) { }
}

function getCachedRecipes() {
    try {
        const cached = StorageManager.getLS('wf_rc4');
        const time = StorageManager.getLS('wf_rc4_t');
        if (cached && time && Date.now() - parseInt(time) < CONFIG.CACHE_TTL_MS) {
            return JSON.parse(cached);
        }
    } catch (e) { }
    return null;
}

async function loadAPI(force = false) {
    setProgress(5, 'Verificando cache...');

    if (!force) {
        const cached = getCachedRecipes();
        if (cached && cached.length) {
            RECIPES = cached;
            const maps = WarframeAPI.buildComponentMaps(RECIPES);
            ALL_COMPONENTS = maps.allComps; COMP_MAP = maps.compMap;
            API_SOURCE = 'cache'; API_LOADED = true;
            setProgress(100, `${RECIPES.length} receitas (cache)`);
            return true;
        }
    }

    setProgress(10, 'Conectando ao GitHub...');
    try {
        setProgress(20, 'Baixando...');
        const raw = await WarframeAPI.fetchFromGitHub();
        setProgress(60, `Processando ${raw.length} itens...`);
        RECIPES = WarframeAPI.parseRecipes(raw);
        const maps = WarframeAPI.buildComponentMaps(RECIPES);
        ALL_COMPONENTS = maps.allComps; COMP_MAP = maps.compMap;
        API_SOURCE = 'github'; API_LOADED = true;
        cacheRecipes(RECIPES);
        setProgress(100, `${RECIPES.length} receitas!`);
        return true;
    } catch (e) { console.warn('[API] GitHub failed:', e); }

    setProgress(30, 'Tentando alternativa...');
    try {
        const raw = await WarframeAPI.fetchFromWarframeStat();
        setProgress(60, 'Processando...');
        RECIPES = WarframeAPI.parseRecipes(raw);
        const maps = WarframeAPI.buildComponentMaps(RECIPES);
        ALL_COMPONENTS = maps.allComps; COMP_MAP = maps.compMap;
        API_SOURCE = 'warframestat'; API_LOADED = true;
        cacheRecipes(RECIPES);
        setProgress(100, 'OK!');
        return true;
    } catch (e) { console.warn('[API] WarframeStat failed:', e); }

    try {
        const old = StorageManager.getLS('wf_rc4');
        if (old) {
            RECIPES = JSON.parse(old);
            const maps = WarframeAPI.buildComponentMaps(RECIPES);
            ALL_COMPONENTS = maps.allComps; COMP_MAP = maps.compMap;
            API_SOURCE = 'cache-expired'; API_LOADED = true;
            setProgress(100, 'Cache antigo');
            return true;
        }
    } catch (e) { }

    return false;
}