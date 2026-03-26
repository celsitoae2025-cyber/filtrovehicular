/**
 * Acceso seguro al panel de administración
 * -----------------------------------------
 * 1. Cambia `passphrase` por una clave larga (mín. 16 caracteres recomendado).
 * 2. No subas esta clave a repositorios públicos sin cifrar (usa .gitignore si aplica).
 * 3. Esto protege el front; refuerza con políticas RLS en Supabase para datos sensibles.
 */
window.FILTRO_ADMIN_CONFIG = {
    passphrase: 'Xmen@2026',
    sessionHours: 8,
    maxAttempts: 5,
    lockoutMinutes: 15
};
