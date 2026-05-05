class InventoryManager {
    constructor(){this.currentUser=null;this.inventory={};this.crafted={};this._dirty=false;this._lastHash='';}
    _key(){return`wf_inv4_${this.currentUser}`;}
    _craftedKey(){return`wf_crafted4_${this.currentUser}`;}
    _bkKey(s){return`wf_bk4_${this.currentUser}_${s}`;}
    _hash(){return JSON.stringify(this.inventory)+JSON.stringify(this.crafted);}

    loadUser(u){
        this.currentUser=u.toLowerCase().trim();
        let d=StorageManager.getLS(this._key());try{this.inventory=d?JSON.parse(d):{};}catch(e){this.inventory={};}
        d=StorageManager.getLS(this._craftedKey());try{this.crafted=d?JSON.parse(d):{};}catch(e){this.crafted={};}
        if(!Object.keys(this.inventory).length)this._recoverIDB();
        StorageManager.setLS('wf_last_user',this.currentUser);this._lastHash=this._hash();this._dirty=false;
    }
    async _recoverIDB(){const d=await StorageManager.loadIDB(`inv4_${this.currentUser}`);if(d&&d.inventory&&Object.keys(d.inventory).length){this.inventory=d.inventory;this.crafted=d.crafted||{};this.save();}}
    static getLastUser(){return StorageManager.getLS('wf_last_user');}
    static getSavedCloudUserId(){return StorageManager.getLS('wf_cloud_user_id');}

    save(){
        if(!this.currentUser)return;
        StorageManager.setLS(this._key(),JSON.stringify(this.inventory));
        StorageManager.setLS(this._craftedKey(),JSON.stringify(this.crafted));
        StorageManager.saveIDB(`inv4_${this.currentUser}`,{inventory:this.inventory,crafted:this.crafted});
        const h=this._hash();if(h!==this._lastHash){this._dirty=true;this._lastHash=h;}
        StorageManager.setLS(`wf_lastsave_${this.currentUser}`,Date.now().toString());
    }
    getLastSave(){const t=StorageManager.getLS(`wf_lastsave_${this.currentUser}`);return t?parseInt(t):null;}
    isDirty(){return this._dirty;}

    createBackup(){
        if(!this.currentUser)return;
        const bd=JSON.stringify({inventory:this.inventory,crafted:this.crafted,ts:Date.now(),count:Object.keys(this.inventory).length});
        for(let i=CONFIG.MAX_LOCAL_BACKUPS-1;i>0;i--){const p=StorageManager.getLS(this._bkKey(i-1));if(p)StorageManager.setLS(this._bkKey(i),p);}
        StorageManager.setLS(this._bkKey(0),bd);this._dirty=false;
    }
    getBackups(){const b=[];for(let i=0;i<CONFIG.MAX_LOCAL_BACKUPS;i++){const d=StorageManager.getLS(this._bkKey(i));if(d){try{const p=JSON.parse(d);p.slot=i;b.push(p);}catch(e){}}}return b;}
    restoreBackup(s){const d=StorageManager.getLS(this._bkKey(s));if(!d)return false;try{const p=JSON.parse(d);if(p.inventory){this.createBackup();this.inventory=p.inventory;this.crafted=p.crafted||{};this.save();cloudSync.schedulePush();return true;}}catch(e){}return false;}

    exportData(){return JSON.stringify({user:this.currentUser,inventory:this.inventory,crafted:this.crafted,count:Object.keys(this.inventory).length,date:new Date().toISOString(),version:4},null,2);}
    importData(json){try{const d=JSON.parse(json);if(d.inventory&&typeof d.inventory==='object'){this.createBackup();this.inventory=d.inventory;this.crafted=d.crafted||{};this.save();cloudSync.schedulePush();return true;}}catch(e){}return false;}

    hasItem(id){return(this.inventory[id]||0)>0;}
    getQty(id){return this.inventory[id]||0;}
    addItem(id,q=1){this.inventory[id]=(this.inventory[id]||0)+q;this.save();cloudSync.schedulePush();}
    removeItem(id){delete this.inventory[id];this.save();cloudSync.schedulePush();}
    setQty(id,q){if(q<=0)delete this.inventory[id];else this.inventory[id]=q;this.save();cloudSync.schedulePush();}
    getAllItems(){return Object.entries(this.inventory).filter(([_,q])=>q>0).map(([id,quantity])=>({id,quantity})).sort((a,b)=>{const da=COMP_MAP[a.id]?.displayName||a.id;const db=COMP_MAP[b.id]?.displayName||b.id;return da.localeCompare(db);});}

    isCrafted(n){return!!this.crafted[n];}
    getCraftedTime(n){return this.crafted[n]||null;}
    setCrafted(n){this.crafted[n]=Date.now();this.save();cloudSync.schedulePush();}
    unsetCrafted(n){delete this.crafted[n];this.save();cloudSync.schedulePush();}

    getRecipeProgress(recipe){
        const total=recipe.components.length;let owned=0;
        const details=recipe.components.map(comp=>{
            const hasQty=this.getQty(comp.id);const needed=comp.requiredQty||1;const hasEnough=hasQty>=needed;
            if(hasEnough)owned++;
            return{id:comp.id,displayName:comp.displayName,rawName:comp.rawName,requiredQty:needed,owned:hasEnough,quantity:hasQty};
        });
        const canCraft=details.every(d=>d.quantity>=d.requiredQty);
        let maxCrafts=0;
        if(canCraft)maxCrafts=Math.min(...details.map(d=>Math.floor(d.quantity/d.requiredQty)));
        return{total,owned,details,percentage:total>0?(owned/total)*100:0,canCraft,maxCrafts};
    }

    craftRecipe(recipe){
        const p=this.getRecipeProgress(recipe);if(!p.canCraft)return false;
        recipe.components.forEach(c=>{const cur=this.getQty(c.id);const need=c.requiredQty||1;this.setQty(c.id,cur-need);});
        this.setCrafted(recipe.name);return true;
    }
    uncraftRecipe(recipe){
        recipe.components.forEach(c=>{const need=c.requiredQty||1;this.addItem(c.id,need);});
        this.unsetCrafted(recipe.name);return true;
    }
    findRecipesUsing(id){return RECIPES.filter(r=>r.components.some(c=>c.id===id));}
}
