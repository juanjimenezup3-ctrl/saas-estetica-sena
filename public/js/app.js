/**
 * =====================================================================
 * app.js — Controlador Frontend Público de SamambaiaSpa
 * =====================================================================
 * Proyecto Productivo SENA — Formato GFPI-F-144
 * 
 * DESCRIPCIÓN:
 * Controla el flujo de agendamiento en 2 pasos para clientes:
 * 1. Selección de servicio y fecha/hora mediante un calendario semanal dinámico.
 * 2. Formulario de registro de datos del cliente.
 * 
 * AUTOR: Samambaia Dev Team
 * FECHA: Mayo 2026
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Interceptor global de Fetch para inyectar x-tenant-slug automáticamente
    (function () {
        const originalFetch = window.fetch;
        window.fetch = async function (url, options = {}) {
            if (typeof url === 'string' && url.startsWith('/api/')) {
                const pathParts = window.location.pathname.split('/').filter(p => p);
                const slug = pathParts[0] || 'samambaia';
                if (options.headers instanceof Headers) {
                    options.headers.set('x-tenant-slug', slug);
                } else {
                    options.headers = options.headers || {};
                    options.headers['x-tenant-slug'] = slug;
                }
            }
            return originalFetch(url, options);
        };
    })();

    // Inicializar los iconos de Lucide
    lucide.createIcons();

    // =================================================================
    // 1. SELECCIÓN DE ELEMENTOS DEL DOM
    // =================================================================
    const selectServicio = document.getElementById('servicioId');
    const servicioInfo = document.getElementById('servicio-info');
    const servicioPrecio = document.getElementById('servicio-precio');
    const servicioDuracion = document.getElementById('servicio-duracion');

    const calendarContainer = document.getElementById('calendar-container');
    const publicCalendarGrid = document.getElementById('public-calendar-grid');
    const currentWeekLabel = document.getElementById('current-week-label');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');

    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const selectedSummary = document.getElementById('selected-summary');
    const btnBackStep1 = document.getElementById('btn-back-step-1');

    const form = document.getElementById('appointment-form');
    const formServicioId = document.getElementById('form-servicioId');
    const formFecha = document.getElementById('form-fecha');
    const formHora = document.getElementById('form-hora');

    const btnSubmit = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');
    const generalError = document.getElementById('general-error');
    const generalErrorText = document.getElementById('general-error-text');
    const conflictError = document.getElementById('conflict-error');
    const conflictText = document.getElementById('conflict-text');

    const bookingFormWrapper = document.getElementById('booking-form-wrapper');
    const bookingSuccessWrapper = document.getElementById('booking-success-wrapper');
    const btnNewBooking = document.getElementById('btn-new-booking');
    const btnAddGcal = document.getElementById('btn-add-gcal');

    const summaryId = document.getElementById('summary-id');
    const summaryNombre = document.getElementById('summary-nombre');
    const summaryServicio = document.getElementById('summary-servicio');
    const summaryPrecio = document.getElementById('summary-precio');
    const summaryDuracion = document.getElementById('summary-duracion');
    const summaryDatetime = document.getElementById('summary-datetime');

    const serviciosGrid = document.getElementById('servicios-grid');

    // =================================================================
    // ESTADO DE LA APLICACIÓN
    // =================================================================
    let catalogoServicios = [];
    let fechaReferencia = obtenerFechaActualISO(); // YYYY-MM-DD de hoy
    let servicioSeleccionado = null;

    // Calcula el precio final de un servicio aplicando descuentos o precios especiales
    function calcularPrecioFinal(s) {
        if (s.precioEspecial && s.precioEspecial > 0) return s.precioEspecial;
        if (s.descuento && s.descuento > 0) return Math.round(s.precio * (1 - s.descuento / 100));
        return s.precio;
    }

    function getTenantSlug() {
        const pathParts = window.location.pathname.split('/').filter(p => p);
        return pathParts[0] || 'samambaia';
    }

    // =================================================================
    // 2. CARGA DEL CATÁLOGO DE SERVICIOS
    // =================================================================
    async function cargarCatalogoServicios() {
        try {
            console.log('📋 Cargando servicios...');
            const res = await fetch('/api/servicios', {
                headers: { 'x-tenant-slug': getTenantSlug() }
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                catalogoServicios = data.datos;
                renderizarTarjetasServicios(catalogoServicios);

                // Poblar select
                selectServicio.innerHTML = '';
                const optDefault = document.createElement('option');
                optDefault.value = '';
                optDefault.disabled = true;
                optDefault.selected = true;
                optDefault.textContent = 'Selecciona un servicio...';
                selectServicio.appendChild(optDefault);

                catalogoServicios.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    const precioFinal = calcularPrecioFinal(s);
                    const precioLabel = precioFinal !== s.precio
                        ? `${s.nombre} — $${precioFinal.toLocaleString('es-CO')} COP (antes $${s.precio.toLocaleString('es-CO')})`
                        : `${s.nombre} — $${s.precio.toLocaleString('es-CO')} COP`;
                    opt.textContent = precioLabel;
                    selectServicio.appendChild(opt);
                });
                // Cargar calendario inicial (fijo) con la duración por defecto
                cargarCalendarioSemanal();
            } else {
                serviciosGrid.innerHTML = '<p class="error-message">Error al cargar servicios.</p>';
            }
        } catch (error) {
            console.error('Error cargando servicios:', error);
            serviciosGrid.innerHTML = '<p class="error-message">Error al conectar con el servidor.</p>';
        }
    }

    function renderizarTarjetasServicios(servicios) {
        serviciosGrid.innerHTML = '';
        serviciosGrid.className = 'space-y-10'; // Cambiar a flujo vertical de secciones

        // Agrupar por categoría
        const categoriasMap = {
            'Uñas': {
                titulo: 'Cuidado de Uñas & Manicura 💅',
                descripcion: 'Diseños exclusivos, extensiones y cuidado profesional para tus manos.',
                servicios: []
            },
            'Tratamientos': {
                titulo: 'Tratamientos Estéticos & Cuidado Facial ✨',
                descripcion: 'Renueva tu piel y resalta tu belleza natural con técnicas avanzadas.',
                servicios: []
            },
            'Relajación': {
                titulo: 'Experiencias de Masajes & Relajación 🧘',
                descripcion: 'Libera tensiones, alivia el estrés y reconéctate con tu bienestar corporal.',
                servicios: []
            }
        };

        servicios.forEach(s => {
            const cat = s.categoria || 'Otros';
            if (!categoriasMap[cat]) {
                categoriasMap[cat] = {
                    titulo: `${cat} 🌸`,
                    descripcion: 'Servicios especializados del spa.',
                    servicios: []
                };
            }
            categoriasMap[cat].servicios.push(s);
        });

        // Renderizar cada categoría con su título y grid
        for (const [key, catInfo] of Object.entries(categoriasMap)) {
            if (catInfo.servicios.length === 0) continue;

            const section = document.createElement('div');
            section.className = 'space-y-4';

            // Cabecera de Categoría
            const header = document.createElement('div');
            header.className = 'border-l-4 border-purple-mid pl-3.5 py-1.5 bg-purple-soft/20 rounded-r-xl';
            header.innerHTML = `
                <h3 class="text-lg md:text-xl font-serif text-purple-deep font-bold tracking-wide">${catInfo.titulo}</h3>
                <p class="text-[0.76rem] text-text-muted mt-0.5">${catInfo.descripcion}</p>
            `;
            section.appendChild(header);

            // Grid para esta categoría
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

            catInfo.servicios.forEach(s => {
                const card = document.createElement('div');
                const esOferta = !!s.ofertaDelDia;
                const tieneDescuento = s.descuento && s.descuento > 0;
                const tienePrecioEsp = s.precioEspecial && s.precioEspecial > 0;
                const tienePromo = tieneDescuento || tienePrecioEsp;
                const precioFinal = calcularPrecioFinal(s);

                card.className = `servicio-card${esOferta ? ' es-oferta' : ''}`;

                // Build badges HTML
                let badgesHtml = '';
                if (esOferta) {
                    badgesHtml += `<div class="badge-oferta">🔥 Oferta del Día</div>`;
                }

                // Build deal tags below category
                let dealTagsHtml = '';
                if (tieneDescuento) {
                    dealTagsHtml += `<span class="badge-descuento">🏷️ -${s.descuento}% OFF</span>`;
                }
                if (tienePrecioEsp && !tieneDescuento) {
                    dealTagsHtml += `<span class="badge-precio-especial">⭐ Precio Especial</span>`;
                }

                // Build price HTML
                let priceHtml = '';
                if (tienePromo) {
                    priceHtml = `
                        <span class="servicio-tag tag-precio-original">💰 $${s.precio.toLocaleString('es-CO')}</span>
                        <span class="servicio-tag tag-precio-final">🎉 $${precioFinal.toLocaleString('es-CO')}</span>
                    `;
                } else {
                    priceHtml = `<span class="servicio-tag tag-precio">💰 $${s.precio.toLocaleString('es-CO')}</span>`;
                }

                card.innerHTML = `
                    ${badgesHtml}
                    <div class="servicio-card-cat">${s.categoria}</div>
                    ${dealTagsHtml ? `<div class="flex flex-wrap gap-1.5 mb-2">${dealTagsHtml}</div>` : ''}
                    <div class="servicio-card-name">${s.nombre}</div>
                    <div class="servicio-card-desc">${s.descripcion}</div>
                    <div class="servicio-card-meta">
                        <div class="flex flex-col gap-0.5">${priceHtml}</div>
                        <span class="servicio-tag tag-duracion">⏱️ ${s.duracion} min</span>
                    </div>
                    <button type="button" class="btn-reservar-servicio w-full mt-3 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-full shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer" data-id="${s.id}">
                        <i data-lucide="calendar-plus" class="w-4 h-4"></i>
                        Reservar Ahora
                    </button>
                `;
                // Clic en la tarjeta (body) — selecciona el servicio
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-reservar-servicio')) return; // El botón maneja el clic
                    selectServicio.value = s.id;
                    selectServicio.dispatchEvent(new Event('change'));
                    document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
                });
                // Botón "Reservar Ahora" — selecciona el servicio y hace scroll al calendario con highlight
                card.querySelector('.btn-reservar-servicio').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectServicio.value = s.id;
                    selectServicio.dispatchEvent(new Event('change'));
                    // Scroll al calendario
                    const calContainer = document.getElementById('calendar-container');
                    if (calContainer) {
                        calContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Highlight animado
                        calContainer.classList.add('ring-2', 'ring-purple-400', 'ring-offset-2', 'rounded-2xl', 'transition-all');
                        setTimeout(() => calContainer.classList.remove('ring-2', 'ring-purple-400', 'ring-offset-2'), 2000);
                    } else {
                        document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
                    }
                });
                lucide.createIcons();
                grid.appendChild(card);
            });

            section.appendChild(grid);
            serviciosGrid.appendChild(section);
        }
    }

    // Inicializar catálogo
    cargarCatalogoServicios();

    // Evento selector servicio
    selectServicio.addEventListener('change', () => {
        const id = parseInt(selectServicio.value);
        servicioSeleccionado = catalogoServicios.find(s => s.id === id);

        if (servicioSeleccionado) {
            const pFinal = calcularPrecioFinal(servicioSeleccionado);
            const tienePromo = pFinal !== servicioSeleccionado.precio;
            if (tienePromo) {
                servicioPrecio.innerHTML = `<span style="text-decoration:line-through;opacity:0.6;font-size:0.85em;">$${servicioSeleccionado.precio.toLocaleString('es-CO')}</span> &rarr; <strong style="color:#d32f2f;">💰 $${pFinal.toLocaleString('es-CO')} COP</strong>`;
            } else {
                servicioPrecio.textContent = `💰 $${servicioSeleccionado.precio.toLocaleString('es-CO')} COP`;
            }
            servicioDuracion.textContent = `⏱️ ${servicioSeleccionado.duracion} minutos`;
            servicioInfo.classList.remove('hidden');
        } else {
            servicioInfo.classList.add('hidden');
        }
        cargarCalendarioSemanal();
    });

    // =================================================================
    // 3. LOGICA Y RENDERIZADO DEL CALENDARIO
    // =================================================================
    async function cargarCalendarioSemanal() {
        // Si no hay servicio seleccionado, mostrar mensaje guía
        if (!servicioSeleccionado) {
            publicCalendarGrid.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; color: #6b47a0;">
                    <div style="font-size: 2rem; margin-bottom: 0.75rem;">📅</div>
                    <p style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.35rem;">Selecciona un servicio primero</p>
                    <p style="font-size: 0.75rem; color: #8a7a9a; max-width: 280px; margin: 0 auto;">Elige el servicio que deseas en el Paso 1 y el calendario mostrará los horarios disponibles automáticamente.</p>
                </div>`;
            return;
        }

        try {
            publicCalendarGrid.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; text-align: center;">Cargando horarios disponibles...</div>';

            const res = await fetch(`/api/calendario-semana?fecha=${fechaReferencia}`, {
                headers: { 'x-tenant-slug': getTenantSlug() }
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                renderizarGridCalendario(data.datos);
            } else {
                publicCalendarGrid.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; color: var(--color-error); text-align: center;">Error al obtener horarios.</div>';
            }
        } catch (error) {
            console.error('Error al cargar calendario:', error);
            publicCalendarGrid.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; color: var(--color-error); text-align: center;">Error de conexión.</div>';
        }
    }

    function renderizarGridCalendario(datosSemana) {
        const { fechas, citas, bloqueos, configuracionHorario, horariosFechas } = datosSemana;

        // Titulo de la semana
        currentWeekLabel.textContent = formatRangoSemana(fechas);

        // Limpiar y definir clase del grid
        publicCalendarGrid.innerHTML = '';
        publicCalendarGrid.className = 'grid grid-cols-[75px_repeat(7,minmax(115px,1fr))] min-w-[880px]';

        // 1. Crear cabeceras de columnas (Hora + 7 días)
        const cellHoraHeader = document.createElement('div');
        cellHoraHeader.className = 'sticky top-0 left-0 z-20 bg-purple-dark text-white text-center py-2 px-1 text-[0.72rem] font-semibold border-r border-b border-purple-900/30 flex items-center justify-center';
        cellHoraHeader.textContent = 'Hora';
        publicCalendarGrid.appendChild(cellHoraHeader);

        const hoyISO = obtenerFechaActualISO();

        fechas.forEach(f => {
            const esHoy = f === hoyISO;
            const cellDayHeader = document.createElement('div');

            let headerClasses = 'sticky top-0 z-10 text-center py-2 px-1 text-[0.72rem] font-semibold border-r border-b flex flex-col items-center justify-center min-h-[52px] ';
            if (esHoy) {
                headerClasses += 'bg-gradient-to-br from-gold-custom to-yellow-600 text-white border-yellow-700/30 shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)] ring-1 ring-gold-custom';
            } else {
                headerClasses += 'bg-gradient-to-br from-purple-deep to-purple-mid text-white border-purple-900/20';
            }

            cellDayHeader.className = headerClasses;
            cellDayHeader.innerHTML = formatFechaEspanolCorta(f);
            publicCalendarGrid.appendChild(cellDayHeader);
        });

        // 2. Definir franjas de 30 mins
        const startMin = 8 * 60; // 08:00
        const endMin = 19 * 60;  // 19:00

        for (let m = startMin; m < endMin; m += 30) {
            const timeStr = minutesToTime(m);

            // Celda de etiqueta de hora
            const cellTimeLabel = document.createElement('div');
            cellTimeLabel.className = 'sticky left-0 z-10 bg-purple-soft/90 backdrop-blur-sm border-r border-b border-purple-100 text-[0.68rem] font-semibold text-purple-deep flex items-center justify-center min-h-[46px]';
            cellTimeLabel.textContent = formatHora(timeStr);
            publicCalendarGrid.appendChild(cellTimeLabel);

            // Celda para cada día de la semana
            fechas.forEach((fechaStr, colIndex) => {
                const esHoy = fechaStr === hoyISO;
                const cell = document.createElement('div');
                cell.className = `p-1 border-r border-b border-purple-50 min-h-[46px] flex flex-col justify-center ${esHoy ? 'bg-yellow-50/40 border-r-yellow-100' : 'bg-white'}`;

                // Determinar día de la semana
                const dayOfWeek = (colIndex === 6) ? 0 : colIndex + 1;
                const configDay = (horariosFechas && horariosFechas[fechaStr]) ? horariosFechas[fechaStr] : configuracionHorario[dayOfWeek];

                let estado = 'disponible';
                let blockReason = '';

                // Filtrar citas y bloqueos para este día específico
                const citasDia = citas.filter(c => c.fecha === fechaStr);
                const bloqueosDia = bloqueos.filter(b => b.fecha === fechaStr);

                const esDiaBloqueado = bloqueosDia.some(b => b.tipo === 'dia');

                if (!configDay || !configDay.activo) {
                    estado = 'bloqueado';
                    blockReason = 'Cerrado';
                } else if (esDiaBloqueado) {
                    estado = 'bloqueado';
                    const b = bloqueosDia.find(x => x.tipo === 'dia');
                    blockReason = b ? b.descripcion : 'Día Bloqueado';
                } else if (servicioSeleccionado && servicioSeleccionado.ofertaDelDia && fechaStr !== hoyISO) {
                    estado = 'bloqueado';
                    blockReason = 'Oferta solo por HOY';
                } else {
                    const slotStart = m;
                    const slotEnd = m + 30;

                    const dayStart = timeToMinutes(configDay.inicio);
                    const dayEnd = timeToMinutes(configDay.fin);

                    if (slotStart < dayStart || slotEnd > dayEnd) {
                        estado = 'bloqueado';
                        blockReason = 'Fuera de horario';
                    } else {
                        // Verificar citas
                        const tieneCita = citasDia.some(c => {
                            const cStart = timeToMinutes(c.hora);
                            const cEnd = cStart + c.duracion;
                            return slotStart < cEnd && cStart < slotEnd;
                        });

                        if (tieneCita) {
                            estado = 'ocupado';
                        } else {
                            // Verificar bloqueos de franja
                            const tieneBloqueo = bloqueosDia.some(b => {
                                if (b.tipo !== 'franja') return false;
                                const bStart = timeToMinutes(b.hora);
                                const bEnd = bStart + b.duracion;
                                return slotStart < bEnd && bStart < slotEnd;
                            });

                            if (tieneBloqueo) {
                                estado = 'bloqueado';
                                const b = bloqueosDia.find(x => {
                                    const bStart = timeToMinutes(x.hora);
                                    const bEnd = bStart + x.duracion;
                                    return slotStart < bEnd && bStart < slotEnd;
                                });
                                blockReason = b ? b.descripcion : 'Bloqueado';
                            }
                        }
                    }
                }

                // Evaluar si es reservable para el servicio seleccionado y su duración
                let esReservable = false;

                // Solo evaluar reservabilidad si no está bloqueado por oferta de día
                if (estado !== 'bloqueado') {
                    esReservable = verificarDisponibilidadCliente(
                        fechaStr,
                        timeStr,
                        servicioSeleccionado ? servicioSeleccionado.duracion : 30,
                        configDay,
                        citasDia,
                        bloqueosDia
                    );

                    // Doble validación por si acaso: si es oferta, no puede reservarse si no es hoy
                    if (servicioSeleccionado && servicioSeleccionado.ofertaDelDia && fechaStr !== hoyISO) {
                        esReservable = false;
                        estado = 'bloqueado';
                        blockReason = 'Oferta solo por HOY';
                    }
                }

                const btn = document.createElement('button');
                btn.type = 'button';

                // Clases base del botón
                let btnClasses = 'w-full h-full border rounded-lg font-sans text-[0.7rem] font-bold cursor-pointer transition-all p-1.5 flex flex-col items-center justify-center text-center shadow-sm min-h-[38px] active:scale-95 ';

                if (esReservable) {
                    btnClasses += 'bg-green-50 text-green-700 border-green-200/60 hover:bg-green-600 hover:text-white hover:border-transparent hover:shadow-green-950/10 hover:-translate-y-0.5';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span>Disponible</span><span class="text-[0.58rem] opacity-75 font-normal mt-0.5">${formatHora(timeStr)}</span>`;
                    btn.addEventListener('click', () => seleccionarHorario(fechaStr, timeStr));
                } else if (estado === 'ocupado') {
                    btnClasses += 'bg-red-50 text-red-700 border-red-200/60 cursor-not-allowed opacity-80';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span>Ocupado</span>`;
                    btn.disabled = true;
                } else {
                    btnClasses += 'bg-gray-100 text-gray-400 border-gray-200/50 cursor-not-allowed opacity-75';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span class="font-normal text-[0.62rem]">${blockReason || 'Cerrado'}</span>`;
                    btn.disabled = true;
                }

                cell.appendChild(btn);
                publicCalendarGrid.appendChild(cell);
            });
        }

        lucide.createIcons();
    }

    function seleccionarHorario(fecha, hora) {
        if (!servicioSeleccionado) {
            alert('Por favor, selecciona primero un servicio en el Paso 1 para ver disponibilidad y programar tu cita.');
            selectServicio.focus();
            selectServicio.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        // Guardar valores en campos ocultos del formulario
        formServicioId.value = servicioSeleccionado.id;
        formFecha.value = fecha;
        formHora.value = hora;

        // Calcular precio con ofertas/descuentos
        const pFinal = calcularPrecioFinal(servicioSeleccionado);
        const tienePromo = pFinal !== servicioSeleccionado.precio;
        const precioDisplay = tienePromo
            ? `<span style="text-decoration:line-through;opacity:0.55;font-size:0.9em;">$${servicioSeleccionado.precio.toLocaleString('es-CO')}</span> → <strong style="color:#d32f2f;">$${pFinal.toLocaleString('es-CO')} COP</strong>`
            : `$${servicioSeleccionado.precio.toLocaleString('es-CO')} COP`;

        // Renderizar el resumen en el Paso 2
        selectedSummary.innerHTML = `
            <h4>Detalles de tu cita</h4>
            <p>💆 <strong>Servicio:</strong> ${servicioSeleccionado.nombre} (${servicioSeleccionado.categoria})</p>
            <p>⏱️ <strong>Duración:</strong> ${servicioSeleccionado.duracion} min</p>
            <p>💰 <strong>Precio:</strong> ${precioDisplay}</p>
            <p>📅 <strong>Fecha:</strong> ${formatearFechaLarga(fecha)}</p>
            <p>⏰ <strong>Hora:</strong> ${formatHora(hora)}</p>
        `;

        // Transición visual
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
    }

    btnBackStep1.addEventListener('click', () => {
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
    });

    // Navegación de semanas
    prevWeekBtn.addEventListener('click', () => {
        ajustarSemanaReferencia(-7);
        cargarCalendarioSemanal();
    });

    nextWeekBtn.addEventListener('click', () => {
        ajustarSemanaReferencia(7);
        cargarCalendarioSemanal();
    });

    function ajustarSemanaReferencia(dias) {
        const [y, m, d] = fechaReferencia.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + dias);

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        fechaReferencia = `${yyyy}-${mm}-${dd}`;
    }

    // =================================================================
    // 4. ENVÍO DE RESERVA Y VALIDACIÓN
    // =================================================================
    const camposVal = ['nombre', 'telefono'];

    function limpiarErrores() {
        camposVal.forEach(campo => {
            const err = document.getElementById(`error-${campo}`);
            if (err) err.textContent = '';
        });
        generalError.classList.add('hidden');
        conflictError.classList.add('hidden');
    }

    function validarFormulario() {
        let esValido = true;
        limpiarErrores();

        camposVal.forEach(campo => {
            const input = document.getElementById(campo);
            const err = document.getElementById(`error-${campo}`);
            const val = input.value.trim();

            if (!val) {
                err.textContent = 'Este campo es requerido.';
                esValido = false;
            } else if (campo === 'telefono' && !/^\+?[0-9\s\-]{7,15}$/.test(val)) {
                err.textContent = 'Número de teléfono inválido.';
                esValido = false;
            }
        });

        const edad = document.getElementById('edad');
        const errEdad = document.getElementById('error-edad');
        if (edad.value) {
            const valEdad = parseInt(edad.value);
            if (isNaN(valEdad) || valEdad < 12 || valEdad > 120) {
                errEdad.textContent = 'La edad debe estar entre 12 y 120 años.';
                esValido = false;
            }
        }

        return esValido;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validarFormulario()) return;

        setEstadoCarga(true);

        const payload = {
            servicioId: formServicioId.value,
            fecha: formFecha.value,
            hora: formHora.value,
            nombre: document.getElementById('nombre').value,
            telefono: document.getElementById('telefono').value,
            edad: document.getElementById('edad').value,
            genero: document.getElementById('genero').value
        };

        try {
            const res = await fetch('/api/crear-cita', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-slug': getTenantSlug()
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.ok) {
                mostrarPantallaExito(data.datos);
            } else if (res.status === 409) {
                mostrarErrorConflicto(data.mensaje);
            } else {
                mostrarErrorGeneral(data.mensaje || 'Error al procesar la reserva.');
            }
        } catch (err) {
            console.error('Error de red:', err);
            mostrarErrorGeneral('Error de conexión con el servidor.');
        } finally {
            setEstadoCarga(false);
        }
    });

    function setEstadoCarga(cargando) {
        if (cargando) {
            btnSubmit.disabled = true;
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            btnSubmit.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }

    function mostrarErrorGeneral(msg) {
        conflictError.classList.add('hidden');
        generalErrorText.textContent = msg;
        generalError.classList.remove('hidden');
        generalError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function mostrarErrorConflicto(msg) {
        generalError.classList.add('hidden');
        conflictText.textContent = msg;
        conflictError.classList.remove('hidden');
        conflictError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function mostrarPantallaExito(cita) {
        summaryId.textContent = cita.idCita;
        summaryNombre.textContent = cita.nombre;
        summaryServicio.textContent = cita.servicio;
        summaryPrecio.textContent = `$${cita.precio.toLocaleString('es-CO')} COP`;
        summaryDuracion.textContent = `${cita.duracion} min`;
        summaryDatetime.textContent = `${formatearFechaLarga(cita.fecha)} a las ${formatHora(cita.hora)}`;

        // Generar y asociar el enlace de Google Calendar
        btnAddGcal.href = generarEnlaceGoogleCalendar(cita);

        bookingFormWrapper.classList.add('hidden');
        bookingSuccessWrapper.classList.remove('hidden');
        document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
    }

    btnNewBooking.addEventListener('click', () => {
        form.reset();
        limpiarErrores();

        // Regresar a paso 1
        step2.classList.add('hidden');
        step1.classList.remove('hidden');

        bookingSuccessWrapper.classList.add('hidden');
        bookingFormWrapper.classList.remove('hidden');

        // Recargar horarios disponibles
        cargarCalendarioSemanal();
        document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
    });

    // =================================================================
    // 5. FUNCIONES AUXILIARES DE SOPORTE (FECHAS Y TIEMPOS)
    // =================================================================
    function obtenerFechaActualISO() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function formatRangoSemana(fechas) {
        if (!fechas || fechas.length === 0) return '';
        const [y1, m1, d1] = fechas[0].split('-').map(Number);
        const [y2, m2, d2] = fechas[6].split('-').map(Number);

        const mes1 = getMesEspanol(m1 - 1);
        const mes2 = getMesEspanol(m2 - 1);

        if (m1 === m2) {
            return `Semana del ${d1} al ${d2} de ${mes1} de ${y1}`;
        } else {
            return `Semana del ${d1} de ${mes1} al ${d2} de ${mes2} de ${y1}`;
        }
    }

    function formatFechaEspanolCorta(fechaStr) {
        const [y, m, d] = fechaStr.split('-').map(Number);
        // Usar constructor local para evitar desplazamientos de zona horaria
        const date = new Date(y, m - 1, d);
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        return `<strong>${diasSemana[date.getDay()]}</strong><br>${d}<br><span style="font-size: 0.7rem; opacity: 0.85;">${meses[date.getMonth()]}</span>`;
    }

    function formatearFechaLarga(fechaStr) {
        const [y, m, d] = fechaStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        return `${diasSemana[date.getDay()]} ${d} de ${meses[date.getMonth()]} de ${y}`;
    }

    function formatHora(hora24) {
        const [h, m] = hora24.split(':');
        const hora = parseInt(h, 10);
        const ampm = hora >= 12 ? 'PM' : 'AM';
        return `${hora % 12 || 12}:${m} ${ampm}`;
    }

    function getMesEspanol(num) {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[num];
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function verificarDisponibilidadCliente(fecha, horaInicioStr, duracionMinutos, configDay, citasDia, bloqueosDia) {
        if (!configDay || !configDay.activo) return false;

        const esDiaBloqueado = bloqueosDia.some(b => b.tipo === 'dia');
        if (esDiaBloqueado) return false;

        const startMin = timeToMinutes(horaInicioStr);
        const endMin = startMin + duracionMinutos;

        const dayStartMin = timeToMinutes(configDay.inicio);
        const dayEndMin = timeToMinutes(configDay.fin);

        if (startMin < dayStartMin || endMin > dayEndMin) return false;

        // Verificar citas
        const tieneCita = citasDia.some(c => {
            const cStart = timeToMinutes(c.hora);
            const cEnd = cStart + c.duracion;
            return startMin < cEnd && cStart < endMin;
        });
        if (tieneCita) return false;

        // Verificar bloqueos manuales
        const tieneBloqueo = bloqueosDia.some(b => {
            if (b.tipo === 'dia') return true;
            if (b.tipo === 'franja') {
                const bStart = timeToMinutes(b.hora);
                const bEnd = bStart + b.duracion;
                return startMin < bEnd && bStart < endMin;
            }
            return false;
        });
        if (tieneBloqueo) return false;

        return true;
    }

    function generarEnlaceGoogleCalendar(cita) {
        const [y, m, d] = cita.fecha.split('-').map(Number);
        const [h, min] = cita.hora.split(':').map(Number);

        // Crear fecha local
        const dateStart = new Date(y, m - 1, d, h, min);
        const dateEnd = new Date(dateStart.getTime() + cita.duracion * 60 * 1000);

        // Formatear a formato ISO comprimido de Google Calendar (UTC)
        const formatGCal = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const startStr = formatGCal(dateStart);
        const endStr = formatGCal(dateEnd);

        const titulo = encodeURIComponent(`Cita Spa: ${cita.nombre || cita.cliente} (${cita.servicio})`);
        const detalles = encodeURIComponent(
            `💆 Servicio: ${cita.servicio}\n` +
            `👤 Cliente: ${cita.nombre || cita.cliente}\n` +
            `📞 Teléfono: ${cita.telefono}\n` +
            `🆔 ID Cita: ${cita.idCita}\n\n` +
            `*Agendado en SamambaiaSpa*`
        );
        const ubicacion = encodeURIComponent("Calle Jardín Botánico #45, Sector Laurel");

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${startStr}/${endStr}&details=${detalles}&location=${ubicacion}`;
    }
});

// =====================================================================
// HELPER: Autofill Credenciales Demo (banner evaluador SENA)
// =====================================================================
function autofillDemoCredentials() {
    // Guarda las credenciales en sessionStorage para que el dashboard las use
    sessionStorage.setItem('demo_user', 'admin@demoestetica.com');
    sessionStorage.setItem('demo_pass', '123456');
    // Redirige al dashboard — el formulario de login las leerá automáticamente
    const pathParts = window.location.pathname.split('/').filter(p => p);
    const slug = pathParts[0] || 'samambaia';
    window.location.href = `/${slug}/dashboard`;
}

