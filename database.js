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
            plan_nombre TEXT DEFAULT 'Prueba',
            suscripcion_estado TEXT DEFAULT 'Trial',
            suscripcion_fin TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Retrocompatibilidad: Añadir columnas si no existen en la base de datos sqlite ya existente
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN plan_nombre TEXT DEFAULT "Prueba";');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN suscripcion_estado TEXT DEFAULT "Trial";');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN suscripcion_fin TEXT;');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN tema_color TEXT DEFAULT "purple";');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN hero_titulo TEXT;');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN hero_subtitulo TEXT;');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN direccion TEXT;');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN instagram TEXT;');
    } catch (e) {}
    try {
        await db.exec('ALTER TABLE empresas ADD COLUMN plantilla_tipo TEXT DEFAULT "wellness";');
    } catch (e) {}

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

    // 10. Tabla de Pagos y Transacciones Wompi (Suscripciones SaaS)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS pagos_wompi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            referencia TEXT UNIQUE,
            transaccion_id TEXT,
            monto_centavos INTEGER,
            moneda TEXT DEFAULT 'COP',
            estado TEXT,
            metodo_pago TEXT,
            plan_nombre TEXT,
            fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );
    `);

    // 11. Tabla de Galería de Resultados (100% editable por cada empresa)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS galeria_empresa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            subtitulo TEXT,
            imagen_url TEXT NOT NULL,
            orden INTEGER DEFAULT 0,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );
    `);

    console.log('✅ Base de datos SQLite y esquemas inicializados correctamente.');
}

// ---------------------------------------------------------------------
// Utilidades de fecha para citas demo (siempre en la semana ACTUAL)
// ---------------------------------------------------------------------
function fechaLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Retorna { lunes, sabado, hoy } (strings YYYY-MM-DD) de la semana en curso. */
function rangoSemanaActual() {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    return { lunes: fechaLocalISO(lunes), sabado: fechaLocalISO(sabado), hoy: fechaLocalISO(hoy), lunesDate: lunes };
}

const HORARIO_ESTANDAR = [
    { dia: 0, activo: 0, inicio: '08:00', fin: '19:00' }, // Dom
    { dia: 1, activo: 1, inicio: '08:00', fin: '19:00' }, // Lun
    { dia: 2, activo: 1, inicio: '08:00', fin: '19:00' }, // Mar
    { dia: 3, activo: 1, inicio: '08:00', fin: '19:00' }, // Mie
    { dia: 4, activo: 1, inicio: '08:00', fin: '19:00' }, // Jue
    { dia: 5, activo: 1, inicio: '08:00', fin: '19:00' }, // Vie
    { dia: 6, activo: 1, inicio: '08:00', fin: '15:00' }, // Sab
];

/**
 * Definición de los 3 centros demo (aislados por empresa_id / slug).
 * Citas: `dia` 0=Lunes ... 5=Sábado de la semana actual. Se evita el miércoles
 * antes de las 12:00 para no interferir con el flujo de pruebas E2E.
 */
const TENANTS_DEMO = [
    {
        slug: 'samambaia',
        nombre: 'Samambaia Spa',
        descripcion: 'Centro de Bienestar y Belleza',
        telefono: '3210000000',
        prefijoCitas: 'SAM',
        extra: {},
        admins: [
            { usuario: 'admin', password: 'admin123' },
            { usuario: 'admin@demoestetica.com', password: '123456' }
        ],
        servicios: [
            { n: 'Uñas Semipermanentes', c: 'Uñas', d: 60, p: 35000, desc: 'Aplicación de esmalte semipermanente de larga duración.' },
            { n: 'Uñas Acrílicas', c: 'Uñas', d: 90, p: 65000, desc: 'Extensión de uñas con sistema acrílico.' },
            { n: 'Masaje Relajante', c: 'Relajación', d: 60, p: 80000, desc: 'Masaje corporal completo de relajación profunda.' },
            { n: 'Masaje Descontracturante', c: 'Relajación', d: 90, p: 100000, desc: 'Masaje terapéutico para liberar tensión muscular.' },
            { n: 'Tratamiento Facial', c: 'Tratamientos', d: 60, p: 60000, desc: 'Limpieza e hidratación facial profunda.' },
            { n: 'Cejas y Pestañas', c: 'Tratamientos', d: 45, p: 40000, desc: 'Diseño de cejas y lifting de pestañas.' },
            { n: 'Drenaje Linfático', c: 'Tratamientos', d: 60, p: 70000, desc: 'Masaje para estimular la circulación linfática.' },
            { n: 'Paquete Novias', c: 'Especiales', d: 180, p: 250000, desc: 'Masaje, facial, manicure y pedicure.' }
        ],
        citas: [
            { cliente: 'Valentina Gómez', tel: '3105551234', edad: 28, serv: 'Masaje Relajante', dia: 0, hora: '10:00' },
            { cliente: 'Camila Rodríguez', tel: '3158884321', edad: 32, serv: 'Uñas Semipermanentes', dia: 1, hora: '15:00' },
            { cliente: 'Daniela Morales', tel: '3209998765', edad: 26, serv: 'Drenaje Linfático', dia: 2, hora: '14:00' },
            { cliente: 'Sofía Castañeda', tel: '3124449876', edad: 34, serv: 'Tratamiento Facial', dia: 3, hora: '10:00' },
            { cliente: 'Mariana Silva', tel: '3173336543', edad: 29, serv: 'Uñas Acrílicas', dia: 4, hora: '15:00' },
            { cliente: 'Laura Ortiz', tel: '3002223344', edad: 31, serv: 'Paquete Novias', dia: 5, hora: '09:00' }
        ]
    },
    {
        slug: 'demo-spa-zen',
        nombre: 'Demo Spa Zen',
        descripcion: 'Spa urbano de relajación y terapias holísticas',
        telefono: '3101112233',
        prefijoCitas: 'ZEN',
        extra: { plan_nombre: 'Emprendedor', tema_color: 'purple', plantilla_tipo: 'wellness' },
        admins: [{ usuario: 'admin@demospazen.com', password: '123456' }],
        servicios: [
            { n: 'Masaje Piedras Calientes', c: 'Relajación', d: 90, p: 120000, desc: 'Terapia con piedras volcánicas para relajación profunda.' },
            { n: 'Aromaterapia Zen', c: 'Relajación', d: 60, p: 75000, desc: 'Sesión de masaje con aceites esenciales.' },
            { n: 'Facial Hidratante Premium', c: 'Tratamientos', d: 60, p: 85000, desc: 'Limpieza, exfoliación y mascarilla de hidratación.' },
            { n: 'Reflexología Podal', c: 'Terapias', d: 45, p: 55000, desc: 'Masaje de puntos reflejos en los pies.' }
        ],
        citas: [
            { cliente: 'Andrea Vargas', tel: '3011230001', edad: 35, serv: 'Masaje Piedras Calientes', dia: 0, hora: '11:00' },
            { cliente: 'Natalia Ríos', tel: '3011230002', edad: 27, serv: 'Aromaterapia Zen', dia: 1, hora: '16:00' },
            { cliente: 'Paula Herrera', tel: '3011230003', edad: 30, serv: 'Facial Hidratante Premium', dia: 3, hora: '14:00' },
            { cliente: 'Juliana Peña', tel: '3011230004', edad: 41, serv: 'Reflexología Podal', dia: 4, hora: '10:00' }
        ]
    },
    {
        slug: 'demo-barberia',
        nombre: 'Demo Barbería',
        descripcion: 'Barbería profesional: cortes, barba y estilo',
        telefono: '3109998877',
        prefijoCitas: 'BAR',
        extra: { plan_nombre: 'Pro', tema_color: 'barber', plantilla_tipo: 'barber' },
        admins: [{ usuario: 'admin@demobarberia.com', password: '123456' }],
        servicios: [
            { n: 'Corte de Cabello & Styling', c: 'Cortes', d: 45, p: 35000, desc: 'Corte personalizado con tijera y máquina, lavado y peinado.' },
            { n: 'Perfilado de Barba & Toalla Caliente', c: 'Barba', d: 30, p: 28000, desc: 'Delineado a navaja e hidratación con toalla caliente.' },
            { n: 'Combo Corte + Barba + Mascarilla', c: 'Combos', d: 75, p: 60000, desc: 'Experiencia completa de corte, barba y mascarilla facial.' },
            { n: 'Corte Clásico Infantil', c: 'Cortes', d: 30, p: 22000, desc: 'Corte para niños con máquina o tijera.' }
        ],
        citas: [
            { cliente: 'Carlos Mejía', tel: '3021230001', edad: 33, serv: 'Corte de Cabello & Styling', dia: 0, hora: '09:00' },
            { cliente: 'Andrés Duarte', tel: '3021230002', edad: 25, serv: 'Combo Corte + Barba + Mascarilla', dia: 1, hora: '17:00' },
            { cliente: 'Felipe Torres', tel: '3021230003', edad: 29, serv: 'Perfilado de Barba & Toalla Caliente', dia: 3, hora: '15:00' },
            { cliente: 'Sebastián Cruz', tel: '3021230004', edad: 22, serv: 'Combo Corte + Barba + Mascarilla', dia: 4, hora: '16:00' },
            { cliente: 'Mateo León', tel: '3021230005', edad: 10, serv: 'Corte Clásico Infantil', dia: 5, hora: '10:00' }
        ]
    }
];

/** Crea el tenant (si no existe) con su horario, servicios y administradores. */
async function crearTenantDemo(db, def) {
    const existente = await db.get('SELECT id FROM empresas WHERE slug = ?', [def.slug]);
    let empresaId;

    if (!existente) {
        console.log(`🌱 Creando tenant demo "${def.nombre}" (${def.slug})...`);
        const fin = new Date();
        fin.setDate(fin.getDate() + 30);
        const resEmpresa = await db.run(`
            INSERT INTO empresas (slug, nombre, descripcion, telefono, plan_nombre, suscripcion_estado, suscripcion_fin, tema_color, plantilla_tipo)
            VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?)
        `, [
            def.slug, def.nombre, def.descripcion, def.telefono,
            def.extra.plan_nombre || 'Pro', fechaLocalISO(fin),
            def.extra.tema_color || 'purple', def.extra.plantilla_tipo || 'wellness'
        ]);
        empresaId = resEmpresa.lastID;

        await db.run('INSERT INTO configuracion_empresa (empresa_id, recordatorios_activos) VALUES (?, 0)', [empresaId]);

        for (const h of HORARIO_ESTANDAR) {
            await db.run(`
                INSERT INTO configuracion_horario (empresa_id, dia_semana, activo, inicio, fin)
                VALUES (?, ?, ?, ?, ?)
            `, [empresaId, h.dia, h.activo, h.inicio, h.fin]);
        }

        for (const s of def.servicios) {
            await db.run(`
                INSERT INTO servicios (empresa_id, nombre, categoria, duracion, precio, descripcion)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [empresaId, s.n, s.c, s.d, s.p, s.desc]);
        }
    } else {
        empresaId = existente.id;
    }

    // Administradores demo (siempre garantizados; credenciales visibles en el modo evaluador)
    for (const a of def.admins) {
        await db.run(`
            INSERT OR IGNORE INTO administradores (empresa_id, usuario, password)
            VALUES (?, ?, ?)
        `, [empresaId, a.usuario, a.password]);
    }

    return empresaId;
}

/**
 * Garantiza citas de ejemplo en la SEMANA ACTUAL (idempotente).
 * - Si la cita demo no existe, la crea.
 * - Si existe pero quedó fuera de la semana actual (datos viejos), la reubica.
 * Así el calendario y los ingresos proyectados nunca aparecen en cero.
 */
async function seedCitasSemanaActual(db, empresaId, def) {
    const { lunesDate, sabado, lunes, hoy } = rangoSemanaActual();
    let n = 0;

    for (const c of def.citas) {
        n++;
        const idPublico = `${def.prefijoCitas}-D${String(n).padStart(2, '0')}`;
        const f = new Date(lunesDate);
        f.setDate(lunesDate.getDate() + c.dia);
        const fecha = fechaLocalISO(f);
        const estado = fecha < hoy ? 'Completada' : 'Confirmada';

        const serv = await db.get('SELECT id, precio, duracion FROM servicios WHERE empresa_id = ? AND nombre = ?', [empresaId, c.serv]);
        if (!serv) continue;

        const existente = await db.get('SELECT id, fecha FROM citas WHERE id_publico = ? AND empresa_id = ?', [idPublico, empresaId]);
        if (existente) {
            if (existente.fecha < lunes || existente.fecha > sabado) {
                await db.run('UPDATE citas SET fecha = ?, estado = ? WHERE id = ?', [fecha, estado, existente.id]);
            }
            continue;
        }

        let usuario = await db.get('SELECT id FROM usuarios WHERE empresa_id = ? AND telefono = ?', [empresaId, c.tel]);
        if (!usuario) {
            const resU = await db.run(`
                INSERT INTO usuarios (empresa_id, nombre, telefono, edad, genero)
                VALUES (?, ?, ?, ?, ?)
            `, [empresaId, c.cliente, c.tel, c.edad, null]);
            usuario = { id: resU.lastID };
        }

        await db.run(`
            INSERT INTO citas (id_publico, empresa_id, usuario_id, servicio_id, fecha, hora, duracion, estado, precio_cobrado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [idPublico, empresaId, usuario.id, serv.id, fecha, c.hora, serv.duracion, estado, serv.precio]);
    }
}

const FOTOS_GALERIA_DEMO = {
    'samambaia': [
        { titulo: 'Masajes Relajantes', subtitulo: 'Alivio profundo de tensiones y aromaterapia', url: '/images/masaje-relajante.jpg' },
        { titulo: 'Limpieza Facial Profunda', subtitulo: 'Hidratación intensiva y rejuvenecimiento celular', url: '/images/limpieza-facial.jpg' },
        { titulo: 'Diseño de Uñas & Manicura', subtitulo: 'Semipermanente, acrílicas y nail art exclusivo', url: '/images/manicura.jpg' }
    ],
    'demo-barberia': [
        { titulo: 'Corte Fade & Degradado Pro', subtitulo: 'Degradado limpio a máquina y tijera con navaja', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80' },
        { titulo: 'Perfilado de Barba Ritual', subtitulo: 'Delineado a navaja tradicional con toalla caliente', url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80' },
        { titulo: 'Estilismo & Textura Matte', subtitulo: 'Peinado moderno con ceras y pomadas premium', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80' },
        { titulo: 'Experiencia Lounge VIP', subtitulo: 'Ambiente vintage y atención al detalle para el caballero', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80' }
    ],
    'demo-spa-zen': [
        { titulo: 'Masaje con Piedras Calientes', subtitulo: 'Termoterapia volcánica para armonía corporal profunda', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80' },
        { titulo: 'Aromaterapia & Cuencos Tibetanos', subtitulo: 'Esencias botánicas puras para equilibrar mente y espíritu', url: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=800&q=80' },
        { titulo: 'Facial Botánico Orgánico', subtitulo: 'Hidratación dérmica profunda con mascarillas de plantas', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80' }
    ]
};

async function seedGaleriaDemo(db, empresaId, slug) {
    const count = await db.get('SELECT COUNT(*) as c FROM galeria_empresa WHERE empresa_id = ?', [empresaId]);
    if (!count || count.c === 0) {
        const fotos = FOTOS_GALERIA_DEMO[slug] || [];
        let orden = 1;
        for (const f of fotos) {
            await db.run(`
                INSERT INTO galeria_empresa (empresa_id, titulo, subtitulo, imagen_url, orden)
                VALUES (?, ?, ?, ?, ?)
            `, [empresaId, f.titulo, f.subtitulo, f.url, orden++]);
        }
    }
}

// Seeder principal: 3 centros demo (Samambaia Spa, Demo Spa Zen, Demo Barbería).
// Es idempotente: se puede ejecutar en cada arranque (Render) sin duplicar datos.
async function seedInitialTenant() {
    const db = await connectDB();
    for (const def of TENANTS_DEMO) {
        const empresaId = await crearTenantDemo(db, def);
        await seedCitasSemanaActual(db, empresaId, def);
        await seedGaleriaDemo(db, empresaId, def.slug);
    }
    console.log('✅ Seeder completado: Samambaia Spa, Demo Spa Zen y Demo Barbería listos con citas de la semana actual.');
    console.log('   Evaluador SENA:  admin@demoestetica.com | 123456');
    console.log('   Samambaia:       admin | admin123');
}

/** Compatibilidad: re-siembra únicamente las citas de la semana actual de Samambaia. */
async function seedClientesSimulados(db, empresaId) {
    if (!db) db = await connectDB();
    const def = TENANTS_DEMO[0];
    if (!empresaId) {
        const emp = await db.get('SELECT id FROM empresas WHERE slug = ?', [def.slug]);
        if (!emp) return;
        empresaId = emp.id;
    }
    await seedCitasSemanaActual(db, empresaId, def);
}


module.exports = {
    connectDB,
    seedInitialTenant,
    seedClientesSimulados
};

