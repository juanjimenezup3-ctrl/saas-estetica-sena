# 💜 EstéticaSaaS — Plataforma de Gestión B2B para Centros de Estética (SaaS Multi-Tenant)

> **Proyecto Productivo SENA — Formato GFPI-F-144**  
> Centro de Servicios Empresariales y Turísticos | Guía Metodológica GFPI-G-048

---

## 🎓 Credenciales de Acceso Demo (Evaluación SENA)

Para facilitar la revisión por parte de los instructores evaluadores, la plataforma cuenta con un mecanismo de autologin y credenciales semilla precargadas en la base de datos piloto:

| Rol Evaluador | Usuario / Correo | Contraseña | Enlace de Acceso Directo |
| :--- | :--- | :--- | :--- |
| **Admin / Dueño de Spa (Semilla)** | `admin@demoestetica.com` | `123456` | [Acceder a Demo](http://localhost:3000) (Click en botón de autocompletado en banner) |
| **Admin Alternativo (Consola)** | `admin` | `admin123` | Login manual en el modal administrativo |

*   **Página Comercial (Landing Page & Onboarding):** `http://localhost:3000/`
*   **Portal de Reserva de Clientes (Tenant Piloto):** `http://localhost:3000/samambaia/`
*   **Panel Administrativo (Dashboard Piloto):** `http://localhost:3000/samambaia/dashboard`

---

## 🏛️ Estructura de Módulos Funcionales (Alineación con Bitácoras SENA)

Basado en el análisis de las **6 Bitácoras del Proyecto Productivo SENA (BITACORA1 a BITACORA6)**, la aplicación web EstéticaSaaS se organiza en los siguientes 7 módulos funcionales principales:

### 🔒 1. Arquitectura Multi-Tenant y Seguridad (Bitácoras 1 y 2)
El sistema está diseñado bajo el modelo de software como servicio (SaaS) multi-inquilino:
*   **Aislamiento de Datos por Inquilino (Tenant):** Toda la información de clientes, citas, servicios, configuraciones de horarios e indicadores financieros están aislados bajo un identificador único por empresa (`empresa_id` / `slug`).
*   **Módulo de Autenticación Segura:** Acceso al panel administrativo protegido mediante tokens JWT y cifrado seguro de credenciales.
*   **Roles del Sistema (RBAC):**
    *   *SuperAdmin:* Administrador global del SaaS (monitorea suscripciones e ingresos globales).
    *   *Admin / Dueño de Spa:* Administra su centro, catálogo, bloquea franjas y ve reportes.
    *   *Cliente Final:* Realiza reservas auto-servicio sin requerir inicio de sesión obligatorio.

### 💈 2. Catálogo de Servicios y Gestión de Personal (Bitácoras 3 y 4)
Permite la parametrización completa de los recursos operativos de cada centro de estética:
*   **Catálogo de Servicios:** Creación, edición y eliminación de tratamientos (ej. Uñas Semipermanentes, Masaje Relajante, Limpieza Facial) especificando categoría, duración en minutos, precios en pesos colombianos (COP), descuentos y promociones dinámicas.
*   **Gestión del Personal:** Asignación de especialidades a cada esteticista y configuración de sus respectivos horarios de atención y días libres.

### 📅 3. Módulo de Agenda y Reservas de Citas (Bitácora 4)
El motor de reservas y control de agenda de la aplicación:
*   **Calendario Semanal Interactivo:** Vista fluida para el administrador de las citas agendadas, horas ocupadas, franjas disponibles y bloqueos.
*   **Flujo de Reserva Auto-Servicio:** Selección intuitiva de Servicio ➔ Profesional ➔ Fecha y Hora disponible.
*   **Control de Solapamiento:** Algoritmos en el backend que previenen la asignación doble de un mismo profesional o cabina a la misma hora exacta.
*   **Estados de Citas:** Control del flujo de vida de la reserva (*Pendiente*, *Confirmada*, *Completada* y *Cancelada*).

### 🚀 4. Landing Page y Auto-Registro (Self-Onboarding) (Bitácora 5)
La cara visible del producto diseñada para la captación de nuevos clientes corporativos:
*   **Landing Page Comercial:** Presentación de la propuesta de valor, características clave del software, testimonios y planes de comercialización.
*   **Precios y Modelos de Monetización:**
    *   *Plan Emprendedor (Básico):* $15.200 COP / mes (Ideal para profesionales independientes).
    *   *Plan Pro / Multi-Sede:* $67.100 COP / mes (Para spas medianos con múltiples profesionales y reportes).
*   **Formulario de Registro Automático:** Permite a cualquier centro de estética crear su propia URL personalizada en segundos con 14 días de prueba gratuita.

### 💳 5. Gestión de Suscripciones y Pasarela de Pagos (Bitácoras 5 y 6)
Permite la administración de la recurrencia financiera del software:
*   **Módulo de Suscripción:** Indicación visual del estado de membresía del tenant (*En Prueba*, *Activa* o *Vencida*) y los días restantes de prueba.
*   **Simulador de Pasarela Wompi (Sandbox):** Permite procesar de forma segura transacciones de prueba simuladas mediante tarjetas de crédito de test, comunicándose por webhooks automatizados del servidor Node.js para activar o renovar la cuenta instantáneamente.

### 📊 6. Panel de Control (Dashboard) e Indicadores (Bitácoras 5 y 6)
Métricas y KPIs clave en tiempo real para apoyar la toma de decisiones gerenciales del spa:
*   **Indicadores Financieros (KPIs):** Visualización de ingresos totales generados en el mes, proyección económica semanal y promedio de ticket por cita.
*   **Métricas de Operación:** Ocupación general, volumen de citas canceladas y ranking de servicios más solicitados.
*   **Directorio de Clientes:** Base de datos de usuarios recurrentes con historial detallado de asistencias.

### ☁️ 7. Infraestructura y Despliegue en Producción (Bitácora 6)
Cumplimiento técnico exigido para la sustentación final ante el jurado calificador:
*   **Servidor Backend:** Desarrollado en Node.js con Express, escuchando en el puerto dinámico configurado por el host (`0.0.0.0`).
*   **Persistencia:** SQLite 3 integrado con inicialización automática de esquemas y seeding al primer arranque.
*   **Despliegue Continuo:** Alojado en Render.com conectado con la rama principal de GitHub y provisto de certificado SSL seguro (HTTPS).

---

## 📦 Stack Tecnológico Completo

*   **Runtime:** Node.js v20+ / v22+
*   **Framework de Servidor:** Express.js v4.19
*   **Motor de Base de Datos:** SQLite (mediante la librería nativa `sqlite3` y el envoltorio asíncrono de promesas `sqlite`)
*   **Frontend UI:** HTML5 semántico, Javascript ES6 nativo (sin frameworks pesados para un rendimiento óptimo de carga) y Tailwind CSS.
*   **Iconografía y Tipografías:** Lucide Icons (CDN) + Google Fonts (Playfair Display & Outfit).

---

## 🛠️ Instalación y Configuración Local

Si deseas ejecutar y realizar pruebas de desarrollo localmente, sigue estos pasos:

```bash
# 1. Clonar el repositorio
git clone https://github.com/juanjimenezup3-ctrl/saas-estetica-sena.git
cd saas-estetica-sena

# 2. Instalar las dependencias de Node
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Modifica el archivo .env si deseas configurar un puerto específico (default: 3000)

# 4. Compilar la hoja de estilos de producción (CSS)
npm run build

# 5. Iniciar la aplicación
npm start
```

*   **Modo de Desarrollo:** Si deseas trabajar con recarga rápida de estilos y reinicio automático del servidor usa:
    ```bash
    npm run dev
    ```

---

## 🎓 Cumplimiento SENA (GFPI-F-144)

Este software ha sido diseñado y desarrollado como respuesta directa a los requerimientos de la especialidad técnica de desarrollo de software, abarcando todas las fases del ciclo de vida del software (Análisis, Diseño, Desarrollo, Pruebas y Despliegue) documentadas sistemáticamente a lo largo de las bitácoras semanales del proyecto.
