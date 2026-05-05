let RECIPES=[], ALL_COMPONENTS=[], COMP_MAP={}, API_LOADED=false, API_SOURCE='';

class WarframeAPI {
    static async fetchFromGitHub() { const r=await fetch(CONFIG.WFCD_URL); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
    static async fetchFromWarframeStat() { const r=await fetch(CONFIG.WFSTAT_URL); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

    static mapCategory(item) {
        const c=(item.category||'').toLowerCase(), t=(item.type||'').toLowerCase(), n=item.name||'', p=n.includes('Prime');
        if(c==='warframes'||t==='warframe') return p?'Warframe Prime':'Warframe';
        if(c==='primary'||t==='primary') return p?'Arma Primária Prime':'Arma Primária';
        if(c==='secondary'||t==='secondary') return p?'Arma Secundária Prime':'Arma Secundária';
        if(c==='melee'||t==='melee') return p?'Corpo a Corpo Prime':'Corpo a Corpo';
        if(c==='sentinels'||t==='sentinel') return p?'Sentinela Prime':'Sentinela';
        if(c==='archwing'||t==='archwing') return p?'Archwing Prime':'Archwing';
        if(c==='pets'||t==='pet') return 'Companheiro';
        if(c==='necramechs') return 'Necramech';
        return 'Outro';
    }

    static isGenericResource(name) {
        const l=name.toLowerCase();
        return['credits','orokin cell','neurodes','morphics','control module','gallium','neural sensors','plastids','polymer bundle','rubedo','salvage','ferrite','nano spores','alloy plate','circuits','oxium','cryotic','argon crystal','tellurium','nitain extract','forma','kuva','void traces','detonite injector','fieldron','mutagen mass','pherliac pod','thermia','cubic diodes','carbides','copernics','bracoids','thaumica','namalon','hesperon','travocyte','pustulite','ganglion','scintillant','entrati lanthorn','voidplume quill','voidplume down','voidplume crest','voidplume pinion','lucent teroglobe'].includes(l);
    }

    static parseRecipes(items) {
        const recipes=[], seen=new Set();
        const validC=['warframes','primary','secondary','melee','sentinels','archwing','necramechs','pets'];
        const validT=['warframe','primary','secondary','melee','sentinel','archwing','pet','necramech','arch-gun','arch-melee'];
        items.forEach(item => {
            if(!item.components||!item.components.length||!item.name) return;
            const c=(item.category||'').toLowerCase(), t=(item.type||'').toLowerCase();
            if(!validC.includes(c)&&!validT.includes(t)) return;
            if(seen.has(item.name)) return;
            seen.add(item.name);
            const pn=item.name, comps=[];
            item.components.forEach(comp => {
                const rn=comp.name||comp.itemName||'';
                if(!rn||/^\d+$/.test(rn.trim())||this.isGenericResource(rn)) return;
                const id=`${pn}::${rn}`;
                const dn=rn.toLowerCase().includes(pn.toLowerCase())||pn.toLowerCase().includes(rn.toLowerCase())?rn:`${pn} ${rn}`;
                const requiredQty=comp.itemCount||1;
                comps.push({id,displayName:dn,rawName:rn,requiredQty});
            });
            if(comps.length<2) return;
            recipes.push({name:pn,category:this.mapCategory(item),components:comps,wikiaUrl:item.wikiaUrl||null,description:item.description||'',imageName:item.imageName||null});
        });
        return recipes.sort((a,b)=>a.name.localeCompare(b.name));
    }

    static buildComponentMaps(recipes) {
        const ac=[], cm={};
        recipes.forEach(r=>{r.components.forEach(c=>{if(!cm[c.id]){cm[c.id]={displayName:c.displayName,parentName:r.name,rawName:c.rawName,requiredQty:c.requiredQty};ac.push({id:c.id,displayName:c.displayName,parentName:r.name});}});});
        return{allComps:ac.sort((a,b)=>a.displayName.localeCompare(b.displayName)),compMap:cm};
    }

    static getCategories(r){return[...new Set(r.map(x=>x.category))].sort();}
}

function cacheRecipes(r){try{StorageManager.setLS('wf_rc4',JSON.stringify(r));StorageManager.setLS('wf_rc4_t',Date.now().toString());}catch(e){}}
function getCachedRecipes(){try{const c=StorageManager.getLS('wf_rc4'),t=StorageManager.getLS('wf_rc4_t');if(c&&t&&Date.now()-parseInt(t)<CONFIG.CACHE_TTL_MS)return JSON.parse(c);}catch(e){}return null;}

async function loadAPI(force=false) {
    setProgress(5,'Verificando cache...');
    if(!force){const c=getCachedRecipes();if(c&&c.length){RECIPES=c;const m=WarframeAPI.buildComponentMaps(RECIPES);ALL_COMPONENTS=m.allComps;COMP_MAP=m.compMap;API_SOURCE='cache';API_LOADED=true;setProgress(100,`${RECIPES.length} receitas (cache)`);return true;}}
    setProgress(10,'Conectando GitHub...');
    try{setProgress(20,'Baixando...');const raw=await WarframeAPI.fetchFromGitHub();setProgress(60,`Processando ${raw.length} itens...`);RECIPES=WarframeAPI.parseRecipes(raw);const m=WarframeAPI.buildComponentMaps(RECIPES);ALL_COMPONENTS=m.allComps;COMP_MAP=m.compMap;API_SOURCE='github';API_LOADED=true;cacheRecipes(RECIPES);setProgress(100,`${RECIPES.length} receitas!`);return true;}catch(e){console.warn('GitHub:',e);}
    setProgress(30,'Alternativa...');
    try{const raw=await WarframeAPI.fetchFromWarframeStat();RECIPES=WarframeAPI.parseRecipes(raw);const m=WarframeAPI.buildComponentMaps(RECIPES);ALL_COMPONENTS=m.allComps;COMP_MAP=m.compMap;API_SOURCE='warframestat';API_LOADED=true;cacheRecipes(RECIPES);setProgress(100,'OK!');return true;}catch(e){}
    try{const old=StorageManager.getLS('wf_rc4');if(old){RECIPES=JSON.parse(old);const m=WarframeAPI.buildComponentMaps(RECIPES);ALL_COMPONENTS=m.allComps;COMP_MAP=m.compMap;API_SOURCE='cache-expired';API_LOADED=true;setProgress(100,'Cache antigo');return true;}}catch(e){}
    return false;
}
