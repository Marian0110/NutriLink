// ========== FUNCIÓN GLOBAL DE SESIÓN ==========
function getSessionData() {
    // Verificar localStorage (sesión recordada)
    let nutricionistaId = localStorage.getItem('id_nutricionista');
    let correo = localStorage.getItem('correo');
    let isRemembered = localStorage.getItem('remember_session') === 'true';
    
    // Si no hay en localStorage, verificar sessionStorage
    if (!nutricionistaId) {
        nutricionistaId = sessionStorage.getItem('id_nutricionista');
        correo = sessionStorage.getItem('correo');
        isRemembered = false;
    }
    
    return {
        id_nutricionista: nutricionistaId,
        correo: correo,
        isRemembered: isRemembered,
        isLoggedIn: !!nutricionistaId
    };
}

const mapaCentros = {};

// Función para generar los bloques horarios de disponibilización
function generarBloquesHorarios(horasSeleccionadas = [], horasBloqueadas = []) {
    const contenedor = document.getElementById('bloques-horarios');
    contenedor.innerHTML = '';
    const inicio = 8;
    const fin = 23;

    // Para facilitar comparación rápida
    const mapaSeleccionadas = new Map(horasSeleccionadas.map(h => [h.hora?.slice(0, 5), h.estado]));
    const bloqueadasSet = new Set(horasBloqueadas.map(h => h.hora?.slice(0, 5)));

    for (let hora = inicio; hora < fin; hora++) {
        const horaStr = hora.toString().padStart(2, '0') + ':00';
        const estado = mapaSeleccionadas.get(horaStr);
        const esBloqueada = bloqueadasSet.has(horaStr);

        let colorClase = 'bg-light text-muted';
        let checked = '';
        let disabled = '';

        if (estado === 'Disponible') {
            colorClase = 'bg-success text-white';
            checked = 'checked';
        } else if (estado === 'Reservada') {
            colorClase = 'bg-warning text-dark';
            checked = 'checked';
        }

        if (esBloqueada) {
            // si además está en el centro actual, no lo bloqueamos (ya está arriba como "seleccionada")
            if (!estado) {
                colorClase = 'bg-success text-white'; // mostrar como verde
            } else if (estado === 'Reservada') {
                colorClase = 'bg-warning text-dark'; // mantener amarillo
            }
            disabled = 'disabled';
        }

        const col = document.createElement('div');
        col.className = 'col';

        col.innerHTML = `
            <div class="border rounded-3 shadow-sm d-flex align-items-center justify-content-center mx-auto ${colorClase}" 
                style="height: 40px; max-width: 200px;">
                <div class="form-check m-0">
                    <input class="form-check-input me-1" type="checkbox" value="${horaStr}" id="hora-${hora}"
                        ${checked} ${disabled}>
                    <label class="form-check-label small" for="hora-${hora}">${horaStr}</label>
                </div>
            </div>
        `;

        contenedor.appendChild(col);
    }

    // Mostrar u ocultar advertencia si hay alguna reservada
    const hayReservadas = horasSeleccionadas.some(h => h.estado === 'Reservada');
    const mensaje = document.getElementById('mensaje-reservadas');
    if (mensaje) {
        mensaje.style.display = hayReservadas ? 'block' : 'none';
    }

    // Mostrar texto explicativo sobre bloqueo
    let infoExtra = document.getElementById('mensaje-bloqueadas');
    if (!infoExtra) {
        infoExtra = document.createElement('div');
        infoExtra.id = 'mensaje-bloqueadas';
        infoExtra.className = 'form-text text-muted mt-2';
        document.getElementById('bloques-horarios').before(infoExtra);
    }
    infoExtra.innerHTML = horasBloqueadas.length > 0
        ? `<i class="fas fa-lock me-1"></i>Las horas en verde o amarillo deshabilitadas ya están asignadas en otro centro de atención.`
        : '';
}

// Función para marcar las horas ya reservadas
async function cargarHorasDesdeBD(fecha, id_nutricionista, id_centro) {
    try {
        // 1. Obtener horas del centro actual
        const responseCentro = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/disponibilidad_por_fecha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_nutricionista, fecha, id_centro })
        });

        const resultCentro = await responseCentro.json();
        if (!responseCentro.ok || resultCentro.status === 'error') {
            throw new Error(resultCentro.mensaje || 'No se pudieron obtener las horas del centro.');
        }

        const horasCentro = resultCentro.horas || [];

        // 2. Obtener TODAS las horas del nutricionista (todos los centros)
        const responseTodas = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/disponibilidad_nutricionista/${id_nutricionista}`);
        const resultTodas = await responseTodas.json();

        const horasBloqueadas = (resultTodas.disponibilidades || []).filter(h => {
            const mismaFecha = h.fecha.startsWith(fecha);
            const otroCentro = parseInt(h.id_centro) !== parseInt(id_centro);
            return mismaFecha && otroCentro;
        });

        generarBloquesHorarios(horasCentro, horasBloqueadas);

    } catch (error) {
        console.error('Error al cargar horas:', error);
        Swal.fire('Error', error.message || 'No se pudieron cargar las horas para esa fecha', 'error');
        generarBloquesHorarios([]);
    }
}

// Función para cargar el resumen de la agenda
async function cargarResumenAgenda(id_nutricionista) {
    const contenedor = document.getElementById('resumen-agenda');
    contenedor.innerHTML = '<p class="text-muted">Cargando resumen...</p>';

    // Obtener mapa de centros desde el DOM
    const selectCentro = document.getElementById('centroAtencion');
    // const mapaCentros = {};
    if (selectCentro) {
        Array.from(selectCentro.options).forEach(option => {
            if (option.value) {
                mapaCentros[option.value] = option.textContent;
            }
        });
    }

    try {
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/disponibilidad_nutricionista/${id_nutricionista}`);
        const result = await response.json();

        if (!response.ok || result.status !== 'ok') {
            throw new Error(result.mensaje || 'No se pudo cargar el resumen de la agenda.');
        }

        const disponibilidades = result.disponibilidades || [];

        if (disponibilidades.length === 0) {
            contenedor.innerHTML = '<p class="text-muted">No hay horarios disponibles ni reservados.</p>';
            return;
        }

        // Obtener la fecha de hoy a las 00:00
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const porMes = {};

        for (const d of disponibilidades) {
            const [anio, mes, dia] = d.fecha.split('-');
            const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
            fechaObj.setHours(0, 0, 0, 0);
            if (fechaObj < hoy) continue;

            const diaClave = `${anio}-${mes}-${dia}`;
            const mesNombre = fechaObj.toLocaleString('es-ES', { month: 'long' });
            const mesClave = `${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} de ${anio}`;
            const idCentro = d.id_centro?.toString() || 'Sin Centro';

            if (!porMes[mesClave]) porMes[mesClave] = {};
            if (!porMes[mesClave][diaClave]) porMes[mesClave][diaClave] = {};
            if (!porMes[mesClave][diaClave][idCentro]) porMes[mesClave][diaClave][idCentro] = [];

            porMes[mesClave][diaClave][idCentro].push({
                hora: d.hora.slice(0, 5),
                estado: d.estado === 'Reservada' ? 'R' : 'D'
            });
        }

        // Renderizar por mes > día > centro
        contenedor.innerHTML = '';
        Object.entries(porMes).forEach(([mesTitulo, dias]) => {
            const contMes = document.createElement('div');
            contMes.className = 'mb-4';

            const tituloMes = document.createElement('h5');
            tituloMes.className = 'fw-bold text-primary mb-3';
            tituloMes.innerHTML = `<i class="far fa-calendar-alt me-2"></i>${mesTitulo}`;
            contMes.appendChild(tituloMes);

            Object.entries(dias).forEach(([diaISO, centros]) => {
                const [anio, mes, dia] = diaISO.split('-');
                const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                });

                const fechaContainer = document.createElement('div');
                fechaContainer.className = 'mb-3';

                const fechaTitulo = document.createElement('h6');
                fechaTitulo.innerHTML = `<i class="far fa-clock me-1"></i>${fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)}`;
                fechaContainer.appendChild(fechaTitulo);

                Object.entries(centros).forEach(([idCentro, horas]) => {
                    const nombreCentro = mapaCentros[String(idCentro)] || 'Centro desconocido';

                    const centroTitulo = document.createElement('div');
                    centroTitulo.className = 'fw-semibold ms-3 mb-2';
                    centroTitulo.textContent = `• ${nombreCentro}`;
                    fechaContainer.appendChild(centroTitulo);

                    const bloqueHoras = document.createElement('div');
                    bloqueHoras.className = 'd-flex flex-wrap gap-2 ms-4';

                    horas.sort((a, b) => a.hora.localeCompare(b.hora)).forEach(h => {
                        const badge = document.createElement('span');
                        badge.className = `badge rounded-pill px-3 py-2 ${h.estado === 'D' ? 'bg-success' : 'bg-warning text-dark'}`;
                        badge.textContent = `${h.hora} [${h.estado}]`;
                        bloqueHoras.appendChild(badge);
                    });

                    fechaContainer.appendChild(bloqueHoras);
                });

                contMes.appendChild(fechaContainer);
            });

            contenedor.appendChild(contMes);
        });

    } catch (error) {
        console.error('Error al cargar resumen de agenda:', error);
        contenedor.innerHTML = '<p class="text-danger">Error al cargar el resumen de la agenda.</p>';
    }
}

// Función para cargar el resumen de las citas tomadas
async function cargarResumenCitas(id_nutricionista) {
    const contenedor = document.getElementById('resumen-citas');
    contenedor.innerHTML = '<p class="text-muted">Cargando citas...</p>';

    try {
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/citas_nutricionista/${id_nutricionista}`);
        const result = await response.json();

        if (!response.ok || result.status !== 'ok') {
            console.warn('⚠️ Respuesta NO OK del servidor:', result);
            throw new Error(result.mensaje || 'No se pudo cargar el resumen de citas.');
        }

        const citas = result.citas || [];

        if (citas.length === 0) {
            contenedor.innerHTML = '<p class="text-muted">No hay citas agendadas.</p>';
            return;
        }

        // Agrupar por fecha (clave: YYYY-MM-DD)
        const citasPorFecha = {};
        citas.forEach(cita => {
            const fechaClave = cita.fecha.split('T')[0]; // "2025-06-02"
            // const fechaClave = cita.fecha;
            if (!citasPorFecha[fechaClave]) {
                citasPorFecha[fechaClave] = [];
            }
            citasPorFecha[fechaClave].push(cita);
        });

        contenedor.innerHTML = ''; // Limpiar antes de insertar

        Object.entries(citasPorFecha).forEach(([fechaISO, listaCitas]) => {
            // Evitar desfase interpretando como local
            const [anio, mes, dia] = fechaISO.split('-');
            const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
            const tituloFecha = fechaObj.toLocaleDateString('es-CL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            const titulo = document.createElement('h6');
            titulo.className = 'fw-bold mt-3 mb-2 text-dark border-bottom pb-1';
            titulo.textContent = tituloFecha.charAt(0).toUpperCase() + tituloFecha.slice(1);
            contenedor.appendChild(titulo);

            const lista = document.createElement('ul');
            lista.className = 'list-group list-group-flush';

            listaCitas.sort((a, b) => a.hora.localeCompare(b.hora)); // Ordenar por hora

listaCitas.forEach((cita, index) => {

    // Aseguramos formato YYYY-MM-DD
    const fechaISO = cita.fecha?.split('T')[0] ?? '';
    // Aseguramos formato HH:mm
    const horaISO = cita.hora?.substring(0, 5) ?? '';
    const fechaHora = `${fechaISO}T${horaISO}:00`;

    let borderClass = 'border-secondary';
    let badgeClass = 'bg-secondary';
    let backgroundClass = 'bg-light';

    switch (cita.estado) {
        case 'Reservada':
            borderClass = 'border-success';
            badgeClass = 'bg-success';
            backgroundClass = 'bg-success bg-opacity-25';
            break;
        case 'Completada':
            borderClass = 'border-info';
            badgeClass = 'bg-info';
            backgroundClass = 'bg-info bg-opacity-25';
            break;
        case 'Cancelada':
            borderClass = 'border-danger';
            badgeClass = 'bg-danger';
            backgroundClass = 'bg-danger bg-opacity-25';
            break;
        case 'Cancelada por Nutricionista':
        case 'Cancelada por Paciente':
            borderClass = 'border-burdeo';
            badgeClass = 'badge-burdeo';
            backgroundClass = 'bg-burdeo';
            break;
        case 'Solicitada':
            borderClass = 'border-primary';
            badgeClass = 'bg-primary';
            backgroundClass = 'bg-primary bg-opacity-25';
            break;
    }

    const li = document.createElement('li');
    li.className = `list-group-item ${backgroundClass} border-start border-4 ${borderClass} mb-2 rounded shadow-sm`;

    li.innerHTML = `
        <strong>${cita.primer_nombre} ${cita.apellido_paterno}</strong><br>
        <small>${cita.correo}</small><br>
        <i class="fas fa-map-marker-alt me-1 text-muted"></i><small class="text-muted">${cita.nombre_centro}</small><br>
        ${horaISO}<br>
        <span class="badge ${badgeClass}">${cita.estado}</span>
        ${cita.estado === 'Reservada' ? `
            <div class="d-flex flex-column align-items-start gap-2 mt-3">
                <button class="btn btn-sm btn-outline-danger cancelar-cita-btn"
                    data-paciente-id="${cita.id_paciente}"
                    data-nutricionista-id="${id_nutricionista}"
                    data-fecha-hora="${fechaHora}">
                    <i class="fas fa-times-circle me-1"></i>Cancelar cita
                </button>
                <button class="btn btn-sm btn-outline-primary completar-cita-btn"
                    data-paciente-id="${cita.id_paciente}"
                    data-nutricionista-id="${id_nutricionista}"
                    data-fecha-hora="${fechaHora}">
                    <i class="fas fa-check-circle me-1"></i>Marcar como completada
                </button>
            </div>
        ` : ''}
    `;

    lista.appendChild(li);
});

            contenedor.appendChild(lista);
        });

    } catch (error) {
        console.error('❌ Error al cargar resumen de citas:', error);
        contenedor.innerHTML = '<p class="text-danger">Error al cargar las citas agendadas.</p>';
    }

    document.querySelectorAll('.cancelar-cita-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const idPaciente = this.getAttribute('data-paciente-id');
            const idNutricionista = this.getAttribute('data-nutricionista-id');
            const fechaHora = this.getAttribute('data-fecha-hora');

            const confirmacion = await Swal.fire({
                title: '¿Cancelar cita?',
                text: '¿Está seguro que desea cancelar esta cita?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, cancelar',
                cancelButtonText: 'No'
            });

            if (!confirmacion.isConfirmed) return;

            try {
                const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/cancelar_cita_nutricionista', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id_paciente: parseInt(idPaciente),
                        id_nutricionista: parseInt(idNutricionista),
                        fecha_hora: fechaHora
                    })
                });

                const result = await response.json();

                if (!response.ok || result.status !== 'ok') {
                    throw new Error(result.mensaje || 'Error al cancelar la cita');
                }

                await Swal.fire('¡Cita cancelada!', result.mensaje, 'success');
                cargarResumenCitas(parseInt(idNutricionista));
                location.reload();
            } catch (error) {
                console.error('❌ Error al cancelar cita:', error);
                Swal.fire('Error', error.message || 'No se pudo cancelar la cita', 'error');
            }
        });
    });

    document.querySelectorAll('.completar-cita-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const idPaciente = this.getAttribute('data-paciente-id');
            const idNutricionista = this.getAttribute('data-nutricionista-id');
            const fechaHora = this.getAttribute('data-fecha-hora');

            const confirmacion = await Swal.fire({
                title: '¿Marcar como completada?',
                text: '¿Está seguro que desea completar esta cita?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, completar',
                cancelButtonText: 'Cancelar'
            });

            if (!confirmacion.isConfirmed) return;

            try {
                const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/completar_cita_nutricionista', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id_paciente: parseInt(idPaciente),
                        id_nutricionista: parseInt(idNutricionista),
                        fecha_hora: fechaHora
                    })
                });

                const result = await response.json();

                if (!response.ok || result.status !== 'ok') {
                    throw new Error(result.mensaje || 'Error al completar la cita');
                }

                await Swal.fire('✅ Cita completada', result.mensaje, 'success');
                cargarResumenCitas(parseInt(idNutricionista));
                location.reload();
            } catch (error) {
                console.error('❌ Error al completar cita:', error);
                Swal.fire('Error', error.message || 'No se pudo completar la cita', 'error');
            }
        });
    });

}

// DOM
document.addEventListener('DOMContentLoaded', async function () {

    // ========== VERIFICACIÓN DE SESIÓN AL INICIO ==========
    const sessionData = getSessionData();
    
    if (!sessionData.isLoggedIn) {
        // Si no hay sesión, mostrar mensaje y redirigir al login
        const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.body;
        mainContent.innerHTML = `
            <div class="container mt-5">
                <div class="alert alert-danger text-center">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No se pudo identificar al nutricionista. Redirigiendo al login...
                </div>
            </div>
        `;
        setTimeout(() => {
            window.location.href = '/accounts/login/';
        }, 2000);
        return;
    }

    // ========== USAR ID DE SESIÓN ==========
    const idNutricionista = sessionData.id_nutricionista;

    const inputFecha = document.getElementById('fecha');
    const btnGuardar = document.getElementById('guardarDisponibilidad');
    const centroSelect = document.getElementById('centroAtencion');
    const bloqueFecha = document.getElementById('bloque-fecha');

if (centroSelect) {
    centroSelect.addEventListener('change', () => {
        const seleccion = centroSelect.value;

        // Mostrar u ocultar el campo de fecha
        if (seleccion) {
            bloqueFecha.style.display = 'block';
        } else {
            bloqueFecha.style.display = 'none';
        }

        // Resetear selección de fecha
        inputFecha.value = '';

        // Borrar bloques horarios visibles
        const contenedorBloques = document.getElementById('bloques-horarios');
        if (contenedorBloques) contenedorBloques.innerHTML = '';

        // Ocultar mensaje de horas reservadas
        const mensaje = document.getElementById('mensaje-reservadas');
        if (mensaje) mensaje.style.display = 'none';
    });
}

    // Establecer fecha mínima = hoy
    const hoy = new Date().toISOString().split('T')[0]; // Formato: YYYY-MM-DD
    inputFecha.setAttribute('min', hoy);

    if (inputFecha) {
        inputFecha.addEventListener('change', () => {
            const fechaSeleccionada = inputFecha.value;
            // ========== CAMBIO: Usar función en lugar de sessionStorage directo ==========
            const currentSessionData = getSessionData();
            if (!currentSessionData.isLoggedIn) {
                Swal.fire('Error de sesión', 'Debe iniciar sesión nuevamente', 'error');
                window.location.href = '/accounts/login/';
                return;
            }
            const id_nutricionista = currentSessionData.id_nutricionista;
            const id_centro = document.getElementById('centroAtencion')?.value;

            // Validar que no se seleccione una fecha pasada
            if (fechaSeleccionada < hoy) {
                Swal.fire('Fecha inválida', 'No puedes seleccionar una fecha anterior a hoy.', 'warning');
                inputFecha.value = '';
                generarBloquesHorarios([]);
                return;
            }

            if (!id_centro) {
                Swal.fire('Centro requerido', 'Debe seleccionar un centro de atención.', 'info');
                inputFecha.value = '';
                generarBloquesHorarios([]);
                return;
            }

            if (fechaSeleccionada && id_nutricionista && id_centro) {
                cargarHorasDesdeBD(fechaSeleccionada, parseInt(id_nutricionista), parseInt(id_centro));
            }
        });
    }

    if (btnGuardar) {
        btnGuardar.addEventListener('click', async function () {
            // ========== CAMBIO: Usar función en lugar de sessionStorage directo ==========
            const currentSessionData = getSessionData();
            if (!currentSessionData.isLoggedIn) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de sesión',
                    text: 'Debe iniciar sesión como nutricionista primero',
                }).then(() => {
                    window.location.href = '/accounts/login/';
                });
                return;
            }
            const id_nutricionista = currentSessionData.id_nutricionista;

            const fecha = inputFecha.value;
            if (!fecha) {
                Swal.fire('Error', 'Seleccione una fecha para guardar disponibilidad', 'warning');
                return;
            }

            const id_centro = document.getElementById('centroAtencion').value;

            if (!id_centro) {
                Swal.fire('Error', 'Seleccione un centro de atención', 'warning');
                return;
            }

            const checkboxes = document.querySelectorAll('#bloques-horarios input[type="checkbox"]:checked');
            const horas = Array.from(checkboxes).map(cb => cb.value + ':00');

            const disponibilidad = {
                id_nutricionista: parseInt(id_nutricionista),
                id_centro: parseInt(id_centro),
                fecha: fecha,
                horas: horas
            };

            try {
                const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/registrar_disponibilidad', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(disponibilidad)
                });

                const result = await response.json();

                if (!response.ok || result.status === 'error') {
                    throw new Error(result.mensaje || 'Error al registrar disponibilidad');
                }

                await Swal.fire({
                    title: '¡Éxito!',
                    text: result.mensaje,
                    icon: 'success',
                    confirmButtonText: 'OK'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.reload();
                    }
                });

            } catch (error) {
                console.error('Error al registrar disponibilidad:', error);
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    if (idNutricionista) {
        await cargarCentrosAtencion(idNutricionista);
        cargarResumenAgenda(parseInt(idNutricionista));
        cargarResumenCitas(parseInt(idNutricionista));
        verificarCancelacionesPendientesNutricionista(parseInt(idNutricionista));
        verificarSolicitudesPendientesNutricionista(parseInt(idNutricionista));
    }
});

// Función que verifica si hay citas "Cancelada por Paciente" para mostrar notificación de lectura
async function verificarCancelacionesPendientesNutricionista(id_nutricionista) {
    try {
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/citas_nutricionista/${id_nutricionista}`);
        const result = await response.json();

        if (!response.ok || result.status !== 'ok') {
            throw new Error(result.mensaje || 'Error al verificar cancelaciones.');
        }

        const citas = result.citas || [];

        for (const cita of citas) {
            if (cita.estado === 'Cancelada por Paciente') {
                const [anio, mes, dia] = cita.fecha.split('-');
                const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                const fecha = fechaObj.toLocaleDateString('es-CL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const hora = cita.hora?.substring(0, 5) ?? '--:--';

                const alerta = await Swal.fire({
                    title: 'Cita cancelada',
                    text: `El paciente ${cita.primer_nombre} ${cita.apellido_paterno} canceló su cita del ${fecha} a las ${hora}.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Confirmar',
                    cancelButtonText: 'Ver más tarde'
                });

                if (alerta.isConfirmed) {
                    const fechaISO = cita.fecha.split('T')[0]; // ✅ Asegura que esté sin zona horaria
                    const horaISO = cita.hora?.substring(0, 5); // ✅ 'HH:mm'
                    const fechaHora = `${fechaISO}T${horaISO}:00`;

                    const payload = {
                        id_paciente: cita.id_paciente,
                        id_nutricionista: id_nutricionista,
                        fecha_hora: fechaHora,
                        rol: 'nutricionista'
                    };

                    const confirmar = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/confirmar_notificacion_cancelacion', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    const resConfirmacion = await confirmar.json();

                    if (resConfirmacion.status === 'ok') {
                        await Swal.fire('Notificación confirmada', 'El estado de la cita ha sido actualizado.', 'success');
                        location.reload();
                    } else {
                        throw new Error(resConfirmacion.mensaje);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200)); // espera para evitar colapso visual
            }
        }
    } catch (error) {
        console.error('Error al verificar cancelaciones:', error);
    }
}

// Función para revisar solicitudes de citas por parte de pacientes
async function verificarSolicitudesPendientesNutricionista(id_nutricionista) {
    try {
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/citas_nutricionista/${id_nutricionista}`);
        const result = await response.json();

        if (!response.ok || result.status !== 'ok') {
            throw new Error(result.mensaje || 'Error al verificar solicitudes.');
        }

        const citas = result.citas || [];

        for (const cita of citas) {
            if (cita.estado === 'Solicitada') {
                const [anio, mes, dia] = cita.fecha.split('-');
                const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                const fecha = fechaObj.toLocaleDateString('es-CL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const hora = cita.hora?.substring(0, 5) ?? '--:--';

                const alerta = await Swal.fire({
                    title: 'Nueva cita solicitada',
                    text: `El paciente ${cita.primer_nombre} ${cita.apellido_paterno} ha solicitado una cita para el ${fecha} a las ${hora}.`,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Confirmar',
                    cancelButtonText: 'Ver más tarde'
                });

                if (alerta.isConfirmed) {
                    const fechaISO = cita.fecha.split('T')[0];  // ✅ DEFINICIÓN AQUÍ

                    const datos = {
                        id_paciente: cita.id_paciente,
                        id_nutricionista: id_nutricionista,
                        fecha_hora: `${fechaISO} ${cita.hora}`
                    };

                    const confirmar = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/confirmar_solicitud_cita', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(datos)
                    });

                    const resConfirmacion = await confirmar.json();

                    if (resConfirmacion.status === 'ok') {
                        await Swal.fire('Cita confirmada', 'La cita ha sido marcada como reservada.', 'success');
                        location.reload();
                    } else {
                        throw new Error(resConfirmacion.mensaje);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    } catch (error) {
        console.error('❌ Error al verificar solicitudes:', error);
    }
}

// Función para cargar los centros de atención ingresados por el nutricionista
async function cargarCentrosAtencion(id_nutricionista) {
    const selectCentro = document.getElementById('centroAtencion');
    selectCentro.innerHTML = '<option value="" disabled selected>Cargando...</option>';

    try {
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/centros_atencion/${id_nutricionista}`);
        const result = await response.json();

        if (result.status === 'ok') {
            if (result.centros.length === 0) {
                selectCentro.innerHTML = '<option value="" disabled selected>No hay centros disponibles</option>';
                return;
            }

            selectCentro.innerHTML = '<option value="" disabled selected>Selecciona un centro</option>';

            result.centros.forEach(centro => {
                const option = document.createElement('option');
                option.value = centro.id_centro;
                option.textContent = centro.nombre_centro;
                selectCentro.appendChild(option);

                // ✅ Guardar en diccionario global
                mapaCentros[centro.id_centro] = centro.nombre_centro;
            });
        } else {
            throw new Error(result.mensaje);
        }
    } catch (error) {
        console.error('Error al cargar centros:', error);
        selectCentro.innerHTML = '<option value="" disabled selected>Error al cargar</option>';
    }
}