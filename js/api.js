/**
 * api.js - VERSÃO CORRIGIDA
 * Parseia receitas com componentes únicos e extrai imagens
 */

class WarframeAPI {

    static async fetchFromGitHub() {
        const r = await fetch('https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/All.json');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    }

    static async fetchFromWarframeStat() {
        const r = await fetch('https://api.warframestat.us/items');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
        const resources = [
            'credits','orokin cell','neurodes','morphics','control module','gallium',
            'neural sensors','neurode','plastids','polymer bundle','rubedo','salvage',
            'ferrite','nano spores','alloy plate','circuits','oxium','cryotic',
            'argon crystal','tellurium','nitain extract','forma','kuva','void traces',
            'detonite injector','fieldron','mutagen mass','pherliac pod','thermia',
            'cubic diodes','carbides','copernics','bracoids','thaumica','namalon',
            'hesperon','travocyte','pustulite','ganglion','scintillant','entrati lanthorn',
            'voidplume quill','voidplume down','voidplume crest','voidplume pinion','lucent teroglobe',
            'star crimzian','star amarast','star veridos','star azureus','amarast','azureus','veridos','crimzian',
            'gallium','rubedo','salvage','ferrite','nano spores','alloy plate','circuits'
        ];
        return resources.includes(lower);
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

                // Gera ID único: "NomeDoItem::NomeDoComponente"
                const id = `${parentName}::${rawName}`;

                // Display name: se o componente já contém o nome do pai, usa como está
                // senão, adiciona o nome do pai
                let displayName;
                if (rawName.toLowerCase().includes(parentName.toLowerCase()) ||
                    parentName.toLowerCase().includes(rawName.toLowerCase())) {
                    displayName = rawName;
                } else {
                    displayName = `${parentName} ${rawName}`;
                }

                // Quantidade necessária (se existir)
                const requiredQty = comp.itemCount || 1;

                components.push({ id, displayName, rawName, requiredQty });
            });

            if (components.length < 2) return;

            // Imagem: tenta usar a imagem do componente se existir, senão do item
            let imageName = null;
            if (item.imageName) {
                imageName = item.imageName;
            } else {
                // Tenta achar imagem no primeiro componente
                const compWithImage = item.components.find(c => c.imageName);
                if (compWithImage) imageName = compWithImage.imageName;
            }

            recipes.push({
                name: parentName,
                category: this.mapCategory(item),
                components,
                wikiaUrl: item.wikiaUrl || null,
                description: item.description || '',
                imageName: imageName || null
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
            });
        });

        allComps.sort((a, b) => a.displayName.localeCompare(b.displayName));
        return { allComps, compMap };
    }

    static getCategories(recipes) {
        const s = new Set();
        recipes.forEach(r => s.add(r.category));
        return Array.from(s).sort();
    }
}
