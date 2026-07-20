/**
 * =====================================================================
 * server.js — Servidor Backend Principal de Samambaia Spa
 * =====================================================================
 * Proyecto Productivo SENA — Formato GFPI-F-144
 * 
 * DESCRIPCIÓN:
 * Este archivo implementa el servidor backend utilizando Node.js y Express.js.
 * Simula una base de datos relacional en memoria mediante arreglos globales
 * para las entidades: Usuarios, Servicios y Citas.
 * 
 * ARQUITECTURA:
 * - Patrón MVC simplificado (Modelo en memoria + Controlador en rutas)
 * - API RESTful con validaciones de lógica de negocio
 * - Control de cruce de agendas (evita duplicidad de horarios)
 * 
 * AUTOR: Samambaia Dev Team
 * FECHA: Mayo 2026
 * =====================================================================
 */

// =====================================================================
// VARIABLES DE ENTORNO (debe cargarse PRIMERO, antes de todo lo demás)
// En producción (Render/Railway), estas variables se configuran en el
// panel de control del proveedor cloud. Localmente se leen desde '.env'.
// =====================================================================
require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Importar módulo de base de datos para migración Multi-Empresa SaaS
const { connectDB, seedInitialTenant } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;


// =====================================================================
// 1. BASE DE DATOS SIMULADA EN MEMORIA (Arreglos Globales)
// =====================================================================
// NOTA EDUCATIVA:
// En un proyecto de producción real, estas estructuras se reemplazarían
// por tablas en un motor de bases de datos como MySQL, PostgreSQL o MongoDB.
// Aquí usamos arreglos (arrays) de JavaScript para simular el comportamiento
// de una base de datos relacional con sus respectivas tablas.
// =====================================================================

/**
 * TABLA: usuarios
 * Registra los datos personales de cada cliente que agenda una cita.
 * Campos: id, nombre, telefono, edad, genero, fechaRegistro
 */
const usuarios = [];

/**
 * TABLA: servicios
 * Catálogo fijo de servicios ofrecidos por Samambaia Spa.
 * Cada servicio tiene un identificador único, nombre descriptivo,
 * categoría, precio en pesos colombianos (COP) y duración en minutos.
 * 
 * NOTA: Este catálogo refleja los servicios reales de SamambaiaSpa
 * y se carga como datos semilla (seed data) al iniciar el servidor.
 */
let servicios = [
    // --- CATEGORÍA: UÑAS ---
    {
        id: 1,
        nombre: 'Uñas Tradicional',
        categoria: 'Uñas',
        precio: 25000,
        duracion: 40,
        descripcion: 'Manicura clásica con esmaltado tradicional y cuidado profesional de cutículas.',
        ofertaDelDia: false,
        descuento: 0,
        precioEspecial: 0
    },
    {
        id: 2,
        nombre: 'Uñas Acrílicas',
        categoria: 'Uñas',
        precio: 55000,
        duracion: 90,
        descripcion: 'Extensión y esculpido de uñas acrílicas con diseño personalizado.',
        ofertaDelDia: false,
        descuento: 0,
        precioEspecial: 0
    },
    {
        id: 3,
        nombre: 'Semi-permanente',
        categoria: 'Uñas',
        precio: 35000,
        duracion: 50,
        descripcion: 'Esmaltado semi-permanente con secado UV, duración de hasta 3 semanas.',
        ofertaDelDia: false,
        descuento: 15, // 15% OFF
        precioEspecial: 0
    },
    {
        id: 4,
        nombre: 'Poly Gel',
        categoria: 'Uñas',
        precio: 60000,
        duracion: 80,
        descripcion: 'Técnica de extensión con Poly Gel: ligera, flexible y de acabado natural.',
        ofertaDelDia: false,
        descuento: 0,
        precioEspecial: 0
    },
    {
        id: 5,
        nombre: 'Press-On',
        categoria: 'Uñas',
        precio: 30000,
        duracion: 30,
        descripcion: 'Uñas postizas Press-On personalizadas, rápidas y reutilizables.',
        ofertaDelDia: false,
        descuento: 0,
        precioEspecial: 0
    },
    // --- CATEGORÍA: TRATAMIENTOS ---
    {
        id: 6,
        nombre: 'Tratamiento Facial',
        categoria: 'Tratamientos',
        precio: 65000,
        duracion: 45,
        descripcion: 'Limpieza profunda, exfoliación e hidratación facial con productos naturales.',
        ofertaDelDia: true,
        descuento: 0,
        precioEspecial: 50000 // Precio especial manual
    },
    {
        id: 7,
        nombre: 'Masaje Relajante',
        categoria: 'Relajación',
        precio: 85000,
        duracion: 60,
        descripcion: 'Masaje de cuerpo completo con técnica de presión profunda para aliviar tensión.',
        ofertaDelDia: true,
        descuento: 10, // 10% OFF
        precioEspecial: 0
    },
    {
        id: 8,
        nombre: 'Depilación con Cera',
        categoria: 'Tratamientos',
        precio: 40000,
        duracion: 35,
        descripcion: 'Depilación profesional con cera tibia para diferentes zonas del cuerpo.',
        ofertaDelDia: false,
        descuento: 0,
        precioEspecial: 0
    }
];

/**
 * TABLA: citas
 * Almacena cada cita agendada, cruzando la referencia del cliente (usuarioId)
 * con el servicio seleccionado (servicioId), la fecha y la hora.
 * 
 * LÓGICA DE NEGOCIO CLAVE:
 * No se permiten dos citas en la misma fecha y hora para evitar cruce de agendas.
 */
const citas = [];

/**
 * TABLA: configuracionHorario
 * Configuración del horario de atención semanal. 0 = Domingo, 1 = Lunes, etc.
 */
const configuracionHorario = {
    1: { activo: true, inicio: '08:00', fin: '19:00' }, // Lunes
    2: { activo: true, inicio: '08:00', fin: '19:00' }, // Martes
    3: { activo: true, inicio: '08:00', fin: '19:00' }, // Miércoles
    4: { activo: true, inicio: '08:00', fin: '19:00' }, // Jueves
    5: { activo: true, inicio: '08:00', fin: '19:00' }, // Viernes
    6: { activo: true, inicio: '08:00', fin: '19:00' }, // Sábado
    0: { activo: false, inicio: '08:00', fin: '19:00' } // Domingo
};

/**
 * TABLA: bloqueos
 * Almacena días festivos o descansos que la administradora bloquea manualmente.
 * Estructura: { id, fecha, tipo: 'dia'|'franja', hora, duracion, descripcion }
 */
const bloqueos = [];
let contadorBloqueos = 1;

// NUEVO: Automatización de recordatorios
const configuracionAutomatizacion = {
    recordatoriosActivos: false,
    webhookUrl: ''
};
const historialRecordatorios = [];

// NUEVO: Automatización de Google Calendar (Sincronización Bidireccional)
const configuracionGoogleCalendar = {
    syncActiva: false,
    calendarId: '',
    serviceAccountKey: ''
};

// NUEVO: Excepciones de apertura especial (para habilitar o cambiar horarios en fechas específicas)
const aperturas = [];
let contadorAperturas = 1;

/**
 * Contador autoincremental para generar IDs únicos de usuarios.
 * Simula el comportamiento de AUTO_INCREMENT en SQL.
 */
let contadorUsuarios = 1;

/**
 * Contador autoincremental para generar IDs únicos de citas.
 */
let contadorCitas = 1;

// =====================================================================
// FUNCIONES AUXILIARES DE TIEMPO
// =====================================================================

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function getHorarioOperacion(fechaStr, db, empresaId) {
    // 1. Verificar si hay una excepción de apertura para esta fecha específica
    const excepcion = await db.get('SELECT activo, inicio, fin FROM aperturas WHERE fecha = ? AND empresa_id = ?', [fechaStr, empresaId]);
    if (excepcion) {
        return { activo: !!excepcion.activo, inicio: excepcion.inicio, fin: excepcion.fin };
    }
    // 2. Si no hay excepción, usar el horario semanal estándar
    const [year, month, day] = fechaStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    
    const config = await db.get('SELECT activo, inicio, fin FROM configuracion_horario WHERE dia_semana = ? AND empresa_id = ?', [dayOfWeek, empresaId]);
    
    if (config) {
        return { activo: !!config.activo, inicio: config.inicio, fin: config.fin };
    }
    return { activo: false, inicio: '08:00', fin: '19:00' };
}

function obtenerPrecioFinal(s, fechaCita) {
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const fechaAUsar = fechaCita || hoyStr;
    
    let aplicarPromo = false;

    // 1. Es oferta del día y la fecha es hoy
    if (s.ofertaDelDia && fechaAUsar === hoyStr) {
        aplicarPromo = true;
    } 
    // 2. Tiene rango de fechas y la fecha cae dentro del rango
    else if (s.ofertaInicio && s.ofertaFin) {
        if (fechaAUsar >= s.ofertaInicio && fechaAUsar <= s.ofertaFin) {
            aplicarPromo = true;
        }
    } 
    // 3. Es un descuento permanente (sin flag de dia ni rango)
    else if (!s.ofertaDelDia && !s.ofertaInicio) {
        aplicarPromo = true;
    }
    
    if (aplicarPromo) {
        if (s.precioEspecial && s.precioEspecial > 0) {
            return s.precioEspecial;
        }
        if (s.descuento && s.descuento > 0) {
            return Math.round(s.precio * (1 - s.descuento / 100));
        }
    }
    return s.precio;
}

async function verificarDisponibilidadServicio(fecha, horaInicioStr, duracionMinutos, db, empresaId) {
    const config = await getHorarioOperacion(fecha, db, empresaId);
    if (!config.activo) return false;
    
    const esDiaBloqueado = await db.get("SELECT id FROM bloqueos WHERE fecha = ? AND tipo = 'dia' AND empresa_id = ?", [fecha, empresaId]);
    if (esDiaBloqueado) return false;
    
    const startMin = timeToMinutes(horaInicioStr);
    const endMin = startMin + duracionMinutos;
    
    const dayStartMin = timeToMinutes(config.inicio);
    const dayEndMin = timeToMinutes(config.fin);
    
    if (startMin < dayStartMin || endMin > dayEndMin) {
        return false; // Fuera del horario de atención del día
    }
    
    // Validar conflicto con citas existentes
    const citas = await db.all("SELECT hora, duracion FROM citas WHERE fecha = ? AND estado != 'Cancelada' AND empresa_id = ?", [fecha, empresaId]);
    const tieneCita = citas.some(c => {
        const cStart = timeToMinutes(c.hora);
        const cEnd = cStart + c.duracion;
        // Solapamiento: start1 < end2 && start2 < end1
        return startMin < cEnd && cStart < endMin;
    });
    if (tieneCita) return false;
    
    // Validar conflicto con bloqueos manuales de franja
    const bloqueosFranja = await db.all("SELECT hora, duracion FROM bloqueos WHERE fecha = ? AND tipo = 'franja' AND empresa_id = ?", [fecha, empresaId]);
    const tieneBloqueo = bloqueosFranja.some(b => {
        const bStart = timeToMinutes(b.hora);
        const bEnd = bStart + b.duracion;
        return startMin < bEnd && bStart < endMin;
    });
    if (tieneBloqueo) return false;
    
    return true;
}


// =====================================================================
// 2. MIDDLEWARES (Capas de procesamiento intermedio)
// =====================================================================

// Middleware para parsear el cuerpo de las peticiones en formato JSON
app.use(express.json());

// Middleware para parsear datos enviados mediante formularios URL-encoded
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Frontend desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================================
// HEALTH CHECK — Requerido por Render, Railway y otros hostings cloud
// =====================================================================
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware to resolve tenant/empresa slug and attach to request
async function tenantResolver(req, res, next) {
    const slug = req.headers['x-tenant-slug'] || req.query.tenant || 'samambaia';
    
    if (req.path.startsWith('/superadmin')) {
        const { connectDB } = require('./database');
        req.db = await connectDB();
        return next();
    }
    
    try {
        const { connectDB } = require('./database');
        const db = await connectDB();
        const empresa = await db.get('SELECT * FROM empresas WHERE slug = ?', [slug]);
        if (!empresa) {
            return res.status(404).json({ ok: false, mensaje: `Empresa con slug "${slug}" no encontrada.` });
        }
        req.empresa = empresa;
        req.db = db;
        next();
    } catch (err) {
        console.error('Error resolving tenant:', err.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al resolver la empresa.' });
    }
}

// Middleware to authorize admin requests
async function adminAuthMiddleware(req, res, next) {
    if (req.path === '/login') {
        return next();
    }
    
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
        return res.status(401).json({ ok: false, mensaje: 'No autorizado. Se requiere token.' });
    }
    
    try {
        const admins = await req.db.all('SELECT usuario FROM administradores WHERE empresa_id = ?', [req.empresa.id]);
        const isValid = admins.some(adm => {
            const expectedToken = crypto.createHash('sha256').update(`${adm.usuario}-${req.empresa.slug}-secret`).digest('hex');
            return token === expectedToken;
        });
        
        if (isValid) {
            next();
        } else {
            return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado.' });
        }
    } catch (err) {
        console.error('Admin auth error:', err.message);
        return res.status(500).json({ ok: false, mensaje: 'Error de autenticación.' });
    }
}

app.use('/api/', tenantResolver);
app.use('/api/admin/', adminAuthMiddleware);
app.use('/api/citas', (req, res, next) => {
    if (req.method === 'GET') {
        return adminAuthMiddleware(req, res, next);
    }
    next();
});

// Enrutamiento Dinámico de Clientes (Tenants)
app.get('/', (req, res) => {
    res.redirect('/samambaia/');
});

app.get('/:empresaSlug/', async (req, res) => {
    const { empresaSlug } = req.params;
    const { connectDB } = require('./database');
    const db = await connectDB();
    const empresa = await db.get('SELECT id FROM empresas WHERE slug = ?', [empresaSlug]);
    if (!empresa) {
        return res.status(404).send('Empresa no encontrada');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:empresaSlug/dashboard', async (req, res) => {
    const { empresaSlug } = req.params;
    const { connectDB } = require('./database');
    const db = await connectDB();
    const empresa = await db.get('SELECT id FROM empresas WHERE slug = ?', [empresaSlug]);
    if (!empresa) {
        return res.status(404).send('Empresa no encontrada');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/:empresaSlug/admin', async (req, res) => {
    const { empresaSlug } = req.params;
    res.redirect(`/${empresaSlug}/dashboard`);
});

app.get('/:empresaSlug', async (req, res, next) => {
    const { empresaSlug } = req.params;
    const reserved = ['api', 'superadmin', 'css', 'js', 'images', 'favicon.ico'];
    if (reserved.includes(empresaSlug)) {
        return next();
    }
    const { connectDB } = require('./database');
    const db = await connectDB();
    const empresa = await db.get('SELECT id FROM empresas WHERE slug = ?', [empresaSlug]);
    if (!empresa) {
        return res.status(404).send('Empresa no encontrada');
    }
    res.redirect(`/${empresaSlug}/`);
});


// =====================================================================
// 3. RUTAS DE LA API (ENDPOINTS RESTful)
// =====================================================================

/**
 * @route   POST /api/admin/login
 * @desc    Inicio de sesión para administradores de una empresa
 * @access  Público
 */
app.post('/api/admin/login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ ok: false, mensaje: 'Usuario y contraseña obligatorios.' });
    }
    
    try {
        const admin = await req.db.get('SELECT * FROM administradores WHERE empresa_id = ? AND usuario = ?', [req.empresa.id, usuario]);
        if (!admin || admin.password !== password) {
            return res.status(401).json({ ok: false, mensaje: 'Usuario o contraseña incorrectos.' });
        }
        
        const token = crypto.createHash('sha256').update(`${usuario}-${req.empresa.slug}-secret`).digest('hex');
        
        return res.json({
            ok: true,
            token,
            mensaje: 'Inicio de sesión exitoso.'
        });
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al procesar el inicio de sesión.' });
    }
});

/**
 * @route   GET /api/servicios
 * @desc    Obtener todos los servicios del catálogo
 * @access  Público
 */
app.get('/api/servicios', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;
        
        const rows = await db.all('SELECT * FROM servicios WHERE empresa_id = ?', [empresa.id]);
        
        // Mapear campos de snake_case a camelCase para no romper el frontend
        const serviciosDB = rows.map(r => ({
            id: r.id,
            nombre: r.nombre,
            categoria: r.categoria,
            duracion: r.duracion,
            precio: r.precio,
            descripcion: r.descripcion,
            ofertaDelDia: !!r.oferta_del_dia,
            ofertaInicio: r.oferta_inicio,
            ofertaFin: r.oferta_fin,
            descuento: r.descuento,
            precioEspecial: r.precio_especial
        }));

        res.json({ ok: true, datos: serviciosDB, totalServicios: serviciosDB.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al consultar la base de datos' });
    }
});

/**
 * @route   POST /api/admin/servicios
 * @desc    Crea un nuevo servicio en el catálogo.
 * @access  Privado (Admin)
 */
app.post('/api/admin/servicios', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const { nombre, categoria, precio, duracion, descripcion, ofertaDelDia, ofertaInicio, ofertaFin, descuento, precioEspecial } = req.body;
        
        if (!nombre || !categoria || !precio || !duracion) {
            return res.status(400).json({ ok: false, mensaje: 'Faltan campos obligatorios para el servicio.' });
        }
        
        const result = await db.run(`
            INSERT INTO servicios (empresa_id, nombre, categoria, duracion, precio, descripcion, oferta_del_dia, oferta_inicio, oferta_fin, descuento, precio_especial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            empresa.id, nombre, categoria, duracion, precio, descripcion || '', 
            ofertaDelDia ? 1 : 0, ofertaInicio || null, ofertaFin || null, 
            descuento || 0, precioEspecial || 0
        ]);
        
        return res.status(201).json({
            ok: true,
            mensaje: 'Servicio creado exitosamente.',
            datos: { id: result.lastID, nombre, categoria, duracion, precio }
        });
    } catch (error) {
        console.error('❌ [POST /api/admin/servicios] Error interno:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al crear el servicio en la base de datos.' });
    }
});

/**
 * @route   PUT /api/admin/servicios/:id
 * @desc    Edita un servicio existente.
 * @access  Privado (Admin)
 */
app.put('/api/admin/servicios/:id', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const { id } = req.params;
        const { nombre, categoria, precio, duracion, descripcion, ofertaDelDia, ofertaInicio, ofertaFin, descuento, precioEspecial } = req.body;
        
        if (!nombre || !categoria || !precio || !duracion) {
            return res.status(400).json({ ok: false, mensaje: 'Faltan campos obligatorios para el servicio.' });
        }
        
        const result = await db.run(`
            UPDATE servicios 
            SET nombre = ?, categoria = ?, duracion = ?, precio = ?, descripcion = ?, 
                oferta_del_dia = ?, oferta_inicio = ?, oferta_fin = ?, descuento = ?, precio_especial = ?
            WHERE id = ? AND empresa_id = ?
        `, [
            nombre, categoria, duracion, precio, descripcion || '', 
            ofertaDelDia ? 1 : 0, ofertaInicio || null, ofertaFin || null, 
            descuento || 0, precioEspecial || 0,
            id, empresa.id
        ]);
        
        if (result.changes === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Servicio no encontrado o no pertenece a esta empresa.' });
        }
        
        return res.status(200).json({
            ok: true,
            mensaje: 'Servicio actualizado exitosamente.'
        });
    } catch (error) {
        console.error(`❌ [PUT /api/admin/servicios/${req.params.id}] Error:`, error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al actualizar el servicio en la base de datos.' });
    }
});

/**
 * @route   DELETE /api/admin/servicios/:id
 * @desc    Elimina un servicio del catálogo.
 * @access  Privado (Admin)
 */
app.delete('/api/admin/servicios/:id', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const { id } = req.params;
        
        const result = await db.run('DELETE FROM servicios WHERE id = ? AND empresa_id = ?', [id, empresa.id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Servicio no encontrado o no pertenece a esta empresa.' });
        }
        
        return res.status(200).json({
            ok: true,
            mensaje: 'Servicio eliminado exitosamente.'
        });
    } catch (error) {
        console.error(`❌ [DELETE /api/admin/servicios/${req.params.id}] Error:`, error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor al eliminar el servicio.' });
    }
});


/**
 * @route   POST /api/crear-cita
 * @desc    Registra y agenda una nueva cita de bienestar.
 *          Implementa validación de cruce de agendas.
 * @access  Público
 */
app.post('/api/crear-cita', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const { nombre, telefono, edad, genero, servicioId, fecha, hora } = req.body;

        console.log('\n📩 [POST /api/crear-cita] Nueva solicitud de cita recibida:');
        console.log(`   Datos: ${JSON.stringify(req.body)}`);

        // --- Validación de campos obligatorios ---
        if (!nombre || !telefono || !servicioId || !fecha || !hora) {
            console.warn('⚠️ Campos obligatorios faltantes en la solicitud.');
            return res.status(400).json({
                ok: false,
                mensaje: 'Todos los campos obligatorios deben ser completados: nombre, teléfono, servicio, fecha y hora.'
            });
        }

        // --- Validar que el servicio exista en el catálogo (DB) ---
        const servicioRow = await db.get('SELECT * FROM servicios WHERE id = ? AND empresa_id = ?', [parseInt(servicioId), empresa.id]);

        if (!servicioRow) {
            console.warn(`⚠️ Servicio con ID "${servicioId}" no encontrado en el catálogo.`);
            return res.status(400).json({
                ok: false,
                mensaje: `El servicio seleccionado (ID: ${servicioId}) no existe en nuestro catálogo.`
            });
        }

        // Mapear a formato camelCase
        const servicioEncontrado = {
            id: servicioRow.id, nombre: servicioRow.nombre, categoria: servicioRow.categoria,
            duracion: servicioRow.duracion, precio: servicioRow.precio,
            ofertaDelDia: !!servicioRow.oferta_del_dia, ofertaInicio: servicioRow.oferta_inicio,
            ofertaFin: servicioRow.oferta_fin, descuento: servicioRow.descuento,
            precioEspecial: servicioRow.precio_especial
        };

        // --- CONTROL DE CRUCE DE AGENDAS CON DURACIÓN Y BLOQUEOS (DB) ---
        const disponible = await verificarDisponibilidadServicio(fecha, hora, servicioEncontrado.duracion, db, empresa.id);

        if (!disponible) {
            console.warn(`🚫 HORARIO NO DISPONIBLE: ${fecha} a las ${hora} para duración ${servicioEncontrado.duracion} min.`);
            return res.status(409).json({
                ok: false,
                mensaje: `El horario solicitado (${fecha} a las ${hora}) no está disponible para un servicio de ${servicioEncontrado.duracion} minutos (ya está ocupado, bloqueado o excede el horario de atención). Por favor, elige otra hora o fecha.`
            });
        }

        // --- Registrar o reutilizar el usuario (DB) ---
        let usuario = await db.get('SELECT * FROM usuarios WHERE telefono = ? AND empresa_id = ?', [telefono.trim(), empresa.id]);

        if (!usuario) {
            const resUsuario = await db.run(`
                INSERT INTO usuarios (empresa_id, nombre, telefono, edad, genero) VALUES (?, ?, ?, ?, ?)
            `, [empresa.id, nombre.trim(), telefono.trim(), edad ? parseInt(edad) : null, genero || null]);
            usuario = { id: resUsuario.lastID, nombre: nombre.trim(), telefono: telefono.trim() };
            console.log(`👤 Nuevo usuario registrado: ${usuario.nombre} (ID: ${usuario.id})`);
        } else {
            await db.run('UPDATE usuarios SET nombre = ? WHERE id = ?', [nombre.trim(), usuario.id]);
            usuario.nombre = nombre.trim();
            console.log(`👤 Usuario existente identificado: ${usuario.nombre} (ID: ${usuario.id})`);
        }

        // --- Generar ID público de la cita ---
        const prefijo = empresa.slug.substring(0, 3).toUpperCase();
        const countRow = await db.get('SELECT COUNT(*) as total FROM citas WHERE empresa_id = ?', [empresa.id]);
        const idCita = `${prefijo}-${String((countRow.total || 0) + 1).padStart(4, '0')}`;
        
        const precioFinal = obtenerPrecioFinal(servicioEncontrado, fecha);

        // --- Insertar la cita en la base de datos ---
        await db.run(`
            INSERT INTO citas (id_publico, empresa_id, usuario_id, servicio_id, fecha, hora, estado, precio_cobrado, duracion)
            VALUES (?, ?, ?, ?, ?, ?, 'Confirmada', ?, ?)
        `, [idCita, empresa.id, usuario.id, servicioEncontrado.id, fecha, hora, precioFinal, servicioEncontrado.duracion]);

        const nuevaCita = {
            idCita, usuarioId: usuario.id, cliente: usuario.nombre,
            telefono: usuario.telefono, servicioId: servicioEncontrado.id,
            servicio: servicioEncontrado.nombre, categoria: servicioEncontrado.categoria,
            precio: precioFinal, duracion: servicioEncontrado.duracion,
            fecha, hora, estado: 'Confirmada'
        };

        // Sincronización automática en segundo plano (Google Calendar y Webhook)
        const config = await getConfiguracionEmpresa(db, empresa.id);
        registrarEventoGoogleCalendar(nuevaCita, config);
        if (config.webhookUrl) {
            dispararWebhook('appointment.created', nuevaCita, config.webhookUrl);
        }

        console.log('\n==================================================');
        console.log('💜 NUEVA CITA REGISTRADA (BASE DE DATOS)');
        console.log('==================================================');
        console.log(`ID Cita:     ${nuevaCita.idCita}`);
        console.log(`Cliente:     ${nuevaCita.cliente} (ID: ${nuevaCita.usuarioId})`);
        console.log(`Servicio:    ${nuevaCita.servicio} [${nuevaCita.categoria}]`);
        console.log(`Precio:      $${nuevaCita.precio.toLocaleString('es-CO')} COP`);
        console.log(`Duración:    ${nuevaCita.duracion} min`);
        console.log(`Fecha Cita:  ${nuevaCita.fecha} a las ${nuevaCita.hora}`);
        console.log('==================================================\n');

        return res.status(201).json({
            ok: true,
            mensaje: '¡Tu cita ha sido agendada con éxito! Te esperamos.',
            datos: {
                idCita: nuevaCita.idCita,
                nombre: nuevaCita.cliente,
                servicio: nuevaCita.servicio,
                categoria: nuevaCita.categoria,
                precio: nuevaCita.precio,
                duracion: nuevaCita.duracion,
                fecha: nuevaCita.fecha,
                hora: nuevaCita.hora,
                estado: nuevaCita.estado
            }
        });

    } catch (error) {
        console.error('❌ [POST /api/crear-cita] Error interno:', error.message);
        return res.status(500).json({
            ok: false,
            mensaje: 'Ocurrió un error inesperado en el servidor. Por favor, inténtalo nuevamente.'
        });
    }
});


/**
 * @route   GET /api/horarios-disponibles
 * @desc    Devuelve las franjas horarias de 30 min indicando disponibilidad.
 * @access  Público
 */
app.get('/api/horarios-disponibles', async (req, res) => {
    const { fecha, servicioId } = req.query;
    if (!fecha) {
        return res.status(400).json({ ok: false, mensaje: 'La fecha es requerida.' });
    }
    
    try {
        const db = req.db;
        const empresa = req.empresa;

        const config = await getHorarioOperacion(fecha, db, empresa.id);
        if (!config.activo) {
            return res.status(200).json({ ok: true, activo: false, datos: [] });
        }
        
        let duracion = 30;
        if (servicioId) {
            const serv = await db.get('SELECT duracion FROM servicios WHERE id = ? AND empresa_id = ?', [parseInt(servicioId), empresa.id]);
            if (serv) duracion = serv.duracion;
        }
        
        const startMin = timeToMinutes(config.inicio);
        const endMin = timeToMinutes(config.fin);
        const slots = [];
        
        const esDiaBloqueado = await db.get("SELECT id, descripcion FROM bloqueos WHERE fecha = ? AND tipo = 'dia' AND empresa_id = ?", [fecha, empresa.id]);
        
        // Pre-cargar citas y bloqueos de franja del día para no hacer N queries
        const citasDelDia = await db.all(`
            SELECT c.id_publico, c.hora, c.duracion, u.nombre AS cliente, s.nombre AS servicio 
            FROM citas c 
            JOIN usuarios u ON c.usuario_id = u.id 
            JOIN servicios s ON c.servicio_id = s.id 
            WHERE c.fecha = ? AND c.estado != 'Cancelada' AND c.empresa_id = ?
        `, [fecha, empresa.id]);
        
        const bloqueosDelDia = await db.all("SELECT id, hora, duracion, descripcion FROM bloqueos WHERE fecha = ? AND tipo = 'franja' AND empresa_id = ?", [fecha, empresa.id]);
        
        for (let m = startMin; m < endMin; m += 30) {
            const hora = minutesToTime(m);
            let estado = 'disponible';
            let detalle = '';
            let bloqueoId = null;
            let citaId = null;
            
            if (esDiaBloqueado) {
                estado = 'bloqueado';
                detalle = esDiaBloqueado.descripcion || 'Día completo bloqueado';
                bloqueoId = esDiaBloqueado.id;
            } else {
                // Verificar si hay cita
                const citaConflicto = citasDelDia.find(c => {
                    const cStart = timeToMinutes(c.hora);
                    const cEnd = cStart + c.duracion;
                    return m >= cStart && m < cEnd;
                });
                
                if (citaConflicto) {
                    estado = 'ocupado';
                    detalle = `${citaConflicto.cliente} (${citaConflicto.servicio})`;
                    citaId = citaConflicto.id_publico;
                } else {
                    // Verificar si está bloqueado por franja
                    const bloqueoConflicto = bloqueosDelDia.find(b => {
                        const bStart = timeToMinutes(b.hora);
                        const bEnd = bStart + b.duracion;
                        return m >= bStart && m < bEnd;
                    });
                    
                    if (bloqueoConflicto) {
                        estado = 'bloqueado';
                        detalle = bloqueoConflicto.descripcion;
                        bloqueoId = bloqueoConflicto.id;
                    }
                }
            }
            
            // Verificar si este slot permite reservar el servicio completo
            const reservable = await verificarDisponibilidadServicio(fecha, hora, duracion, db, empresa.id);
            
            slots.push({
                hora,
                estado,
                reservable,
                detalle,
                bloqueoId,
                citaId
            });
        }
        
        return res.status(200).json({
            ok: true,
            activo: true,
            datos: slots
        });
    } catch (error) {
        console.error('❌ [GET /api/horarios-disponibles] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al consultar horarios.' });
    }
});

function getDatesOfWeek(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Dom, 1 = Lun, etc.
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
}

/**
 * @route   GET /api/calendario-semana
 * @desc    Obtiene citas y bloqueos de la semana para una fecha dada.
 * @access  Público / Admin
 */
app.get('/api/calendario-semana', async (req, res) => {
    const { fecha } = req.query;
    if (!fecha) {
        return res.status(400).json({ ok: false, mensaje: 'La fecha de referencia es requerida.' });
    }
    
    try {
        const db = req.db;
        const empresa = req.empresa;

        const fechas = getDatesOfWeek(fecha);
        const startOfWeekStr = fechas[0] + 'T00:00:00Z';
        const endOfWeekStr = fechas[6] + 'T23:59:59Z';

        // Consultar citas de la semana desde la DB
        const placeholders = fechas.map(() => '?').join(',');
        const citasRows = await db.all(`
            SELECT c.id_publico AS idCita, c.fecha, c.hora, c.duracion, c.estado, c.precio_cobrado AS precio,
                   u.id AS usuarioId, u.nombre AS cliente, u.telefono,
                   s.id AS servicioId, s.nombre AS servicio, s.categoria
            FROM citas c
            JOIN usuarios u ON c.usuario_id = u.id
            JOIN servicios s ON c.servicio_id = s.id
            WHERE c.fecha IN (${placeholders}) AND c.estado != 'Cancelada' AND c.empresa_id = ?
        `, [...fechas, empresa.id]);
        
        let bloqueosSemana = await db.all(`
            SELECT * FROM bloqueos WHERE fecha IN (${placeholders}) AND empresa_id = ?
        `, [...fechas, empresa.id]);
        
        // --- REAL-TIME BI-DIRECTIONAL GOOGLE CALENDAR SYNC ---
        const config = await getConfiguracionEmpresa(db, empresa.id);
        if (config.syncActiva && config.calendarId && config.serviceAccountKey) {
            try {
                const externalEvents = await obtenerEventosGoogleCalendar(startOfWeekStr, endOfWeekStr, config);
                
                for (const evt of externalEvents) {
                    const esEventoPropio = citasRows.some(c => c.idCita && evt.description && evt.description.includes(c.idCita));
                    if (esEventoPropio) continue;
                    
                    const startDateTime = evt.start.dateTime || evt.start.date;
                    const endDateTime = evt.end.dateTime || evt.end.date;
                    if (!startDateTime) continue;
                    
                    const dateObj = new Date(startDateTime);
                    const yyyy = dateObj.getFullYear();
                    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(dateObj.getDate()).padStart(2, '0');
                    const fechaLocal = `${yyyy}-${mm}-${dd}`;
                    
                    if (!fechas.includes(fechaLocal)) continue;
                    
                    const horaLocal = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                    const dateEndObj = new Date(endDateTime);
                    const duracionMin = Math.round((dateEndObj.getTime() - dateObj.getTime()) / (1000 * 60));
                    
                    bloqueosSemana.push({
                        id: `gcal-${evt.id}`, tipo: 'franja', fecha: fechaLocal,
                        hora: horaLocal, duracion: duracionMin,
                        descripcion: evt.summary || 'Bloqueo Google Calendar'
                    });
                }
            } catch (gcalErr) {
                console.error('⚠️ Error al consultar eventos en Google Calendar:', gcalErr.message);
            }
        }

        // Obtener horarios de cada fecha de la semana (async)
        const horariosFechas = {};
        const configHorarioObj = {};
        const horariosDB = await db.all('SELECT dia_semana, activo, inicio, fin FROM configuracion_horario WHERE empresa_id = ?', [empresa.id]);
        for (const h of horariosDB) {
            configHorarioObj[h.dia_semana] = { activo: !!h.activo, inicio: h.inicio, fin: h.fin };
        }
        for (const f of fechas) {
            horariosFechas[f] = await getHorarioOperacion(f, db, empresa.id);
        }

        return res.status(200).json({
            ok: true,
            datos: {
                fechas,
                citas: citasRows,
                bloqueos: bloqueosSemana,
                configuracionHorario: configHorarioObj,
                horariosFechas
            }
        });
    } catch (error) {
        console.error('❌ [GET /api/calendario-semana] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al consultar calendario semanal.' });
    }
});

/**
 * @route   DELETE /api/citas/:idCita
 * @desc    Elimina/Cancela una cita de la agenda.
 * @access  Público / Admin
 */
app.delete('/api/citas/:idCita', async (req, res) => {
    const { idCita } = req.params;
    try {
        const db = req.db;
        const empresa = req.empresa;

        // Buscar la cita con datos del cliente
        const cita = await db.get(`
            SELECT c.id, c.id_publico AS idCita, c.fecha, c.hora, c.duracion, c.precio_cobrado AS precio,
                   u.nombre AS cliente, u.telefono, s.nombre AS servicio
            FROM citas c
            JOIN usuarios u ON c.usuario_id = u.id
            JOIN servicios s ON c.servicio_id = s.id
            WHERE c.id_publico = ? AND c.empresa_id = ?
        `, [idCita, empresa.id]);
        
        if (!cita) {
            return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada.' });
        }
        
        await db.run('DELETE FROM citas WHERE id = ?', [cita.id]);
        console.log(`🗑️ Cita cancelada: ${idCita} de ${cita.cliente}`);
        
        // Sincronización automática de cancelación en segundo plano
        const config = await getConfiguracionEmpresa(db, empresa.id);
        eliminarEventoGoogleCalendar(cita, config);
        if (config.webhookUrl) {
            dispararWebhook('appointment.deleted', cita, config.webhookUrl);
        }
        
        return res.status(200).json({
            ok: true,
            mensaje: 'Cita cancelada exitosamente y horario liberado.'
        });
    } catch (error) {
        console.error('❌ [DELETE /api/citas/:id] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al cancelar la cita.' });
    }
});

/**
 * @route   POST /api/admin/bloquear
 * @desc    Registra un bloqueo manual de día o franja.
 * @access  Admin
 */
app.post('/api/admin/bloquear', async (req, res) => {
    const { tipo, fecha, hora, duracion, descripcion } = req.body;
    if (!fecha || !tipo) {
        return res.status(400).json({ ok: false, mensaje: 'Fecha y tipo son campos requeridos.' });
    }
    
    try {
        const db = req.db;
        const empresa = req.empresa;

        const result = await db.run(`
            INSERT INTO bloqueos (empresa_id, fecha, tipo, hora, duracion, descripcion)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            empresa.id, fecha, tipo,
            tipo === 'franja' ? hora : null,
            tipo === 'franja' ? parseInt(duracion || 30) : null,
            descripcion || (tipo === 'dia' ? 'Día bloqueado' : 'Franja bloqueada')
        ]);
        
        const nuevoBloqueo = { id: result.lastID, tipo, fecha, hora: tipo === 'franja' ? hora : null, duracion: tipo === 'franja' ? parseInt(duracion || 30) : null, descripcion: descripcion || (tipo === 'dia' ? 'Día bloqueado' : 'Franja bloqueada') };
        console.log(`🚫 Nuevo bloqueo registrado: ${JSON.stringify(nuevoBloqueo)}`);
        
        return res.status(201).json({ ok: true, mensaje: 'Bloqueo registrado correctamente.', datos: nuevoBloqueo });
    } catch (error) {
        console.error('❌ [POST /api/admin/bloquear] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al guardar el bloqueo.' });
    }
});

/**
 * @route   DELETE /api/admin/bloquear/:id
 * @desc    Elimina un bloqueo manual.
 * @access  Admin
 */
app.delete('/api/admin/bloquear/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const db = req.db;
        const empresa = req.empresa;

        const result = await db.run('DELETE FROM bloqueos WHERE id = ? AND empresa_id = ?', [id, empresa.id]);
        if (result.changes === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Bloqueo no encontrado.' });
        }
        
        console.log(`🔓 Bloqueo eliminado: ID ${id}`);
        return res.status(200).json({ ok: true, mensaje: 'El horario ha sido desbloqueado.' });
    } catch (error) {
        console.error('❌ [DELETE /api/admin/bloquear/:id] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al eliminar el bloqueo.' });
    }
});

/**
 * @route   GET /api/admin/aperturas
 * @desc    Obtiene el listado de todas las aperturas especiales de fechas.
 * @access  Admin
 */
app.get('/api/admin/aperturas', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const rows = await db.all('SELECT * FROM aperturas WHERE empresa_id = ?', [empresa.id]);
        return res.status(200).json({ ok: true, datos: rows });
    } catch (error) {
        console.error('❌ [GET /api/admin/aperturas] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al obtener aperturas especiales.' });
    }
});

/**
 * @route   POST /api/admin/aperturas
 * @desc    Crea o modifica una apertura especial para una fecha específica.
 * @access  Admin
 */
app.post('/api/admin/aperturas', async (req, res) => {
    const { fecha, inicio, fin, descripcion } = req.body;
    if (!fecha || !inicio || !fin) {
        return res.status(400).json({ ok: false, mensaje: 'Fecha, hora de inicio y hora de fin son requeridos.' });
    }

    try {
        const db = req.db;
        const empresa = req.empresa;

        // Buscar si ya existe una apertura para esta fecha
        const existing = await db.get('SELECT id FROM aperturas WHERE fecha = ? AND empresa_id = ?', [fecha, empresa.id]);
        
        let nuevaApertura;
        if (existing) {
            await db.run('UPDATE aperturas SET activo = 1, inicio = ?, fin = ?, descripcion = ? WHERE id = ?', 
                [inicio, fin, descripcion || 'Día Especial Habilitado', existing.id]);
            nuevaApertura = { id: existing.id, fecha, activo: true, inicio, fin, descripcion: descripcion || 'Día Especial Habilitado' };
            console.log(`🟢 Apertura especial actualizada: ${JSON.stringify(nuevaApertura)}`);
        } else {
            const result = await db.run(`
                INSERT INTO aperturas (empresa_id, fecha, activo, inicio, fin, descripcion) VALUES (?, ?, 1, ?, ?, ?)
            `, [empresa.id, fecha, inicio, fin, descripcion || 'Día Especial Habilitado']);
            nuevaApertura = { id: result.lastID, fecha, activo: true, inicio, fin, descripcion: descripcion || 'Día Especial Habilitado' };
            console.log(`🟢 Nueva apertura especial registrada: ${JSON.stringify(nuevaApertura)}`);
        }

        return res.status(201).json({ ok: true, mensaje: 'Apertura de día especial guardada correctamente.', datos: nuevaApertura });
    } catch (error) {
        console.error('❌ [POST /api/admin/aperturas] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al registrar la apertura especial.' });
    }
});

/**
 * @route   DELETE /api/admin/aperturas/:id
 * @desc    Elimina una apertura especial de fecha.
 * @access  Admin
 */
app.delete('/api/admin/aperturas/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const db = req.db;
        const empresa = req.empresa;

        const result = await db.run('DELETE FROM aperturas WHERE id = ? AND empresa_id = ?', [id, empresa.id]);
        if (result.changes === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Apertura no encontrada.' });
        }

        console.log(`🔓 Apertura especial eliminada: ID ${id}`);
        return res.status(200).json({ ok: true, mensaje: 'Apertura especial removida. El día ha vuelto a su horario semanal estándar.' });
    } catch (error) {
        console.error('❌ [DELETE /api/admin/aperturas/:id] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al eliminar la apertura.' });
    }
});

/**
 * @route   GET /api/admin/bloqueos
 * @desc    Obtiene el listado de todos los bloqueos manuales.
 * @access  Admin
 */
app.get('/api/admin/bloqueos', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const rows = await db.all('SELECT * FROM bloqueos WHERE empresa_id = ?', [empresa.id]);
        return res.status(200).json({ ok: true, datos: rows });
    } catch (error) {
        console.error('❌ [GET /api/admin/bloqueos] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al obtener bloqueos.' });
    }
});

/**
 * @route   GET /api/admin/configuracion-horario
 * @desc    Retorna la configuración semanal de horarios.
 * @access  Admin
 */
app.get('/api/admin/configuracion-horario', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const rows = await db.all('SELECT dia_semana, activo, inicio, fin FROM configuracion_horario WHERE empresa_id = ? ORDER BY dia_semana', [empresa.id]);
        const configObj = {};
        for (const r of rows) {
            configObj[r.dia_semana] = { activo: !!r.activo, inicio: r.inicio, fin: r.fin };
        }
        return res.status(200).json({ ok: true, datos: configObj });
    } catch (error) {
        console.error('❌ [GET /api/admin/configuracion-horario] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al obtener configuración.' });
    }
});

/**
 * @route   POST /api/admin/configurar-horario
 * @desc    Actualiza el horario para un día de la semana.
 * @access  Admin
 */
app.post('/api/admin/configurar-horario', async (req, res) => {
    const { dia, activo, inicio, fin } = req.body;
    if (dia === undefined || activo === undefined || !inicio || !fin) {
        return res.status(400).json({ ok: false, mensaje: 'Parámetros obligatorios faltantes: dia, activo, inicio, fin.' });
    }
    
    try {
        const db = req.db;
        const empresa = req.empresa;

        const numDia = parseInt(dia);
        await db.run(`
            INSERT INTO configuracion_horario (empresa_id, dia_semana, activo, inicio, fin)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(empresa_id, dia_semana) DO UPDATE SET activo = excluded.activo, inicio = excluded.inicio, fin = excluded.fin
        `, [empresa.id, numDia, activo ? 1 : 0, inicio, fin]);
        
        console.log(`⚙️ Horario actualizado para el día ${numDia}: Activo=${activo}, ${inicio}-${fin}`);
        return res.status(200).json({
            ok: true,
            mensaje: 'Horario actualizado exitosamente.',
            datos: { activo: !!activo, inicio, fin }
        });
    } catch (error) {
        console.error('❌ [POST /api/admin/configurar-horario] Error:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al actualizar configuración.' });
    }
});


/**
 * @route   GET /api/citas
 * @desc    Endpoint administrativo que lista todas las citas agendadas.
 * @access  Administrativo
 */
app.get('/api/citas', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const citasDB = await db.all(`
            SELECT c.id_publico AS idCita, c.fecha, c.hora, c.duracion, c.estado, c.precio_cobrado AS precio,
                   c.fecha_registro AS fechaRegistro,
                   u.id AS usuarioId, u.nombre AS cliente, u.telefono,
                   s.id AS servicioId, s.nombre AS servicio, s.categoria
            FROM citas c
            JOIN usuarios u ON c.usuario_id = u.id
            JOIN servicios s ON c.servicio_id = s.id
            WHERE c.empresa_id = ?
            ORDER BY c.fecha DESC, c.hora DESC
        `, [empresa.id]);

        const totalUsuarios = await db.get('SELECT COUNT(*) as total FROM usuarios WHERE empresa_id = ?', [empresa.id]);

        console.log(`📊 [GET /api/citas] Total de citas: ${citasDB.length}`);

        return res.status(200).json({
            ok: true,
            mensaje: 'Listado de citas obtenido exitosamente.',
            totalCitas: citasDB.length,
            totalUsuarios: totalUsuarios.total,
            datos: citasDB
        });
    } catch (error) {
        console.error('❌ [GET /api/citas] Error interno:', error.message);
        return res.status(500).json({
            ok: false,
            mensaje: 'Error interno del servidor al obtener las citas.'
        });
    }
});

/**
 * @route   GET /api/admin/automatizacion
 * @desc    Obtiene la configuración y el historial de automatización.
 * @access  Admin
 */
app.get('/api/admin/automatizacion', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;

        const config = await getConfiguracionEmpresa(db, empresa.id);
        const logsFiltrados = historialRecordatorios.filter(log => log.empresaId === empresa.id);

        return res.status(200).json({
            ok: true,
            datos: {
                configuracion: config,
                historial: logsFiltrados
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, mensaje: 'Error al obtener automatización.' });
    }
});

/**
 * @route   POST /api/admin/automatizacion
 * @desc    Guarda la configuración de la automatización.
 * @access  Admin
 */
app.post('/api/admin/automatizacion', async (req, res) => {
    const { recordatoriosActivos, webhookUrl } = req.body;
    if (recordatoriosActivos === undefined) {
        return res.status(400).json({ ok: false, mensaje: 'El campo recordatoriosActivos es requerido.' });
    }

    try {
        const db = req.db;
        const empresa = req.empresa;

        await db.run(`
            UPDATE configuracion_empresa 
            SET recordatorios_activos = ?, webhook_url = ? 
            WHERE empresa_id = ?
        `, [recordatoriosActivos ? 1 : 0, webhookUrl || '', empresa.id]);
        
        console.log(`🤖 Automatización actualizada para empresa ${empresa.slug}: Activo=${recordatoriosActivos}, Webhook=${webhookUrl}`);
        
        return res.status(200).json({
            ok: true,
            mensaje: 'Configuración de automatización guardada correctamente.',
            datos: { recordatoriosActivos: !!recordatoriosActivos, webhookUrl }
        });
    } catch (error) {
        console.error('Error al guardar automatización:', error.message);
        return res.status(500).json({ ok: false, mensaje: 'Error al actualizar automatización.' });
    }
});

// Helper to get company config from DB
async function getConfiguracionEmpresa(db, empresaId) {
    let config = await db.get('SELECT * FROM configuracion_empresa WHERE empresa_id = ?', [empresaId]);
    if (!config) {
        await db.run('INSERT OR IGNORE INTO configuracion_empresa (empresa_id) VALUES (?)', [empresaId]);
        config = await db.get('SELECT * FROM configuracion_empresa WHERE empresa_id = ?', [empresaId]);
    }
    return {
        recordatoriosActivos: !!config.recordatorios_activos,
        webhookUrl: config.webhook_url || '',
        syncActiva: !!config.gcal_sync_activa,
        calendarId: config.gcal_calendar_id || '',
        serviceAccountKey: config.gcal_service_key || ''
    };
}

async function verificarYEnviarRecordatoriosAutomaticos() {
    try {
        const { connectDB } = require('./database');
        const db = await connectDB();
        
        // Obtener todas las empresas
        const empresas = await db.all('SELECT * FROM empresas WHERE suscripcion_activa = 1');
        
        const ahora = new Date();
        
        for (const emp of empresas) {
            const config = await getConfiguracionEmpresa(db, emp.id);
            if (!config.recordatoriosActivos) continue;
            
            // Buscar citas que no tengan recordatorio enviado, que estén confirmadas
            const citasPendientes = await db.all(`
                SELECT c.id, c.id_publico AS idCita, c.fecha, c.hora, c.duracion, c.precio_cobrado AS precio,
                       u.nombre AS cliente, u.telefono, s.nombre AS servicio
                FROM citas c
                JOIN usuarios u ON c.usuario_id = u.id
                JOIN servicios s ON c.servicio_id = s.id
                WHERE c.empresa_id = ? AND c.estado = 'Confirmada' AND c.recordatorio_enviado = 0
            `, [emp.id]);
            
            for (const c of citasPendientes) {
                // Parse date and time
                const [y, m, d] = c.fecha.split('-').map(Number);
                const [h, min] = c.hora.split(':').map(Number);
                const fechaCita = new Date(y, m - 1, d, h, min);

                const diffMs = fechaCita.getTime() - ahora.getTime();
                const diffHoras = diffMs / (1000 * 60 * 60);

                // Si faltan entre 0 y 24 horas y no se ha enviado el recordatorio
                if (diffHoras > 0 && diffHoras <= 24) {
                    await db.run('UPDATE citas SET recordatorio_enviado = 1 WHERE id = ?', [c.id]);
                    
                    const logId = historialRecordatorios.length + 1;
                    const logEntry = {
                        id: logId,
                        empresaId: emp.id,
                        idCita: c.idCita,
                        cliente: c.cliente,
                        telefono: c.telefono,
                        servicio: c.servicio,
                        fechaCita: c.fecha,
                        horaCita: c.hora,
                        fechaEnvio: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
                        estado: 'Enviado (Simulado)'
                    };

                    console.log(`\n🤖 [AUTOMÁTICO - ${emp.nombre}] Recordatorio enviado para la cita ${c.idCita}: ${c.cliente} a las ${c.hora}`);

                    if (config.webhookUrl) {
                        try {
                            const response = await fetch(config.webhookUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    event: 'appointment.reminder',
                                    idCita: c.idCita,
                                    cliente: c.cliente,
                                    telefono: c.telefono,
                                    servicio: c.servicio,
                                    fecha: c.fecha,
                                    hora: c.hora,
                                    duracion: c.duracion,
                                    precio: c.precio
                                })
                            });
                            
                            if (response.ok) {
                                logEntry.estado = 'Enviado (Webhook)';
                                console.log(`🔗 Webhook ejecutado exitosamente para la cita ${c.idCita}`);
                            } else {
                                logEntry.estado = 'Error (Webhook)';
                                console.error(`❌ Webhook retornó estado ${response.status} para la cita ${c.idCita}`);
                            }
                        } catch (webhookErr) {
                            logEntry.estado = 'Error (Conexión)';
                            console.error(`❌ Error de conexión al webhook para la cita ${c.idCita}:`, webhookErr.message);
                        }
                    }

                    historialRecordatorios.unshift(logEntry);
                }
            }
        }
    } catch (err) {
        console.error('Error en recordatorios automáticos:', err.message);
    }
}

// Verificar cada 10 segundos
setInterval(verificarYEnviarRecordatoriosAutomaticos, 10000);

// =====================================================================
// AUTOMATIZACIÓN DE GOOGLE CALENDAR (ENDPOINTS Y UTILERÍAS NATIVAS)
// =====================================================================

/**
 * @route   GET /api/admin/google-calendar
 * @desc    Obtiene configuración actual de Google Calendar (sin revelar la llave privada).
 * @access  Admin
 */
app.get('/api/admin/google-calendar', async (req, res) => {
    try {
        const db = req.db;
        const empresa = req.empresa;
        const config = await getConfiguracionEmpresa(db, empresa.id);
        
        return res.status(200).json({
            ok: true,
            datos: {
                syncActiva: config.syncActiva,
                calendarId: config.calendarId,
                serviceAccountKeyPresent: !!config.serviceAccountKey
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, mensaje: 'Error al obtener config de Google Calendar.' });
    }
});

/**
 * @route   POST /api/admin/google-calendar
 * @desc    Guarda la configuración de Google Calendar.
 * @access  Admin
 */
app.post('/api/admin/google-calendar', async (req, res) => {
    const { syncActiva, calendarId, serviceAccountKey } = req.body;
    if (syncActiva === undefined || !calendarId) {
        return res.status(400).json({ ok: false, mensaje: 'syncActiva y calendarId son campos requeridos.' });
    }
    
    try {
        const db = req.db;
        const empresa = req.empresa;

        if (serviceAccountKey && serviceAccountKey.trim()) {
            await db.run(`
                UPDATE configuracion_empresa 
                SET gcal_sync_activa = ?, gcal_calendar_id = ?, gcal_service_key = ? 
                WHERE empresa_id = ?
            `, [syncActiva ? 1 : 0, calendarId.trim(), serviceAccountKey.trim(), empresa.id]);
        } else {
            await db.run(`
                UPDATE configuracion_empresa 
                SET gcal_sync_activa = ?, gcal_calendar_id = ? 
                WHERE empresa_id = ?
            `, [syncActiva ? 1 : 0, calendarId.trim(), empresa.id]);
        }
        
        console.log(`⚙️ Google Calendar automatización actualizada para empresa ${empresa.slug}: Activa=${syncActiva}, CalendarID=${calendarId}`);
        return res.status(200).json({
            ok: true,
            mensaje: 'Configuración de Google Calendar guardada correctamente.'
        });
    } catch (err) {
        console.error('Error al guardar config de Google Calendar:', err.message);
        return res.status(500).json({ ok: false, mensaje: 'Error interno al actualizar configuración.' });
    }
});

// Helper para disparar webhook de manera asíncrona
async function dispararWebhook(event, cita, webhookUrl) {
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                idCita: cita.idCita,
                cliente: cita.cliente,
                telefono: cita.telefono,
                servicio: cita.servicio,
                fecha: cita.fecha,
                hora: cita.hora,
                duracion: cita.duracion,
                precio: cita.precio
            })
        });
        console.log(`🔗 Webhook disparado exitosamente para el evento ${event} (Cita: ${cita.idCita})`);
    } catch (err) {
        console.error(`❌ Error al disparar webhook para el evento ${event}:`, err.message);
    }
}

// Helper para obtener eventos de Google Calendar
async function obtenerEventosGoogleCalendar(timeMin, timeMax, config) {
    if (!config || !config.serviceAccountKey) return [];
    const credentials = JSON.parse(config.serviceAccountKey);
    const accessToken = await obtenerGoogleAccessToken(credentials);
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&` +
        `timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&` +
        `orderBy=startTime`;
        
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    if (response.ok) {
        const data = await response.json();
        return data.items || [];
    } else {
        const errText = await response.text();
        throw new Error(`Google Calendar API returned status ${response.status}: ${errText}`);
    }
}

// Helper para registrar evento en Google Calendar
async function registrarEventoGoogleCalendar(cita, config) {
    if (!config || !config.syncActiva) {
        console.log(`\n📅 [AUTOMÁTICO - GOOGLE CALENDAR] (Simulado) Creando evento para cita ${cita.idCita}`);
        return;
    }
    
    if (!config.calendarId || !config.serviceAccountKey) {
        console.warn('⚠️ Google Calendar activo pero faltan credenciales.');
        return;
    }
    
    try {
        const credentials = JSON.parse(config.serviceAccountKey);
        const accessToken = await obtenerGoogleAccessToken(credentials);
        
        const [y, m, d] = cita.fecha.split('-').map(Number);
        const [h, min] = cita.hora.split(':').map(Number);
        const dateStart = new Date(y, m - 1, d, h, min);
        const dateEnd = new Date(dateStart.getTime() + cita.duracion * 60 * 1000);
        
        const eventPayload = {
            id: cita.idCita.toLowerCase().replace(/[^a-z0-9]/g, ''),
            summary: `Cita Spa: ${cita.cliente || cita.nombre} (${cita.servicio})`,
            location: 'Calle Jardín Botánico #45, Sector Laurel',
            description: `💆 Servicio: ${cita.servicio}\n👤 Cliente: ${cita.cliente || cita.nombre}\n📞 Teléfono: ${cita.telefono}\n🆔 ID Cita: ${cita.idCita}\n\n*Creado automáticamente*`,
            start: {
                dateTime: dateStart.toISOString(),
                timeZone: 'America/Bogota'
            },
            end: {
                dateTime: dateEnd.toISOString(),
                timeZone: 'America/Bogota'
            }
        };
        
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventPayload)
        });
        
        if (response.ok) {
            const result = await response.json();
            cita.googleEventId = result.id;
            console.log(`✅ Google Calendar sincronizado (Creación) para cita ${cita.idCita}.`);
        } else {
            const errBody = await response.text();
            console.error(`❌ Error al crear evento en Google Calendar: Status ${response.status}`, errBody);
        }
    } catch (err) {
        console.error('❌ Fallo en la sincronización con Google Calendar:', err.message);
    }
}

// Helper para eliminar evento en Google Calendar
async function eliminarEventoGoogleCalendar(cita, config) {
    if (!config || !config.syncActiva) {
        console.log(`\n📅 [AUTOMÁTICO - GOOGLE CALENDAR] (Simulado) Eliminando evento para cita cancelada ${cita.idCita}`);
        return;
    }
    
    const eventId = cita.idCita.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!config.calendarId || !config.serviceAccountKey) return;
    
    try {
        const credentials = JSON.parse(config.serviceAccountKey);
        const accessToken = await obtenerGoogleAccessToken(credentials);
        
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${eventId}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.status === 204 || response.ok) {
            console.log(`✅ Evento de Google Calendar eliminado para cita ${cita.idCita}.`);
        } else {
            const errBody = await response.text();
            console.error(`❌ Error al eliminar evento de Google Calendar: Status ${response.status}`, errBody);
        }
    } catch (err) {
        console.error('❌ Error al eliminar evento de Google Calendar:', err.message);
    }
}

// Helper nativo para obtener Token de Google OAuth2 sin dependencias
function obtenerGoogleAccessToken(credentials) {
    return new Promise((resolve, reject) => {
        try {
            const privateKey = credentials.private_key;
            const clientEmail = credentials.client_email;
            
            const header = {
                alg: 'RS256',
                typ: 'JWT'
            };
            
            const now = Math.floor(Date.now() / 1000);
            const claim = {
                iss: clientEmail,
                scope: 'https://www.googleapis.com/auth/calendar',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600,
                iat: now
            };
            
            const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
            const base64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url');
            
            const signatureInput = `${base64Header}.${base64Claim}`;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(signatureInput);
            const signature = signer.sign(privateKey, 'base64url');
            
            const assertion = `${signatureInput}.${signature}`;
            const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`;
            
            const req = https.request({
                host: 'oauth2.googleapis.com',
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.access_token) {
                            resolve(parsed.access_token);
                        } else {
                            reject(new Error(parsed.error_description || 'No access_token returned'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            req.on('error', err => reject(err));
            req.write(postData);
            req.end();
            
        } catch (err) {
            reject(err);
        }
    });
}


// =====================================================================
// 4. ARRANQUE DEL SERVIDOR
// =====================================================================
(async () => {
    try {
        console.log('🔄 Inicializando base de datos SaaS...');
        await connectDB();
        await seedInitialTenant();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=====================================================');
            console.log('💜 SAMAMBAIA SPA — SERVIDOR BACKEND (MULTI-TENANT READY)');
            console.log('=====================================================');
            console.log(`🚀 URL:            http://localhost:${PORT}`);
            console.log(`📁 Estáticos:      ${path.join(__dirname, 'public')}`);
            console.log('=====================================================\n');
        });
    } catch (err) {
        console.error('❌ Error al arrancar el servidor SaaS:', err);
    }
})();
