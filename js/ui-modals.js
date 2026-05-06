/**
 * ui-modals.js
 * Gerenciamento de modais e tela de backup
 */

// ============================================
// SETUP DE FECHAMENTO DE MODAIS
// Usa delegação de eventos para pegar TODOS os modais,
// inclusive os criados dinamicamente
// ============================================
function setupModalCloseHandlers() {
    document.addEventListener('click', (e) => {
        // Botão de fechar (X)
        if (e.target.classList && e.target.classList.contains('modal-close')) {
            const modalId = e.target.dataset.close;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) modal.classList.add('hidden');
            } else {
                // Fallback: sobe até achar o modal pai
                const modal = e.target.closest('.modal');
                if (modal) modal.classList.add('hidden');
            }
            return;
        }

        // Clique no backdrop (fora do conteúdo) — exceto login
        if (e.target.classList && e.target.classList.contains('modal') && e.target.id !== 'loginModal') {
            e.target.classList.add('hidden');
        }
    });

    // Tecla Escape fecha modais (exceto login)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
                if (m.id !== 'loginModal') m.classList.add('hidden');
            });
        }
    });
}

// ============================================
// RENDERIZAR INFORMAÇÕES DE BACKUP
// ============================================
function renderBackupInfo() {
    if (!el.backupInfoSection) return;

    const bks = inv.getBackups();
    const ls = (typeof cloudSync !== 'undefined') ? cloudSync.getLastSyncTime() : null;

    el.backupInfoSection.innerHTML = `
        <h4>📊 STATUS</h4>
        <p>Usuário: <strong style="color:var(--accent-primary);">${(inv.currentUser || 'N/A').toUpperCase()}</strong></p>
        <p>Itens: <strong>${inv.getAllItems().length}</strong> | Fabricados: <strong style="color:var(--crafted-red);">${Object.keys(inv.crafted).length}</strong></p>
        <p>Save local: <strong style="color:var(--success);">${timeAgo(inv.getLastSave())}</strong></p>
        <p>Sync nuvem: <strong style="color:var(--accent-primary);">${timeAgo(ls)}</strong></p>
        <p>Backups: <strong>${bks.length}/${CONFIG.MAX_LOCAL_BACKUPS}</strong></p>`;

    el.backupSlots.innerHTML = '';

    if (!bks.length) {
        el.backupSlots.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Nenhum backup local.</p>';
        return;
    }

    bks.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'backup-slot-btn';
        btn.textContent = `#${b.slot + 1} — ${timeAgo(b.ts)} (${b.count || '?'} itens)`;
        btn.addEventListener('click', () => {
            if (confirm(`Restaurar backup #${b.slot + 1}?\n\nSeu inventário atual será substituído.`)) {
                if (inv.restoreBackup(b.slot)) {
                    showToast('Backup restaurado!');
                    renderAll();
                    renderBackupInfo();
                } else {
                    showToast('Erro ao restaurar', 'error');
                }
            }
        });
        el.backupSlots.appendChild(btn);
    });
}
