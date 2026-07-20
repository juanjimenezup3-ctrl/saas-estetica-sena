/**
 * =====================================================================
 * seed.js — Script de Inicialización / Seeding Independiente
 * =====================================================================
 * Uso: npm run seed
 *
 * Ejecuta el seeder de base de datos de forma aislada, sin arrancar
 * el servidor Express. Útil en pipelines CI/CD (Render Build Command).
 * =====================================================================
 */
require('dotenv').config();
const { connectDB, seedInitialTenant } = require('./database');

(async () => {
    try {
        console.log('🌱 Iniciando proceso de seeding...');
        await connectDB();
        await seedInitialTenant();
        console.log('\n✅ Seeding completado. Credenciales de acceso:');
        console.log('   ┌────────────────────────────────────────────┐');
        console.log('   │  Usuario:    admin@demoestetica.com         │');
        console.log('   │  Contraseña: 123456                         │');
        console.log('   ├────────────────────────────────────────────┤');
        console.log('   │  Usuario:    admin                          │');
        console.log('   │  Contraseña: admin123                       │');
        console.log('   └────────────────────────────────────────────┘');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante el seeding:', err);
        process.exit(1);
    }
})();
