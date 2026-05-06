const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

class CloudSync {
    constructor(){this.userId=null;this.isOnline=navigator.onLine;this.syncTimer=null;this.periodicTimer=null;this._setupConnectivity();}

    _setupConnectivity(){
        window.addEventListener('online',()=>{this.isOnline=true;this.push();});
        window.addEventListener('offline',()=>{this.isOnline=false;setSyncStatus('offline','📴 OFFLINE');});
    }

    async loginOrCreate(username,pin){
        setSyncStatus('syncing','⏳ ENTRANDO');
        try{
            const{data:existing}=await supabaseClient.from('profiles').select('id,username,pin_hash').eq('username',username.toLowerCase().trim()).maybeSingle();
            if(existing){
                if(existing.pin_hash&&existing.pin_hash!==this._hashPin(pin)){setSyncStatus('error','❌ ERRO');return{success:false,error:'PIN incorreto'};}
                this.userId=existing.id;StorageManager.setLS('wf_cloud_user_id',existing.id);StorageManager.setLS('wf_last_user',username.toLowerCase().trim());
                await this.pull();this._startPeriodic();setSyncStatus('synced','☁️ SYNC ✓');return{success:true,isNew:false};
            }else{
                const{data:np,error}=await supabaseClient.from('profiles').insert({username:username.toLowerCase().trim(),pin_hash:pin?this._hashPin(pin):null}).select().single();
                if(error){setSyncStatus('error','❌ ERRO');return{success:false,error:error.message};}
                this.userId=np.id;StorageManager.setLS('wf_cloud_user_id',np.id);StorageManager.setLS('wf_last_user',username.toLowerCase().trim());
                this._startPeriodic();setSyncStatus('synced','☁️ SYNC ✓');return{success:true,isNew:true};
            }
        }catch(e){setSyncStatus('error','❌ SEM CONEXÃO');return{success:false,error:'Sem conexão'};}
    }

    async resumeSession(userId){
        this.userId=userId;
        try{const{data}=await supabaseClient.from('profiles').select('id').eq('id',userId).maybeSingle();if(data){await this.pull();this._startPeriodic();setSyncStatus('synced','☁️ SYNC ✓');return true;}}catch(e){setSyncStatus('offline','📴 LOCAL');}
        return false;
    }

    async push(){
        if(!this.userId||!this.isOnline) return;
        setSyncStatus('syncing','⏳ SYNC');
        try{
            const inventory=inv?inv.inventory:{}, crafted=inv?inv.crafted:{};
            const invRows=Object.entries(inventory).filter(([_,q])=>q>0).map(([cid,qty])=>({user_id:this.userId,component_id:cid,quantity:qty}));
            const craftRows=Object.entries(crafted).map(([rn,ts])=>({user_id:this.userId,recipe_name:rn,crafted_at:new Date(ts).toISOString()}));
            if(invRows.length>0){const{error}=await supabaseClient.from('inventory_items').upsert(invRows,{onConflict:'user_id,component_id'});if(error)throw error;}
            const activeIds=Object.keys(inventory).filter(k=>inventory[k]>0);
            if(activeIds.length>0){await supabaseClient.from('inventory_items').delete().eq('user_id',this.userId).not('component_id','in',`(${activeIds.map(id=>`"${id.replace(/"/g,'\\"')}"`).join(',')})`);}else{await supabaseClient.from('inventory_items').delete().eq('user_id',this.userId);}
            if(craftRows.length>0){const{error}=await supabaseClient.from('crafted_items').upsert(craftRows,{onConflict:'user_id,recipe_name'});if(error)throw error;}
            const activeR=Object.keys(crafted);
            if(activeR.length>0){await supabaseClient.from('crafted_items').delete().eq('user_id',this.userId).not('recipe_name','in',`(${activeR.map(r=>`"${r.replace(/"/g,'\\"')}"`).join(',')})`);}else{await supabaseClient.from('crafted_items').delete().eq('user_id',this.userId);}
            StorageManager.setLS('wf_last_sync',Date.now().toString());setSyncStatus('synced','☁️ SYNC ✓');
        }catch(e){console.error('[Sync] Push failed:',e);setSyncStatus('error','❌ SYNC FALHOU');}
    }

    async pull(){
        if(!this.userId) return;
        try{
            const[invR,craftR]=await Promise.all([supabaseClient.from('inventory_items').select('component_id,quantity').eq('user_id',this.userId),supabaseClient.from('crafted_items').select('recipe_name,crafted_at').eq('user_id',this.userId)]);
            if(invR.error)throw invR.error;if(craftR.error)throw craftR.error;
            const ni={};(invR.data||[]).forEach(r=>{ni[r.component_id]=r.quantity;});
            const nc={};(craftR.data||[]).forEach(r=>{nc[r.recipe_name]=new Date(r.crafted_at).getTime();});
            if(inv){inv.inventory=ni;inv.crafted=nc;inv.save();}
        }catch(e){console.error('[Sync] Pull failed:',e);}
    }

    schedulePush(){clearTimeout(this.syncTimer);this.syncTimer=setTimeout(()=>this.push(),CONFIG.SYNC_DEBOUNCE_MS);}
    _startPeriodic(){clearInterval(this.periodicTimer);this.periodicTimer=setInterval(()=>{if(this.isOnline)this.push();},CONFIG.SYNC_INTERVAL_MS);}
    _hashPin(pin){if(!pin)return null;let h=0;const s=pin+'wf_salt_2024';for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h=h&h;}return h.toString(36);}
    getLastSyncTime(){const t=StorageManager.getLS('wf_last_sync');return t?parseInt(t):null;}
    logout(){this.userId=null;clearInterval(this.periodicTimer);clearTimeout(this.syncTimer);StorageManager.removeLS('wf_cloud_user_id');setSyncStatus('idle','☁️ SYNC');}
}

const cloudSync=new CloudSync();
function setSyncStatus(state, text) {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    badge.className = `sync-badge ${state}`;
    badge.textContent = text;

    const lastSync = cloudSync.getLastSyncTime();
    let title = '';

    switch (state) {
        case 'idle':
            title = '☁️ AGUARDANDO — Faça login para sincronizar com a nuvem.\n\nSeus dados ainda estão salvos localmente.';
            break;
        case 'syncing':
            title = '⏳ SINCRONIZANDO — Enviando dados para a nuvem...\n\nNão feche o navegador agora.';
            break;
        case 'synced':
            title = `✅ SINCRONIZADO — Dados salvos na nuvem com sucesso!\n\nÚltimo sync: ${timeAgo(lastSync)}\nServidor: Supabase\n\nVocê pode acessar de qualquer dispositivo fazendo login com o mesmo nome.`;
            break;
        case 'error':
            title = '❌ ERRO — Falha ao sincronizar com a nuvem.\n\nSeus dados ainda estão salvos localmente.\nClique no botão ☁️ para tentar novamente.';
            break;
        case 'offline':
            title = '📴 OFFLINE — Sem conexão com a internet.\n\nSeus dados continuam sendo salvos localmente.\nQuando voltar a internet, será sincronizado automaticamente.';
            break;
        default:
            title = `Status: ${state}`;
    }

    badge.title = title;
}
