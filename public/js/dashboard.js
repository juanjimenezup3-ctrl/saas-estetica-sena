/**
 * =====================================================================
 * admin.js — Controlador Frontend del Panel de Administración
 * =====================================================================
 * Proyecto Productivo SENA — Formato GFPI-F-144
 * 
 * DESCRIPCIÓN:
 * Administra el panel de gestión de SamambaiaSpa:
 * 1. Calendario administrativo con visualización de citas de clientes y bloqueos.
 * 2. Cancelación de citas e inicio de bloqueos manuales.
 * 3. Configuración en tiempo real del horario laboral semanal.
 * 4. Bloqueo de días completos (ej. festivos).
 * 5. Consolidación de estadísticas financieras y de agenda.
 * 
 * AUTOR: Samambaia Dev Team
 * FECHA: Mayo 2026
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Interceptor global de Fetch para inyectar x-tenant-slug automáticamente
    (function() {
        const originalFetch = window.fetch;
        window.fetch = async function(url, options = {}) {
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

    // Inicializar iconos de Lucide
    lucide.createIcons();

    // =================================================================
    // ELEMENTOS DEL DOM
    // =================================================================
    const calendarGrid = document.getElementById('admin-calendar-grid');
    const weekLabel = document.getElementById('admin-week-label');
    const prevWeekBtn = document.getElementById('admin-prev-week');
    const nextWeekBtn = document.getElementById('admin-next-week');
    const adminShareWeekBtn = document.getElementById('admin-share-week-btn');

    const totalCitasStat = document.getElementById('admin-stat-total-citas');
    const ingresosStat = document.getElementById('admin-stat-ingresos');

    const formFechaEspecial = document.getElementById('form-fecha-especial');
    const fechaEspecialTipo = document.getElementById('fecha-especial-tipo');
    const wrapperHorasEspeciales = document.getElementById('wrapper-horas-especiales');
    const fechasEspecialesLista = document.getElementById('fechas-especiales-lista');
    const formConfigAuto = document.getElementById('form-config-automatizacion');
    const autoRecordarActivo = document.getElementById('auto-recordar-activo');
    const autoWebhookUrl = document.getElementById('auto-webhook-url');
    const autoRemindersLog = document.getElementById('auto-reminders-log');
    const formConfigGcal = document.getElementById('form-config-gcal');
    const gcalSyncActivo = document.getElementById('gcal-sync-activo');
    const gcalCalendarId = document.getElementById('gcal-calendar-id');
    const gcalServiceKey = document.getElementById('gcal-service-key');
    const gcalKeyStatus = document.getElementById('gcal-key-status');
    const configHorariosBody = document.getElementById('config-horarios-body');

    const citasTableBody = document.getElementById('admin-citas-table-body');
    const citasEmpty = document.getElementById('admin-citas-empty');
    const citasTable = document.getElementById('admin-citas-table');

    // Servicios CRUD
    const tablaServiciosBody = document.getElementById('tabla-servicios-body');
    const btnAgregarServicio = document.getElementById('btn-agregar-servicio');
    const modalServicio = document.getElementById('modal-servicio');
    const formServicio = document.getElementById('form-servicio');
    const modalServicioTitulo = document.getElementById('modal-servicio-titulo');
    const modalServicioId = document.getElementById('modal-servicio-id');
    const modalServicioNombre = document.getElementById('modal-servicio-nombre');
    const modalServicioCategoria = document.getElementById('modal-servicio-categoria');
    const modalServicioDuracion = document.getElementById('modal-servicio-duracion');
    const modalServicioPrecio = document.getElementById('modal-servicio-precio');
    const modalServicioDescripcion = document.getElementById('modal-servicio-descripcion');
    const modalServicioOferta = document.getElementById('modal-servicio-oferta');
    const modalServicioDescuento = document.getElementById('modal-servicio-descuento');
    const modalServicioPrecioEsp = document.getElementById('modal-servicio-precio-esp');
    const modalServicioBtnCerrar = document.getElementById('modal-servicio-btn-cerrar');

    // Modales
    const modalCita = document.getElementById('modal-cita');
    const modalCitaTitulo = document.getElementById('modal-cita-titulo');
    const modalCitaCuerpo = document.getElementById('modal-cita-cuerpo');
    const modalCitaBtnCerrar = document.getElementById('modal-cita-btn-cerrar');
    const modalCitaBtnCancelar = document.getElementById('modal-cita-btn-cancelar');
    const modalCitaBtnRecordar = document.getElementById('modal-cita-btn-recordar');
    const modalCitaBtnGcal = document.getElementById('modal-cita-btn-gcal');

    const modalBloqueo = document.getElementById('modal-bloqueo');
    const modalBlockFecha = document.getElementById('modal-block-fecha');
    const modalBlockHora = document.getElementById('modal-block-hora');
    const lblBlockFecha = document.getElementById('lbl-block-fecha');
    const lblBlockHora = document.getElementById('lbl-block-hora');
    const modalBlockBtnCerrar = document.getElementById('modal-block-btn-cerrar');
    const formCrearBloqueoFranja = document.getElementById('form-crear-bloqueo-franja');
    const modalShareTel = document.getElementById('modal-share-tel');
    const modalShareBtnWhatsapp = document.getElementById('modal-share-btn-whatsapp');

    const modalLiberarBloqueo = document.getElementById('modal-liberar-bloqueo');
    const modalLiberarId = document.getElementById('modal-liberar-id');
    const lblLiberarDetalle = document.getElementById('lbl-liberar-detalle');
    const modalLiberarBtnCerrar = document.getElementById('modal-liberar-btn-cerrar');
    const modalLiberarBtnConfirmar = document.getElementById('modal-liberar-btn-confirmar');

    // =================================================================
    // ESTADO DE LA APLICACIÓN
    // =================================================================
    let fechaReferencia = obtenerFechaActualISO();
    let citasGlobal = [];
    let bloqueosGlobal = [];
    let configHorarioGlobal = {};
    let activeCitaSeleccionada = null;

    // Nombres de los días de la semana (Lunes=1, Domingo=0/7 en JS getDay)
    const nombresDiasSemana = {
        1: 'Lunes',
        2: 'Martes',
        3: 'Miércoles',
        4: 'Jueves',
        5: 'Viernes',
        6: 'Sábado',
        0: 'Domingo'
    };

    // =================================================================
    // CARGAR DATOS GENERALES
    // =================================================================
    async function cargarPanelAdmin() {
        try {
            // Cargar configuración de horario de operación
            const resConfig = await fetch('/api/admin/configuracion-horario');
            const dataConfig = await resConfig.json();
            if (resConfig.ok && dataConfig.ok) {
                configHorarioGlobal = dataConfig.datos;
                renderizarConfiguracionHorarios();
            }

            // Cargar datos de la semana actual (citas, bloqueos, fechas)
            const resSemana = await fetch(`/api/calendario-semana?fecha=${fechaReferencia}`);
            const dataSemana = await resSemana.json();
            if (resSemana.ok && dataSemana.ok) {
                const { fechas, citas, bloqueos } = dataSemana.datos;
                citasGlobal = citas;
                bloqueosGlobal = bloqueos;
                
                renderizarGridAdmin(dataSemana.datos);
                renderizarListadoGeneralCitas(citas);
                actualizarEstadisticas(citas);
            }

            // Cargar configuración de automatización
            await cargarAutomatizacionConfig();
            
            // Cargar configuración de Google Calendar
            await cargarGoogleCalendarConfig();

            // Cargar catálogo de servicios
            await cargarServiciosCatalog();

            // Cargar listado de fechas especiales (bloqueos y aperturas)
            await cargarFechasEspecialesLista();
        } catch (error) {
            console.error('Error cargando panel admin:', error);
            alert('Error de conexión con el servidor.');
        }
    }

    // Inicializar el panel
    cargarPanelAdmin();

    // =================================================================
    // RENDERIZADO DEL GRID DE CALENDARIO (ADMIN)
    // =================================================================
    function renderizarGridAdmin(datosSemana) {
        const { fechas, citas, bloqueos, configuracionHorario, horariosFechas } = datosSemana;

        weekLabel.textContent = formatRangoSemana(fechas);
        calendarGrid.innerHTML = '';
        calendarGrid.className = 'grid grid-cols-[75px_repeat(7,minmax(115px,1fr))] min-w-[880px]';

        // Cabecera Hora
        const cellHoraHeader = document.createElement('div');
        cellHoraHeader.className = 'sticky top-0 left-0 z-20 bg-[#2c3e2f] text-white text-center py-2 px-1 text-[0.72rem] font-semibold border-r border-b border-[#dae4db]/30 flex items-center justify-center';
        cellHoraHeader.textContent = 'Hora';
        calendarGrid.appendChild(cellHoraHeader);

        // Cabecera Días
        fechas.forEach(f => {
            const cellDayHeader = document.createElement('div');
            cellDayHeader.className = 'sticky top-0 z-10 bg-gradient-to-br from-[#2c3e2f] to-[#4a5f4d] text-white text-center py-2 px-1 text-[0.72rem] font-semibold border-r border-b border-[#dae4db]/20 flex flex-col items-center justify-center min-h-[52px]';
            cellDayHeader.innerHTML = formatFechaEspanolCorta(f);
            calendarGrid.appendChild(cellDayHeader);
        });

        // Franjas de tiempo de 8:00 AM a 7:00 PM
        const startMin = 8 * 60;
        const endMin = 19 * 60;

        for (let m = startMin; m < endMin; m += 30) {
            const timeStr = minutesToTime(m);

            // Etiqueta de la hora
            const cellTimeLabel = document.createElement('div');
            cellTimeLabel.className = 'sticky left-0 z-10 bg-[#fafbfa] border-r border-b border-[#dae4db] text-[0.68rem] font-semibold text-[#2c3e2f] flex items-center justify-center min-h-[46px]';
            cellTimeLabel.textContent = formatHora(timeStr);
            calendarGrid.appendChild(cellTimeLabel);

            // Celdas por día
            fechas.forEach((fechaStr, colIndex) => {
                const cell = document.createElement('div');
                cell.className = 'p-1 border-r border-b border-[#dae4db]/40 min-h-[46px] flex flex-col justify-center bg-white';

                const dayOfWeek = (colIndex === 6) ? 0 : colIndex + 1;
                const configDay = (horariosFechas && horariosFechas[fechaStr]) ? horariosFechas[fechaStr] : configuracionHorario[dayOfWeek];

                let estado = 'disponible';
                let blockReason = '';
                let citaAsociada = null;
                let bloqueoAsociado = null;

                const citasDia = citas.filter(c => c.fecha === fechaStr);
                const bloqueosDia = bloqueos.filter(b => b.fecha === fechaStr);

                const esDiaBloqueado = bloqueosDia.some(b => b.tipo === 'dia');

                if (!configDay || !configDay.activo) {
                    estado = 'bloqueado';
                    blockReason = 'Cerrado';
                } else {
                    const slotStart = m;
                    const slotEnd = m + 30;

                    const dayStart = timeToMinutes(configDay.inicio);
                    const dayEnd = timeToMinutes(configDay.fin);

                    if (slotStart < dayStart || slotEnd > dayEnd) {
                        estado = 'bloqueado';
                        blockReason = 'Fuera de horario';
                    } else if (esDiaBloqueado) {
                        estado = 'bloqueado';
                        bloqueoAsociado = bloqueosDia.find(x => x.tipo === 'dia');
                        blockReason = bloqueoAsociado ? bloqueoAsociado.descripcion : 'Día Bloqueado';
                        bloqueoId = bloqueoAsociado ? bloqueoAsociado.id : null;
                    } else {
                        // Buscar citas
                        citaAsociada = citasDia.find(c => {
                            const cStart = timeToMinutes(c.hora);
                            const cEnd = cStart + c.duracion;
                            return slotStart < cEnd && cStart < slotEnd;
                        });

                        if (citaAsociada) {
                            estado = 'ocupado';
                        } else {
                            // Buscar bloqueos
                            bloqueoAsociado = bloqueosDia.find(b => {
                                if (b.tipo !== 'franja') return false;
                                const bStart = timeToMinutes(b.hora);
                                const bEnd = bStart + b.duracion;
                                return slotStart < bEnd && bStart < slotEnd;
                            });

                            if (bloqueoAsociado) {
                                estado = 'bloqueado-manual';
                                blockReason = bloqueoAsociado.descripcion;
                            }
                        }
                    }
                }

                const btn = document.createElement('button');
                btn.type = 'button';
                
                // Clases base del botón admin
                let btnClasses = 'w-full h-full border rounded-lg font-sans text-[0.7rem] font-bold cursor-pointer transition-all p-1.5 flex flex-col items-center justify-center text-center shadow-sm min-h-[38px] active:scale-95 ';

                if (estado === 'disponible') {
                    btnClasses += 'bg-green-50/70 text-green-800 border-green-200/80 hover:bg-green-600 hover:text-white hover:border-transparent hover:shadow-green-100 hover:-translate-y-0.5';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span>Libre</span><span class="text-[0.58rem] opacity-75 font-normal mt-0.5">${formatHora(timeStr)}</span>`;
                    btn.addEventListener('click', () => abrirModalCrearBloqueo(fechaStr, timeStr));
                } else if (estado === 'ocupado') {
                    btnClasses += 'bg-red-50 text-red-700 border-red-200/80 hover:bg-red-600 hover:text-white hover:border-transparent hover:-translate-y-0.5';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span class="truncate max-w-full block">${citaAsociada.cliente}</span><span class="text-[0.55rem] opacity-75 font-normal truncate max-w-full block mt-0.5">${citaAsociada.servicio}</span>`;
                    btn.addEventListener('click', () => abrirModalDetallesCita(citaAsociada));
                } else if (estado === 'bloqueado-manual') {
                    btnClasses += 'bg-amber-50 text-amber-700 border-amber-200/80 border-dashed hover:bg-amber-600 hover:text-white hover:border-transparent hover:-translate-y-0.5';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span class="font-bold">🚫 Bloqueo</span><span class="text-[0.55rem] opacity-75 font-normal truncate max-w-full block mt-0.5">${blockReason}</span>`;
                    btn.addEventListener('click', () => abrirModalLiberarBloqueo(bloqueoAsociado));
                } else {
                    btnClasses += 'bg-gray-100 text-gray-450 border-gray-200/60 cursor-not-allowed opacity-75';
                    btn.className = btnClasses;
                    btn.innerHTML = `<span class="font-normal text-[0.62rem]">${blockReason || 'Cerrado'}</span>`;
                    btn.disabled = true;
                }

                cell.appendChild(btn);
                calendarGrid.appendChild(cell);
            });
        }
    }

    // =================================================================
    // MANEJO DE MODALES
    // =================================================================

    // 1. Modal detalles de cita
    function abrirModalDetallesCita(cita) {
        activeCitaSeleccionada = cita;
        modalCitaTitulo.textContent = `Reserva: ${cita.idCita}`;
        modalCitaCuerpo.innerHTML = `
            <p>👤 <strong>Cliente:</strong> ${cita.cliente}</p>
            <p>📞 <strong>Teléfono:</strong> <a href="tel:${cita.telefono}">${cita.telefono}</a></p>
            <p>🎂 <strong>Edad:</strong> ${cita.edad ? cita.edad + ' años' : 'No especificada'}</p>
            <p>⚧ <strong>Género:</strong> ${cita.genero || 'No especificado'}</p>
            <hr style="border:none; border-top:1px solid var(--border-light); margin:0.5rem 0;">
            <p>💆 <strong>Servicio:</strong> ${cita.servicio} (${cita.categoria})</p>
            <p>⏱️ <strong>Duración:</strong> ${cita.duracion} minutos</p>
            <p>💰 <strong>Precio:</strong> $${cita.precio.toLocaleString('es-CO')} COP</p>
            <p>📅 <strong>Fecha:</strong> ${formatearFechaLarga(cita.fecha)}</p>
            <p>⏰ <strong>Hora:</strong> ${formatHora(cita.hora)}</p>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">Registrada el: ${cita.fechaRegistro}</p>
        `;
        // Asociar enlace de Google Calendar
        modalCitaBtnGcal.href = generarEnlaceGoogleCalendar(cita);
        modalCita.classList.remove('hidden');
    }

    modalCitaBtnCerrar.addEventListener('click', () => {
        modalCita.classList.add('hidden');
        activeCitaSeleccionada = null;
    });

    modalCitaBtnRecordar.addEventListener('click', () => {
        if (activeCitaSeleccionada) {
            enviarRecordatorioWhatsApp(activeCitaSeleccionada);
        }
    });

    modalCitaBtnCancelar.addEventListener('click', async () => {
        if (!activeCitaSeleccionada) return;
        
        if (confirm(`¿Estás segura de cancelar la cita de ${activeCitaSeleccionada.cliente} para ${activeCitaSeleccionada.servicio}?`)) {
            try {
                const res = await fetch(`/api/citas/${activeCitaSeleccionada.idCita}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                
                if (res.ok && data.ok) {
                    alert(data.mensaje);
                    modalCita.classList.add('hidden');
                    cargarPanelAdmin();
                } else {
                    alert(data.mensaje || 'Error al cancelar la cita.');
                }
            } catch (err) {
                console.error(err);
                alert('Error de conexión.');
            }
        }
    });

    // 2. Modal crear bloqueo de franja
    function abrirModalCrearBloqueo(fecha, hora) {
        modalBlockFecha.value = fecha;
        modalBlockHora.value = hora;
        lblBlockFecha.textContent = formatearFechaLarga(fecha);
        lblBlockHora.textContent = formatHora(hora);
        
        // Reset
        document.getElementById('modal-block-duracion').value = '30';
        document.getElementById('modal-block-desc').value = '';
        modalShareTel.value = '';
        
        modalBloqueo.classList.remove('hidden');
    }

    modalBlockBtnCerrar.addEventListener('click', () => {
        modalBloqueo.classList.add('hidden');
    });

    modalShareBtnWhatsapp.addEventListener('click', () => {
        const fecha = modalBlockFecha.value;
        const hora = modalBlockHora.value;
        const tel = modalShareTel.value.trim();
        
        const fechaFormateada = formatearFechaLarga(fecha);
        const horaFormateada = formatHora(hora);
        const currentUrl = window.location.origin;
        
        const mensaje = `¡Hola! 🌸 Te contamos que tenemos agenda disponible en *SamambaiaSpa* para el día *${fechaFormateada}* a las *${horaFormateada}*.\n\n` +
            `Si deseas reservar este espacio, puedes agendar directamente aquí: ${currentUrl}\n\n` +
            `¡Te esperamos con mucho gusto! 💜`;
            
        let url = '';
        if (tel) {
            const telLimpio = limpiarTelefonoParaWhatsApp(tel);
            url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;
        } else {
            url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
        }
        
        window.open(url, '_blank');
        modalBloqueo.classList.add('hidden');
    });

    formCrearBloqueoFranja.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            tipo: 'franja',
            fecha: modalBlockFecha.value,
            hora: modalBlockHora.value,
            duracion: document.getElementById('modal-block-duracion').value,
            descripcion: document.getElementById('modal-block-desc').value.trim()
        };

        try {
            const res = await fetch('/api/admin/bloquear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                modalBloqueo.classList.add('hidden');
                cargarPanelAdmin();
            } else {
                alert(data.mensaje || 'Error al bloquear el horario.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión.');
        }
    });

    // 3. Modal liberar bloqueo
    function abrirModalLiberarBloqueo(bloqueo) {
        modalLiberarId.value = bloqueo.id;
        lblLiberarDetalle.textContent = `${bloqueo.tipo === 'dia' ? 'Día Completo' : 'Franja'} - ${bloqueo.descripcion} el ${formatearFechaLarga(bloqueo.fecha)} ${bloqueo.hora ? 'a las ' + formatHora(bloqueo.hora) : ''}`;
        modalLiberarBloqueo.classList.remove('hidden');
    }

    modalLiberarBtnCerrar.addEventListener('click', () => {
        modalLiberarBloqueo.classList.add('hidden');
    });

    modalLiberarBtnConfirmar.addEventListener('click', async () => {
        const id = modalLiberarId.value;
        try {
            const res = await fetch(`/api/admin/bloquear/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                modalLiberarBloqueo.classList.add('hidden');
                cargarPanelAdmin();
            } else {
                alert(data.mensaje || 'Error al liberar el horario.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión.');
        }
    });

    // =================================================================
    // CONFIGURACIÓN DE OPERACIÓN DIARIA
    // =================================================================
    function renderizarConfiguracionHorarios() {
        configHorariosBody.innerHTML = '';
        
        // Ordenar Lunes (1) a Sábado (6) y Domingo (0)
        const ordenDias = [1, 2, 3, 4, 5, 6, 0];
        
        ordenDias.forEach(diaKey => {
            const config = configHorarioGlobal[diaKey];
            if (!config) return;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#fafbfa] transition-colors border-b border-[#dae4db]/40';
            tr.innerHTML = `
                <td class="py-2.5 text-[#2c3d2e]"><strong>${nombresDiasSemana[diaKey]}</strong></td>
                <td class="py-2.5">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="activo-${diaKey}" class="sr-only peer" ${config.activo ? 'checked' : ''}>
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </td>
                <td class="py-2.5">
                    <input type="time" class="px-2 py-1 border border-[#dae4db] rounded-lg text-xs bg-[#fafbfa] focus:outline-none focus:ring-1 focus:ring-green-600 text-[#2c3d2e] font-sans" id="inicio-${diaKey}" value="${config.inicio}">
                </td>
                <td class="py-2.5">
                    <input type="time" class="px-2 py-1 border border-[#dae4db] rounded-lg text-xs bg-[#fafbfa] focus:outline-none focus:ring-1 focus:ring-green-600 text-[#2c3d2e] font-sans" id="fin-${diaKey}" value="${config.fin}">
                </td>
                <td class="py-2.5 text-right">
                    <button type="button" class="btn-save-config px-3 py-1 bg-white text-[#2c3e2f] border border-[#dae4db] hover:bg-[#2c3e2f] hover:text-white hover:border-transparent font-semibold rounded-lg transition-all text-[0.7rem] active:scale-95 cursor-pointer" data-dia="${diaKey}">
                        Guardar
                    </button>
                </td>
            `;
            configHorariosBody.appendChild(tr);
        });

        // Event listener para guardar la config de un día
        document.querySelectorAll('.btn-save-config').forEach(btn => {
            btn.addEventListener('click', async () => {
                const dia = btn.getAttribute('data-dia');
                const activo = document.getElementById(`activo-${dia}`).checked;
                const inicio = document.getElementById(`inicio-${dia}`).value;
                const fin = document.getElementById(`fin-${dia}`).value;

                if (!inicio || !fin) {
                    alert('Debes ingresar horas válidas.');
                    return;
                }

                try {
                    const res = await fetch('/api/admin/configurar-horario', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dia, activo, inicio, fin })
                    });
                    const data = await res.json();
                    
                    if (res.ok && data.ok) {
                        alert(`Horario de ${nombresDiasSemana[dia]} actualizado correctamente.`);
                        cargarPanelAdmin();
                    } else {
                        alert(data.mensaje || 'Error al actualizar configuración.');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error de conexión.');
                }
            });
        });
    }

    // =================================================================
    // ACCIÓN: BLOQUEAR DÍA COMPLETO
    // =================================================================
    // Alternar visualización de horas según el tipo de acción
    fechaEspecialTipo.addEventListener('change', () => {
        if (fechaEspecialTipo.value === 'apertura') {
            wrapperHorasEspeciales.classList.remove('hidden');
        } else {
            wrapperHorasEspeciales.classList.add('hidden');
        }
    });

    // Registrar fecha especial (bloqueo de día o apertura especial)
    formFechaEspecial.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipo = fechaEspecialTipo.value;
        const fecha = document.getElementById('fecha-especial-date').value;
        const descripcion = document.getElementById('fecha-especial-desc').value.trim();

        if (!fecha || !descripcion) return;

        if (tipo === 'bloqueo') {
            try {
                const res = await fetch('/api/admin/bloquear', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tipo: 'dia', fecha, descripcion })
                });
                const data = await res.json();

                if (res.ok && data.ok) {
                    alert(`Día ${fecha} bloqueado exitosamente.`);
                    formFechaEspecial.reset();
                    wrapperHorasEspeciales.classList.add('hidden');
                    cargarPanelAdmin();
                } else {
                    alert(data.mensaje || 'Error al registrar bloqueo.');
                }
            } catch (err) {
                console.error(err);
                alert('Error de red.');
            }
        } else if (tipo === 'apertura') {
            const inicio = document.getElementById('fecha-especial-inicio').value;
            const fin = document.getElementById('fecha-especial-fin').value;

            if (!inicio || !fin) {
                alert('Debes ingresar horas válidas de inicio y fin.');
                return;
            }

            try {
                const res = await fetch('/api/admin/aperturas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha, inicio, fin, descripcion })
                });
                const data = await res.json();

                if (res.ok && data.ok) {
                    alert(`Día especial ${fecha} habilitado de ${formatHora(inicio)} a ${formatHora(fin)}.`);
                    formFechaEspecial.reset();
                    wrapperHorasEspeciales.classList.add('hidden');
                    cargarPanelAdmin();
                } else {
                    alert(data.mensaje || 'Error al registrar la apertura especial.');
                }
            } catch (err) {
                console.error(err);
                alert('Error de red.');
            }
        }
    });

    // Cargar y renderizar la lista consolidada de fechas especiales
    async function cargarFechasEspecialesLista() {
        try {
            // 1. Obtener aperturas
            const resAperturas = await fetch('/api/admin/aperturas');
            const dataAperturas = await resAperturas.json();
            const aperturasLista = dataAperturas.ok ? dataAperturas.datos : [];

            // 2. Obtener bloqueos (filtrar solo los de tipo "dia")
            const resBloqueos = await fetch('/api/admin/bloqueos');
            const dataBloqueos = await resBloqueos.json();
            const bloqueosLista = dataBloqueos.ok ? dataBloqueos.datos.filter(b => b.tipo === 'dia') : [];

            fechasEspecialesLista.innerHTML = '';
            
            if (aperturasLista.length === 0 && bloqueosLista.length === 0) {
                fechasEspecialesLista.innerHTML = '<div class="text-[#5a735e] text-center py-4">No hay configuraciones especiales guardadas.</div>';
                return;
            }

            // Renderizar Bloqueos de Día
            bloqueosLista.forEach(b => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center p-2 rounded-lg border border-red-100 bg-red-50/50 shadow-sm text-left';
                item.innerHTML = `
                    <div>
                        <span class="font-bold text-red-700">🚫 Bloqueo: ${b.fecha}</span>
                        <span class="block text-[0.62rem] text-red-855/90 mt-0.5">${b.descripcion}</span>
                    </div>
                    <button type="button" class="btn-eliminar-fecha-esp p-1 text-red-700 hover:text-red-900 hover:bg-red-100/50 rounded transition-all cursor-pointer" data-id="${b.id}" data-tipo="bloqueo" title="Eliminar Bloqueo">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                `;
                fechasEspecialesLista.appendChild(item);
            });

            // Renderizar Aperturas Especiales
            aperturasLista.forEach(a => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center p-2 rounded-lg border border-green-150 bg-green-50/50 shadow-sm text-left';
                item.innerHTML = `
                    <div>
                        <span class="font-bold text-green-800">🟢 Apertura: ${a.fecha}</span>
                        <span class="block text-[0.62rem] text-green-900/90 mt-0.5">${a.descripcion} (${formatHora(a.inicio)} - ${formatHora(a.fin)})</span>
                    </div>
                    <button type="button" class="btn-eliminar-fecha-esp p-1 text-green-800 hover:text-green-900 hover:bg-green-100/50 rounded transition-all cursor-pointer" data-id="${a.id}" data-tipo="apertura" title="Eliminar Apertura">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                `;
                fechasEspecialesLista.appendChild(item);
            });

            // Bind de los botones de eliminación
            fechasEspecialesLista.querySelectorAll('.btn-eliminar-fecha-esp').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const tipo = btn.getAttribute('data-tipo');

                    if (confirm(`¿Estás segura de eliminar esta configuración especial?`)) {
                        try {
                            const url = tipo === 'bloqueo' ? `/api/admin/bloquear/${id}` : `/api/admin/aperturas/${id}`;
                            const res = await fetch(url, { method: 'DELETE' });
                            const data = await res.json();

                            if (res.ok && data.ok) {
                                alert(data.mensaje || 'Configuración eliminada.');
                                cargarPanelAdmin();
                            } else {
                                alert(data.mensaje || 'Error al eliminar.');
                            }
                        } catch (err) {
                            console.error(err);
                            alert('Error de conexión.');
                        }
                    }
                });
            });

            lucide.createIcons();
        } catch (err) {
            console.error('Error cargando lista de fechas especiales:', err);
        }
    }

    // =================================================================
    // ACCIÓN: CONFIGURAR AUTOMATIZACIÓN DE WHATSAPP
    // =================================================================
    formConfigAuto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            recordatoriosActivos: autoRecordarActivo.checked,
            webhookUrl: autoWebhookUrl.value.trim()
        };

        try {
            const res = await fetch('/api/admin/automatizacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok && data.ok) {
                alert('Configuración de automatización guardada correctamente.');
                cargarAutomatizacionConfig();
            } else {
                alert(data.mensaje || 'Error al guardar configuración.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión.');
        }
    });

    async function cargarAutomatizacionConfig() {
        try {
            const res = await fetch('/api/admin/automatizacion');
            const data = await res.json();
            if (res.ok && data.ok) {
                const { configuracion, historial } = data.datos;
                autoRecordarActivo.checked = configuracion.recordatoriosActivos;
                autoWebhookUrl.value = configuracion.webhookUrl || '';
                renderizarHistorialAutomatizacion(historial);
            }
        } catch (err) {
            console.error('Error al cargar config de automatización:', err);
        }
    }

    function renderizarHistorialAutomatizacion(historial) {
        if (!historial || historial.length === 0) {
            autoRemindersLog.innerHTML = '<div class="text-text-muted text-center py-4">No hay envíos registrados aún.</div>';
            return;
        }

        autoRemindersLog.innerHTML = '';
        historial.forEach(log => {
            const item = document.createElement('div');
            item.className = 'p-2 rounded-lg border border-purple-100 bg-white/70 space-y-0.5 shadow-sm text-left';
            
            let badgeClass = 'bg-yellow-50 text-yellow-700 border-yellow-200/50';
            if (log.estado.includes('Webhook')) {
                badgeClass = 'bg-green-50 text-green-700 border-green-200/50';
            } else if (log.estado.includes('Simulado')) {
                badgeClass = 'bg-blue-50 text-blue-700 border-blue-200/50';
            } else if (log.estado.includes('Error')) {
                badgeClass = 'bg-red-50 text-red-700 border-red-200/50';
            }

            item.innerHTML = `
                <div class="flex justify-between items-center font-bold">
                    <span class="text-purple-deep">${log.idCita} · ${log.cliente}</span>
                    <span class="px-1.5 py-0.5 rounded text-[0.55rem] border ${badgeClass}">${log.estado}</span>
                </div>
                <div class="text-[0.6rem] text-text-muted flex justify-between">
                    <span>Cita: ${formatearFechaLarga(log.fechaCita)} a las ${formatHora(log.horaCita)}</span>
                    <span class="italic">Enviado: ${log.fechaEnvio}</span>
                </div>
            `;
            autoRemindersLog.appendChild(item);
        });
    }

    // Polling de logs de automatización cada 10 segundos
    setInterval(async () => {
        if (autoRecordarActivo.checked) {
            try {
                const res = await fetch('/api/admin/automatizacion');
                const data = await res.json();
                if (res.ok && data.ok) {
                    renderizarHistorialAutomatizacion(data.datos.historial);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }, 10000);

    // =================================================================
    // ACCIÓN: CONFIGURAR GOOGLE CALENDAR
    // =================================================================
    formConfigGcal.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            syncActiva: gcalSyncActivo.checked,
            calendarId: gcalCalendarId.value.trim(),
            serviceAccountKey: gcalServiceKey.value.trim()
        };

        try {
            const res = await fetch('/api/admin/google-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok && data.ok) {
                alert('Configuración de Google Calendar guardada correctamente.');
                gcalServiceKey.value = ''; // Limpiar textarea
                await cargarGoogleCalendarConfig();
                cargarPanelAdmin();
            } else {
                alert(data.mensaje || 'Error al guardar configuración.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión.');
        }
    });

    async function cargarGoogleCalendarConfig() {
        try {
            const res = await fetch('/api/admin/google-calendar');
            const data = await res.json();
            if (res.ok && data.ok) {
                const { syncActiva, calendarId, serviceAccountKeyPresent } = data.datos;
                gcalSyncActivo.checked = syncActiva;
                gcalCalendarId.value = calendarId || '';
                
                if (serviceAccountKeyPresent) {
                    gcalKeyStatus.classList.remove('hidden');
                    gcalServiceKey.placeholder = 'Clave JSON ya cargada. Pega una nueva aquí para reemplazarla.';
                } else {
                    gcalKeyStatus.classList.add('hidden');
                    gcalServiceKey.placeholder = '{"type": "service_account", ...}';
                }
            }
        } catch (err) {
            console.error('Error al cargar config de Google Calendar:', err);
        }
    }

    // =================================================================
    // LISTADO GENERAL DE CITAS
    // =================================================================
    function renderizarListadoGeneralCitas(citas) {
        citasTableBody.innerHTML = '';
        
        // Filtrar citas activas y ordenar cronológicamente
        const citasOrdenadas = [...citas].sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.hora.localeCompare(b.hora);
        });

        if (citasOrdenadas.length === 0) {
            citasEmpty.classList.remove('hidden');
            citasTable.classList.add('hidden');
            return;
        }

        citasEmpty.classList.add('hidden');
        citasTable.classList.remove('hidden');

        citasOrdenadas.forEach(c => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#fafbfa] transition-colors border-b border-[#dae4db]/40';
            tr.innerHTML = `
                <td class="py-2.5 px-3"><span class="inline-block bg-[#f4f6f4] border border-[#dae4db] text-[#2c3d2e] font-bold text-[0.72rem] px-2 py-0.5 rounded">${c.idCita}</span></td>
                <td class="py-2.5 px-3">
                    <div class="font-medium text-[#2c3d2e] text-[0.82rem]">${c.cliente}</div>
                    <div class="text-[0.7rem] text-[#5a735e] mt-0.5">${c.telefono}</div>
                </td>
                <td class="py-2.5 px-3">
                    <div class="font-medium text-[#2c3d2e] text-[0.82rem]">${c.servicio}</div>
                    <div class="text-[0.7rem] text-[#5a735e] mt-0.5">${c.categoria} · ${c.duracion} min</div>
                </td>
                <td class="py-2.5 px-3 text-[#2c3d2e] text-[0.82rem]">${formatearFechaLarga(c.fecha)}</td>
                <td class="py-2.5 px-3 text-[#2c3d2e] text-[0.82rem]">${formatHora(c.hora)}</td>
                <td class="py-2.5 px-3"><span class="inline-block text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">${c.estado}</span></td>
                <td class="py-2.5 px-3 text-right flex justify-end gap-1.5">
                    <button type="button" class="btn-recordar-tabla px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-600 hover:text-white hover:border-transparent font-semibold rounded-lg transition-all text-[0.7rem] active:scale-95 cursor-pointer" data-id="${c.idCita}">
                        Recordar
                    </button>
                    <button type="button" class="btn-cancelar-tabla px-2.5 py-1 border border-red-200 text-red-700 bg-red-50 hover:bg-red-600 hover:text-white font-semibold rounded-lg transition-all text-[0.7rem] active:scale-95 cursor-pointer" data-id="${c.idCita}">
                        Cancelar
                    </button>
                </td>
            `;

            tr.querySelector('.btn-recordar-tabla').addEventListener('click', () => {
                enviarRecordatorioWhatsApp(c);
            });

            tr.querySelector('.btn-cancelar-tabla').addEventListener('click', () => {
                activeCitaSeleccionada = c;
                modalCitaBtnCancelar.click();
            });

            citasTableBody.appendChild(tr);
        });
    }

    // =================================================================
    // ACTUALIZAR ESTADISTICAS
    // =================================================================
    function actualizarEstadisticas(citas) {
        // Reservas activas
        const activas = citas.filter(c => c.estado !== 'Cancelada');
        totalCitasStat.textContent = activas.length;

        // Calcular ingresos sumando precios
        const totalIngresos = activas.reduce((acc, curr) => acc + curr.precio, 0);
        ingresosStat.textContent = `$${totalIngresos.toLocaleString('es-CO')} COP`;
    }

    // Navegación de semanas
    prevWeekBtn.addEventListener('click', () => {
        ajustarSemanaReferencia(-7);
        cargarPanelAdmin();
    });

    nextWeekBtn.addEventListener('click', () => {
        ajustarSemanaReferencia(7);
        cargarPanelAdmin();
    });

    adminShareWeekBtn.addEventListener('click', () => {
        const rangoSemana = weekLabel.textContent;
        const currentUrl = window.location.origin;
        
        const mensaje = `¡Hola! 🌸 Te contamos que ya está abierta nuestra agenda de bienestar en *SamambaiaSpa* para la *${rangoSemana}*.\n\n` +
            `Separa tu cita favorita con anticipación haciendo clic aquí: ${currentUrl}\n\n` +
            `¡Te esperamos con mucho cariño! 💜`;
            
        const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
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
    // SOPORTE DE HORAS Y FECHAS
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

    function enviarRecordatorioWhatsApp(cita) {
        const telefonoLimpio = limpiarTelefonoParaWhatsApp(cita.telefono);
        const mensaje = `Hola ${cita.cliente}! 🌸 Te recordamos tu cita de bienestar en *SamambaiaSpa*:\n\n` +
            `💆 *Servicio:* ${cita.servicio}\n` +
            `📅 *Fecha:* ${formatearFechaLarga(cita.fecha)}\n` +
            `⏰ *Hora:* ${formatHora(cita.hora)}\n` +
            `⏱️ *Duración:* ${cita.duracion} min\n\n` +
            `Te recomendamos llegar 10 minutos antes para registrar tu ingreso. ¡Te esperamos con mucho gusto! 💜`;
        
        const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    }

    function limpiarTelefonoParaWhatsApp(tel) {
        let clean = tel.replace(/[^0-9]/g, '');
        if (clean.length === 10 && clean.startsWith('3')) {
            clean = '57' + clean;
        }
        return clean;
    }

    function generarEnlaceGoogleCalendar(cita) {
        const [y, m, d] = cita.fecha.split('-').map(Number);
        const [h, min] = cita.hora.split(':').map(Number);
        
        const dateStart = new Date(y, m - 1, d, h, min);
        const dateEnd = new Date(dateStart.getTime() + cita.duracion * 60 * 1000);
        
        const formatGCal = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const startStr = formatGCal(dateStart);
        const endStr = formatGCal(dateEnd);
        
        const titulo = encodeURIComponent(`Cita Spa: ${cita.cliente} (${cita.servicio})`);
        const detalles = encodeURIComponent(
            `💆 Servicio: ${cita.servicio}\n` +
            `👤 Cliente: ${cita.cliente}\n` +
            `📞 Teléfono: ${cita.telefono}\n` +
            `🆔 ID Cita: ${cita.idCita}\n\n` +
            `*Agendado vía SamambaiaSpa*`
        );
        const ubicacion = encodeURIComponent("Calle Jardín Botánico #45, Sector Laurel");
        
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${startStr}/${endStr}&details=${detalles}&location=${ubicacion}`;
    }

    // =================================================================
    // GESTIÓN DE SERVICIOS (CRUD CATALOG)
    // =================================================================
    let serviciosGlobal = [];

    async function cargarServiciosCatalog() {
        try {
            const res = await fetch('/api/servicios');
            const data = await res.json();
            if (res.ok && data.ok) {
                serviciosGlobal = data.datos;
                renderizarTablaServicios(serviciosGlobal);
            }
        } catch (err) {
            console.error('Error al cargar catálogo de servicios:', err);
        }
    }

    function renderizarTablaServicios(servicios) {
        tablaServiciosBody.innerHTML = '';
        if (servicios.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="py-4 text-center text-[#5a735e]">No hay servicios en el catálogo.</td>`;
            tablaServiciosBody.appendChild(tr);
            return;
        }

        servicios.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#fafbfa] transition-colors border-b border-[#dae4db]/20';
            
            const nameHtml = `
                <div class="font-medium text-[#2c3d2e] flex flex-wrap items-center gap-1.5">
                    <span>${s.nombre}</span>
                    ${s.ofertaDelDia ? '<span class="bg-amber-100 text-amber-800 text-[0.55rem] font-bold px-1.5 py-0.5 rounded border border-amber-200">🔥 Oferta</span>' : ''}
                    ${s.descuento > 0 ? `<span class="bg-green-50 text-green-700 text-[0.55rem] font-bold px-1.5 py-0.5 rounded border border-green-200">-${s.descuento}%</span>` : ''}
                    ${(s.precioEspecial > 0 && !s.descuento) ? '<span class="bg-blue-50 text-blue-700 text-[0.55rem] font-bold px-1.5 py-0.5 rounded border border-blue-200">Precio Esp.</span>' : ''}
                </div>
                <div class="text-[0.65rem] text-[#5a735e] max-w-[180px] truncate" title="${s.descripcion || ''}">${s.descripcion || 'Sin descripción'}</div>
            `;

            const priceHtml = (s.descuento > 0 || s.precioEspecial > 0) ? `
                <div class="text-red-700 font-bold">$${(s.precioEspecial > 0 ? s.precioEspecial : Math.round(s.precio * (1 - s.descuento / 100))).toLocaleString('es-CO')}</div>
                <div class="text-[0.6rem] text-gray-400 line-through">$${s.precio.toLocaleString('es-CO')}</div>
            ` : `
                <div class="text-[#2c3d2e] font-semibold">$${s.precio.toLocaleString('es-CO')}</div>
            `;

            tr.innerHTML = `
                <td class="py-2.5">${nameHtml}</td>
                <td class="py-2.5 text-[#5a735e]">${s.categoria}</td>
                <td class="py-2.5 text-[#2c3d2e]">${s.duracion} min</td>
                <td class="py-2.5">${priceHtml}</td>
                <td class="py-2.5 text-right flex justify-end gap-1.5 pt-3">
                    <button type="button" class="btn-editar-servicio p-1 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors active:scale-90" data-id="${s.id}" title="Editar">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" class="btn-eliminar-servicio p-1 text-red-700 hover:text-red-900 hover:bg-red-50 rounded transition-colors active:scale-90" data-id="${s.id}" title="Eliminar">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </td>
            `;

            tr.querySelector('.btn-editar-servicio').addEventListener('click', () => {
                abrirModalEditarServicio(s);
            });

            tr.querySelector('.btn-eliminar-servicio').addEventListener('click', () => {
                eliminarServicio(s.id, s.nombre);
            });

            tablaServiciosBody.appendChild(tr);
        });

        // Refrescar iconos de Lucide
        lucide.createIcons();
    }

    // Elementos del formulario de fechas de promoción
    const modalServicioOfertaDia = document.getElementById('modal-servicio-oferta-dia');
    const modalServicioOfertaFechas = document.getElementById('modal-servicio-oferta-fechas');
    const modalServicioFechasRango = document.getElementById('modal-servicio-fechas-rango');
    const modalServicioOfertaInicio = document.getElementById('modal-servicio-oferta-inicio');
    const modalServicioOfertaFin = document.getElementById('modal-servicio-oferta-fin');

    modalServicioOfertaFechas.addEventListener('change', (e) => {
        if (e.target.checked) {
            modalServicioFechasRango.classList.remove('hidden');
        } else {
            modalServicioFechasRango.classList.add('hidden');
        }
    });

    // Abrir modal para agregar nuevo servicio
    btnAgregarServicio.addEventListener('click', () => {
        modalServicioTitulo.textContent = 'Nuevo Servicio';
        modalServicioId.value = '';
        formServicio.reset();
        modalServicioOfertaDia.checked = false;
        modalServicioOfertaFechas.checked = false;
        modalServicioFechasRango.classList.add('hidden');
        modalServicioOfertaInicio.value = '';
        modalServicioOfertaFin.value = '';
        modalServicioDescuento.value = '';
        modalServicioPrecioEsp.value = '';
        modalServicio.classList.remove('hidden');
    });

    // Abrir modal para editar servicio existente
    function abrirModalEditarServicio(servicio) {
        modalServicioTitulo.textContent = 'Editar Servicio';
        modalServicioId.value = servicio.id;
        modalServicioNombre.value = servicio.nombre;
        modalServicioCategoria.value = servicio.categoria;
        modalServicioDuracion.value = servicio.duracion;
        modalServicioPrecio.value = servicio.precio;
        modalServicioDescripcion.value = servicio.descripcion || '';
        
        modalServicioOfertaDia.checked = !!servicio.ofertaDelDia;
        
        if (servicio.ofertaInicio && servicio.ofertaFin) {
            modalServicioOfertaFechas.checked = true;
            modalServicioFechasRango.classList.remove('hidden');
            modalServicioOfertaInicio.value = servicio.ofertaInicio;
            modalServicioOfertaFin.value = servicio.ofertaFin;
        } else {
            modalServicioOfertaFechas.checked = false;
            modalServicioFechasRango.classList.add('hidden');
            modalServicioOfertaInicio.value = '';
            modalServicioOfertaFin.value = '';
        }
        
        modalServicioDescuento.value = servicio.descuento || '';
        modalServicioPrecioEsp.value = servicio.precioEspecial || '';
        modalServicio.classList.remove('hidden');
    }

    // Cerrar modal de servicio
    modalServicioBtnCerrar.addEventListener('click', () => {
        modalServicio.classList.add('hidden');
    });

    // Enviar formulario (Crear / Editar)
    formServicio.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = modalServicioId.value;
        const payload = {
            nombre: modalServicioNombre.value.trim(),
            categoria: modalServicioCategoria.value,
            duracion: parseInt(modalServicioDuracion.value, 10),
            precio: parseInt(modalServicioPrecio.value, 10),
            descripcion: modalServicioDescripcion.value.trim(),
            ofertaDelDia: modalServicioOfertaDia.checked,
            ofertaInicio: modalServicioOfertaFechas.checked ? modalServicioOfertaInicio.value : null,
            ofertaFin: modalServicioOfertaFechas.checked ? modalServicioOfertaFin.value : null,
            descuento: modalServicioDescuento.value ? parseInt(modalServicioDescuento.value, 10) : 0,
            precioEspecial: modalServicioPrecioEsp.value ? parseInt(modalServicioPrecioEsp.value, 10) : 0
        };

        const esEdicion = !!id;
        const url = esEdicion ? `/api/admin/servicios/${id}` : '/api/admin/servicios';
        const metodo = esEdicion ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                alert(data.mensaje);
                modalServicio.classList.add('hidden');
                formServicio.reset();
                // Recargar catálogo e interactuar con el panel principal
                await cargarServiciosCatalog();
                cargarPanelAdmin(); // Recarga calendario/panel ya que duraciones pueden cambiar
            } else {
                alert(data.mensaje || 'Error al guardar el servicio.');
            }
        } catch (err) {
            console.error('Error al guardar servicio:', err);
            alert('Error de conexión con el servidor.');
        }
    });

    // Eliminar servicio
    async function eliminarServicio(id, nombre) {
        if (!confirm(`¿Estás segura de que deseas eliminar el servicio "${nombre}"? Esto no afectará a las citas ya agendadas, pero no se podrán realizar nuevas citas para este servicio.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/servicios/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                alert(data.mensaje);
                await cargarServiciosCatalog();
                cargarPanelAdmin();
            } else {
                alert(data.mensaje || 'Error al eliminar el servicio.');
            }
        } catch (err) {
            console.error('Error al eliminar servicio:', err);
            alert('Error de conexión.');
        }
    }
});
