const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

let dbInstance = null;

async function connectDB() {
    if (dbInstance) return dbInstance;
    
    dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    await initDB(dbInstance);
    return dbInstance;
}

async function initDB(db) {
    // Activar claves foráneas
    await db.exec('PRAGMA foreign_keys = ON;');

    // 1. Tabla de Empresas (Tenants)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            logo TEXT,
            telefono TEXT,
            suscripcion_activa BOOLEAN DEFAULT 1,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Tabla de Configuración (Automatización, GCal)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS configuracion_empresa (
            empresa_id INTEGER PRIMARY KEY,
            recordatorios_activos BOOLEAN DEFAULT 0,
            webhook_url TEXT,
            gcal_sync_activa BOOLEAN DEFAULT 0,
            gcal_calendar_id TEXT,
            gcal_service_key TEXT,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );
    `);

    // 3. Tabla de Horario Semanal Estándar
    await db.exec(`
        CREATE TABLE IF NOT EXISTS configuracion_horario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            dia_semana INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ...
            activo BOOLEAN DEFAULT 0,
            inicio TEXT DEFAULT '08:00',
            fin TEXT DEFAULT '19:00',
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            UNIQUE(empresa_id, dia_semana)
        );
    `);

    // 4. Tabla de Servicios
    await db.exec(`
        CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            duracion INTEGER NOT NULL,
            precio INTEGER NOT NULL,
            descripcion TEXT,
            oferta_del_dia BOOLEAN DEFAULT 0,
            oferta_inicio TEXT,
            oferta_fin TEXT,
            descuento INTEGER DEFAULT 0,
            precio_especial INTEGER DEFAULT 0,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );
    `);

    // 5. Tabla de Usuarios (Pacientes/Clientes) - Pueden ser compartidos o por empresa.
    // Por privacidad, lo aislamos por empresa. Un cliente puede existir en dos spas.
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            telefono TEXT NOT NULL,
            edad INTEGER,
            genero TEXT,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            UNIQUE(empresa_id, telefono)
        );
    `);

    // 6. Tabla de Citas
    await db.exec(`
        CREATE TABLE IF NOT EXISTS citas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_publico TEXT NOT NULL UNIQUE, -- ej: SAM-0001
            empresa_id INTEGER NOT NULL,
            usuario_id INTEGER NOT NULL,
            servicio_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            hora TEXT NOT NULL,
            duracion INTEGER NOT NULL DEFAULT 30,
            estado TEXT DEFAULT 'Confirmada',
            precio_cobrado INTEGER NOT NULL,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
            gcal_event_id TEXT,
            recordatorio_enviado BOOLEAN DEFAULT 0,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE CASCADE
        );
    `);

    // 7. Tabla de Bloqueos Manuales
    await db.exec(`
        CREATE TABLE IF NOT EXISTS bloqueos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            tipo TEXT NOT NULL, -- 'dia' o 'franja'
            hora TEXT,
            duracion INTEGER,
            descripcion TEXT,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );
    `);

    // 8. Tabla de Aperturas Excepcionales
    await db.exec(`
        CREATE TABLE IF NOT EXISTS aperturas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            activo BOOLEAN DEFAULT 1,
            inicio TEXT,
            fin TEXT,
            descripcion TEXT,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );
    `);

    // 9. Tabla de Administradores
    await db.exec(`
        CREATE TABLE IF NOT EXISTS administradores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            usuario TEXT NOT NULL,
            password TEXT NOT NULL,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            UNIQUE(empresa_id, usuario)
        );
    `);

    console.log('✅ Base de datos SQLite y esquemas inicializados correctamente.');
}

// Función para migrar los datos en memoria de Samambaia a la base de datos (Ejecutar solo 1 vez)
async function seedInitialTenant() {
    const db = await connectDB();
    
    // Validar si ya existe el tenant Samambaia
    const existing = await db.get('SELECT id FROM empresas WHERE slug = ?', ['samambaia']);
    if (existing) {
        console.log('✅ Tenant Samambaia ya existe en la DB. Saltando seeder.');
        return;
    }

    console.log('🌱 Ejecutando seeder para crear el tenant "Samambaia Spa"...');
    
    // 1. Crear Empresa
    const resEmpresa = await db.run(`
        INSERT INTO empresas (slug, nombre, descripcion, telefono)
        VALUES ('samambaia', 'Samambaia Spa', 'Centro de Bienestar y Belleza', '3210000000')
    `);
    const empresaId = resEmpresa.lastID;

    // 2. Configuración GCal y Auto
    await db.run(`
        INSERT INTO configuracion_empresa (empresa_id, recordatorios_activos)
        VALUES (?, 0)
    `, [empresaId]);

    // 3. Horario Estándar
    const horarios = [
        { dia: 0, activo: 0, inicio: '08:00', fin: '19:00' }, // Dom
        { dia: 1, activo: 1, inicio: '08:00', fin: '19:00' }, // Lun
        { dia: 2, activo: 1, inicio: '08:00', fin: '19:00' }, // Mar
        { dia: 3, activo: 1, inicio: '08:00', fin: '19:00' }, // Mie
        { dia: 4, activo: 1, inicio: '08:00', fin: '19:00' }, // Jue
        { dia: 5, activo: 1, inicio: '08:00', fin: '19:00' }, // Vie
        { dia: 6, activo: 1, inicio: '08:00', fin: '15:00' }, // Sab
    ];
    for (const h of horarios) {
        await db.run(`
            INSERT INTO configuracion_horario (empresa_id, dia_semana, activo, inicio, fin)
            VALUES (?, ?, ?, ?, ?)
        `, [empresaId, h.dia, h.activo, h.inicio, h.fin]);
    }

    // 4. Servicios Semilla
    const servicios = [
        { n: 'Uñas Semipermanentes', c: 'Uñas', d: 60, p: 35000, desc: 'Aplicación de esmalte semipermanente de larga duración.' },
        { n: 'Uñas Acrílicas', c: 'Uñas', d: 90, p: 65000, desc: 'Extensión de uñas con sistema acrílico.' },
        { n: 'Masaje Relajante', c: 'Relajación', d: 60, p: 80000, desc: 'Masaje corporal completo de relajación profunda.' },
        { n: 'Masaje Descontracturante', c: 'Relajación', d: 90, p: 100000, desc: 'Masaje terapéutico para liberar tensión muscular.' },
        { n: 'Tratamiento Facial', c: 'Tratamientos', d: 60, p: 60000, desc: 'Limpieza e hidratación facial profunda.' },
        { n: 'Cejas y Pestañas', c: 'Tratamientos', d: 45, p: 40000, desc: 'Diseño de cejas y lifting de pestañas.' },
        { n: 'Drenaje Linfático', c: 'Tratamientos', d: 60, p: 70000, desc: 'Masaje para estimular la circulación linfática.' },
        { n: 'Paquete Novias', c: 'Especiales', d: 180, p: 250000, desc: 'Masaje, facial, manicure y pedicure.' }
    ];
    
    for (const s of servicios) {
        await db.run(`
            INSERT INTO servicios (empresa_id, nombre, categoria, duracion, precio, descripcion)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [empresaId, s.n, s.c, s.d, s.p, s.desc]);
    }

    // 5. Crear Administradores Semilla
    // ── Admin principal (acceso rapido en evaluacion SENA) ──────────────────
    await db.run(`
        INSERT INTO administradores (empresa_id, usuario, password)
        VALUES (?, 'admin', 'admin123')
    `, [empresaId]);

    // ── Admin de demostracion con email (credenciales visibles en landing) ──
    await db.run(`
        INSERT OR IGNORE INTO administradores (empresa_id, usuario, password)
        VALUES (?, 'admin@demoestetica.com', '123456')
    `, [empresaId]);

    console.log('✅ Seeder completado con éxito.');
    console.log('   Usuario demo 1: admin           | Contraseña: admin123');
    console.log('   Usuario demo 2: admin@demoestetica.com | Contraseña: 123456');
}

module.exports = {
    connectDB,
    seedInitialTenant
};
