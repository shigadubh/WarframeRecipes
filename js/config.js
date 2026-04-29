/**
 * config.js
 * Configurações globais do projeto — edite apenas este arquivo
 * para trocar de ambiente ou banco de dados.
 */

const CONFIG = {
    // ==========================================
    // SUPABASE
    // ==========================================
    SUPABASE_URL: 'https://eaewehdzjuvaixlwbzxc.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZXdlaGR6anV2YWl4bHdienhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODc1NzAsImV4cCI6MjA5MzA2MzU3MH0.0l5kFV5KGpJ9bbSppoJIxuzc9s9ziuvNlgJEOFx7z-U',

    // ==========================================
    // COMPORTAMENTO DO SYNC
    // ==========================================
    SYNC_DEBOUNCE_MS: 2000,      // Aguarda 2s após última alteração antes de sincronizar
    SYNC_INTERVAL_MS: 300000,    // Sync periódico a cada 5 minutos
    CACHE_TTL_MS: 86400000,      // Cache de receitas dura 24 horas

    // ==========================================
    // BACKUP LOCAL
    // ==========================================
    MAX_LOCAL_BACKUPS: 5,

    // ==========================================
    // API DE RECEITAS
    // ==========================================
    WFCD_URL: 'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/All.json',
    WFSTAT_URL: 'https://api.warframestat.us/items',
};