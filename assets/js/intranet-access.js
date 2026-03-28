/**
 * Credenciales de acceso a la Intranet (panel admin).
 *
 * ⚠️  SEGURIDAD: Este archivo contiene credenciales sensibles.
 *     NO debe publicarse en repositorios públicos.
 *     Idealmente migrar a autenticación server-side (Supabase Auth).
 *
 * Cambia estos valores si rotas las claves.
 */
window.FILTRO_INTRANET_ACCESS = {
    email: 'juandevillar80@gmail.com',
    /** Contraseña 1 */
    password1: '80415783',
    /** Contraseña 2 */
    password2: '201090',
    /** Horas de sesión admin tras validar (misma clave que admin-gate) */
    adminSessionHours: 8
};
