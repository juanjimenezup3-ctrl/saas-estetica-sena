# 💜 SamambaiaSpa — Sistema de Agendamiento Inteligente

> **Proyecto Productivo SENA — Formato GFPI-F-144**  
> Centro de Bienestar y Belleza | Sistema Multi-Tenant SaaS

---

## 🎓 Credenciales de Acceso Demo (Evaluador SENA)

> ⚡ También puede hacer clic en el botón **"Ir al Dashboard e ingresar automáticamente"** en la sección _Admin_ de la página principal.

| Campo      | Valor                      |
|------------|----------------------------|
| **Usuario**    | `admin@demoestetica.com` |
| **Contraseña** | `123456`                 |

**Credencial alternativa:**

| Campo      | Valor      |
|------------|------------|
| **Usuario**    | `admin` |
| **Contraseña** | `admin123` |

**URL de acceso:**
- Página principal / Agendamiento: `https://<tu-dominio>/samambaia/`
- Panel de Administración: `https://<tu-dominio>/samambaia/dashboard`

---

## 🚀 Despliegue en Render / Railway

### Variables de Entorno Requeridas

Configura estas variables en el panel de tu proveedor cloud:

```
PORT=          # Render/Railway lo inyectan automáticamente — no es necesario definirlo
JWT_SECRET=    # Cadena larga y aleatoria. Ej: openssl rand -base64 48
NODE_ENV=production
DEBUG=false
```

### Comandos de Build y Start

| Script NPM     | Comando              | Propósito |
|----------------|----------------------|-----------|
| `npm run build`| Compila CSS Tailwind minificado para producción |
| `npm start`    | Arranca el servidor Express |
| `npm run seed` | Inicializa la base de datos con datos demo |

**Configuración recomendada en Render:**
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

> El servidor crea y migra la base de datos SQLite automáticamente al arrancar.

---

## 🏗️ Arquitectura

```
samambaia-spa/
├── server.js          # Servidor Express principal (API + rutas HTML)
├── database.js        # Módulo SQLite: migraciones + seeder automático
├── seed.js            # Script de seeding standalone (npm run seed)
├── package.json       # Scripts y dependencias
├── .env.example       # Plantilla de variables de entorno
├── .gitignore         # node_modules, .env, *.sqlite excluidos
└── public/
    ├── index.html     # Landing page + formulario de agendamiento
    ├── dashboard.html # Panel de administración privado
    ├── css/
    │   ├── input.css  # Fuente Tailwind (con @theme personalizado)
    │   └── styles.css # CSS compilado (generado por npm run build)
    ├── js/
    │   ├── app.js     # Frontend de la landing
    │   └── dashboard.js # Frontend del panel admin
    └── images/        # Logos e imágenes estáticas
```

---

## ⚙️ Instalación Local

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd samambaia-spa

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Compilar CSS (solo para producción)
npm run build

# 5. Iniciar el servidor
npm start

# — O en modo desarrollo (hot-reload CSS + nodemon) —
npm run dev
```

---

## 🔒 Health Check

La ruta `/health` devuelve `{ "status": "ok" }` con código HTTP 200.
Útil para configurar los health checks de Render/Railway/uptime monitors.

---

## 📦 Stack Tecnológico

| Capa         | Tecnología |
|--------------|------------|
| Runtime      | Node.js 20+ |
| Framework    | Express.js 4 |
| Base de Datos| SQLite (via `sqlite` + `sqlite3`) |
| CSS          | Tailwind CSS 4 (con `@theme` personalizado) |
| Iconos       | Lucide Icons (CDN) |
| Fuentes      | Google Fonts — Playfair Display + Outfit |
| Despliegue   | Render / Railway |
