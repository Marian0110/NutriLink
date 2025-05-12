console.log('appointments.js cargado');

function generarBloquesHorarios(horasSeleccionadas = []) {
    const contenedor = document.getElementById('bloques-horarios');
    contenedor.innerHTML = '';
    const inicio = 8;
    const fin = 23;

    for (let hora = inicio; hora < fin; hora++) {
        const horaStr = hora.toString().padStart(2, '0') + ':00';
        const entrada = horasSeleccionadas.find(h => h.hora?.slice(0, 5) === horaStr);

        const estado = entrada?.estado ?? 'No asignado';
        const isChecked = estado === 'Disponible';
        const esReservada = estado === 'Reservada';

        const col = document.createElement('div');
        col.className = 'col';

        const colorClase = esReservada ? 'bg-warning text-dark' : (isChecked ? 'bg-success text-white' : 'bg-light text-muted');

        col.innerHTML = `
            <div class="border rounded-3 shadow-sm d-flex align-items-center justify-content-center mx-auto ${colorClase}" 
                style="height: 40px; max-width: 200px;">
                <div class="form-check m-0">
                    <input class="form-check-input me-1" type="checkbox" value="${horaStr}" id="hora-${hora}"
                        ${isChecked || esReservada ? 'checked' : ''}>
                    <label class="form-check-label small" for="hora-${hora}">${horaStr}</label>
                </div>
            </div>
        `;

        contenedor.appendChild(col);

        const hayReservadas = horasSeleccionadas.some(h => h.estado === 'Reservada');
        const mensaje = document.getElementById('mensaje-reservadas');
        if (mensaje) {
            mensaje.style.display = hayReservadas ? 'block' : 'none';
}
    }
}

async function cargarHorasDesdeBD(fecha, id_nutricionista) {
    try {
        const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/disponibilidad_por_fecha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id_nutricionista, fecha })
        });

        const result = await response.json();

        if (!response.ok || result.status === 'error') {
            throw new Error(result.mensaje || 'No se pudieron obtener las horas.');
        }

        const horas = result.horas || [];

        // ✅ Mostrar en consola las horas obtenidas
        console.log(`🕒 Horas disponibles para ${fecha}:`, horas);

        generarBloquesHorarios(horas); // Marcar automáticamente
    } catch (error) {
        console.error('Error al cargar horas:', error);
        Swal.fire('Error', 'No se pudieron cargar las horas para esa fecha', 'error');
        generarBloquesHorarios([]); // Fallback vacío
    }
}

async function cargarResumenAgenda(id_nutricionista) {
    const contenedor = document.getElementById('resumen-agenda');
    contenedor.innerHTML = '<p class="text-muted">Cargando resumen...</p>';

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
            fechaObj.setHours(0, 0, 0, 0); // Asegura comparación sólo por fecha

            if (fechaObj < hoy) continue; // 🔴 Omitir fechas pasadas

            const diaClave = `${anio}-${mes}-${dia}`;
            const mesNombre = fechaObj.toLocaleString('es-ES', { month: 'long' });
            const mesClave = `${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} de ${anio}`;

            if (!porMes[mesClave]) porMes[mesClave] = {};
            if (!porMes[mesClave][diaClave]) porMes[mesClave][diaClave] = [];

            porMes[mesClave][diaClave].push({
                hora: d.hora.slice(0, 5),
                estado: d.estado === 'Reservada' ? 'R' : 'D'
            });
        }

        // Renderizar por mes > día
        contenedor.innerHTML = '';
        Object.entries(porMes).forEach(([mesTitulo, dias]) => {
            const contMes = document.createElement('div');
            contMes.className = 'mb-4';

            const tituloMes = document.createElement('h5');
            tituloMes.className = 'fw-bold text-primary mb-3';
            tituloMes.innerHTML = `<i class="far fa-calendar-alt me-2"></i>${mesTitulo}`;
            contMes.appendChild(tituloMes);

            Object.entries(dias).forEach(([diaISO, horas]) => {
                const [anio, mes, dia] = diaISO.split('-');
                const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                });

                const fechaContainer = document.createElement('div');
                fechaContainer.className = 'mb-2';

                const fechaTitulo = document.createElement('h6');
                fechaTitulo.innerHTML = `<i class="far fa-clock me-1"></i>${fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)}`;
                fechaContainer.appendChild(fechaTitulo);

                const bloqueHoras = document.createElement('div');
                bloqueHoras.className = 'd-flex flex-wrap gap-2';

                horas.sort((a, b) => a.hora.localeCompare(b.hora)).forEach(h => {
                    const badge = document.createElement('span');
                    badge.className = `badge rounded-pill px-3 py-2 ${h.estado === 'D' ? 'bg-success' : 'bg-warning text-dark'}`;
                    badge.textContent = `${h.hora} [${h.estado}]`;
                    bloqueHoras.appendChild(badge);
                });

                fechaContainer.appendChild(bloqueHoras);
                contMes.appendChild(fechaContainer);
            });

            contenedor.appendChild(contMes);
        });

    } catch (error) {
        console.error('Error al cargar resumen de agenda:', error);
        contenedor.innerHTML = '<p class="text-danger">Error al cargar el resumen de la agenda.</p>';
    }
}

// DOM
document.addEventListener('DOMContentLoaded', function () {
    console.log('✅ DOMContentLoaded se ejecutó');

    const inputFecha = document.getElementById('fecha');
    const btnGuardar = document.getElementById('guardarDisponibilidad');

    // Establecer fecha mínima = hoy
    const hoy = new Date().toISOString().split('T')[0]; // Formato: YYYY-MM-DD
    inputFecha.setAttribute('min', hoy);

    if (inputFecha) {
        inputFecha.addEventListener('change', () => {
            const fechaSeleccionada = inputFecha.value;
            const id_nutricionista = sessionStorage.getItem('id_nutricionista');
            console.log('📦 ID del nutricionista desde sessionStorage:', id_nutricionista);

            // Validar que no se seleccione una fecha pasada
            if (fechaSeleccionada < hoy) {
                Swal.fire('Fecha inválida', 'No puedes seleccionar una fecha anterior a hoy.', 'warning');
                inputFecha.value = '';
                generarBloquesHorarios([]);
                return;
            }

            if (fechaSeleccionada && id_nutricionista) {
                cargarHorasDesdeBD(fechaSeleccionada, parseInt(id_nutricionista));
            }
        });
    }

    if (btnGuardar) {
        btnGuardar.addEventListener('click', async function () {
            console.log("Click detectado en botón");
            const id_nutricionista = sessionStorage.getItem('id_nutricionista');
            console.log("ID nutricionista rescatado: " + id_nutricionista);

            if (!id_nutricionista) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de sesión',
                    text: 'Debe iniciar sesión como nutricionista primero',
                }).then(() => {
                    window.location.href = '/accounts/login/';
                });
                return;
            }

            const fecha = inputFecha.value;
            if (!fecha) {
                Swal.fire('Error', 'Seleccione una fecha para guardar disponibilidad', 'warning');
                return;
            }

            const checkboxes = document.querySelectorAll('#bloques-horarios input[type="checkbox"]:checked');
            const horas = Array.from(checkboxes).map(cb => cb.value + ':00');

            if (horas.length === 0) {
                Swal.fire('Error', 'Seleccione al menos una hora disponible', 'warning');
                return;
            }

            const disponibilidad = {
                id_nutricionista: parseInt(id_nutricionista),
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

    const id_nutricionista = sessionStorage.getItem('id_nutricionista');
    console.log('📦 ID del nutricionista desde sessionStorage:', id_nutricionista);
    if (id_nutricionista) {
        cargarResumenAgenda(parseInt(id_nutricionista));
    }
});