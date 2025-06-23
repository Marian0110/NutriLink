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

document.addEventListener('DOMContentLoaded', async () => {
    mostrarFechaHoy();
    // ========== VERIFICACIÓN DE SESIÓN AL INICIO ==========

    // Verificar si hay sesión activa
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
    console.log('Usuario logueado en dashboard:', sessionData.correo);
    console.log('Sesión recordada:', sessionData.isRemembered);

    try {
        // ========== AHORA SÍ EJECUTAR LAS FUNCIONES ==========
        // Cargar información del nutricionista
        await cargarInfoNutricionista(idNutricionista);
        
        // Botón de citas
        await botonVerMas();
        
        // Crear gráficos
        await crearGraficos();

        // Cargar citas del día dinámicamente
        await cargarCitasDelDiaConEstados();

    } catch (error) {
        console.error('Error durante la inicialización:', error);
    }
});
function mostrarFechaHoy() {
    const hoy = new Date();
    
    // Opciones para formatear la fecha en español
    const opciones = {
        weekday: 'long',    // Día de la semana completo (lunes, martes, etc.)
        year: 'numeric',    // Año completo
        month: 'long',      // Mes completo (enero, febrero, etc.)
        day: 'numeric'      // Día del mes
    };
    
    const fechaFormateada = hoy.toLocaleDateString('es-CL', opciones);
    
    // Capitalizar
    const fechaCapitalizada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
    
    // Insertar la fecha en el elemento
    const elementoFecha = document.getElementById('fecha-hoy');
    if (elementoFecha) {
        elementoFecha.textContent = fechaCapitalizada;
        console.log('✅ Fecha cargada:', fechaCapitalizada);
    } else {
        console.error('❌ No se encontró el elemento fecha-hoy');
    }
}

// ========== FUNCIÓN PARA CARGAR INFO DEL NUTRICIONISTA ==========
async function cargarInfoNutricionista(idNutricionista) {
    try {
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/obtener_nutricionista_id/${idNutricionista}`);
        
        if (!response.ok) {
            throw new Error('Error en la respuesta');
        }
        const data = await response.json();
        const nutricionista = data[0]; 
        const nombreMostrar = `${nutricionista.primer_nombre} ${nutricionista.apellido_paterno}`;

        document.getElementById('nombre-nutricionista').textContent = nombreMostrar;
    } catch (error) {
        console.error('Error al cargar info del nutricionista:', error);
    }
}

async function getPacientes() {
    try {
        const sessionData = getSessionData();
        if (!sessionData.isLoggedIn) {
            console.error('No hay sesión activa');
            return null;
        }

        const idNutricionista = sessionData.id_nutricionista;

        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/obtener_pacientes_nutricionista/${idNutricionista}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'error') {
            console.error('Error al obtener pacientes:', data.mensaje);
            return null;
        }

        return data.data;
        
    } catch (error) {
        console.error('Error al obtener pacientes del nutricionista:', error);
        return null;
    }
}

async function crearGraficos() {
    try {
        const pacientes = await getPacientes();

        // Verificar si no hay pacientes
        if (!pacientes || pacientes.length === 0) {
            // Mensaje para secciones de pacientes
            const mensajeNoPacientes = `
                <div class="alert alert-info text-center py-4 h-100 w-100">
                    <i class="fas fa-user-plus fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">Aún no tienes pacientes registrados</h6>
                    <p class="text-muted small">Registra pacientes para visualizar los resúmenes estadísticos.</p>
                    <a href="/patients/gestion/" class="btn btn-primary btn-sm mt-2">Registrar Paciente</a>
                </div>
            `;
            
            // Aplicar solo a secciones relacionadas con pacientes
            document.getElementById('total-pacientes').innerHTML = mensajeNoPacientes;
            document.getElementById('grafico-genero').innerHTML = mensajeNoPacientes;
            document.getElementById('grafico-edad').innerHTML = mensajeNoPacientes;
            document.getElementById('total-minutas').innerHTML = mensajeNoPacientes;
            
            // Para minutas mensaje diferente
            const mensajeNoMinutas = `
                <div class="alert alert-info text-center py-4 h-100 w-100">
                    <i class="fas fa-utensils fa-3x text-muted mb-3 mt-5"></i>
                    <h6 class="text-muted">Aún no has generado planes alimenticios</h6>
                    <p class="text-muted small">Crea minutas para visualizar estadísticas.</p>
                </div>
            `;
            

            document.getElementById('grafico-detallado').innerHTML = mensajeNoMinutas;
            
            return;
        }

        // Card total pacientes
        const totalPacientes = pacientes.length;
        totalPacientesCard(totalPacientes);
        
        // Card total minutas 
        const totalMinutas = await obtenerTotalMinutas();
        if (totalMinutas === 0) {
            const mensajeNoMinutas = `
                <div class="alert alert-info text-center py-4">
                    <i class="fas fa-utensils fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">Aún no has generado planes alimenticios</h6>
                    <p class="text-muted small">Crea minutas para visualizar estadísticas.</p>
                </div>
            `;
            document.getElementById('total-minutas').innerHTML = mensajeNoMinutas;
            document.getElementById('grafico-detallado').innerHTML = mensajeNoMinutas;
        } else {
            crearCardTotalMinutas(totalMinutas);
            await graficoMinutasPorMes();
        }

        // Gráfico de género
        const graficoGenero = graficoGeneroTorta(pacientes);
        
        if (graficoGenero.data[0].values.some(count => count > 0)) {
            Plotly.newPlot('grafico-genero', graficoGenero.data, graficoGenero.layout);
        } else {
            document.getElementById('grafico-genero').innerHTML = 
                '<div class="alert alert-info">No hay datos de género disponibles</div>';
        }

        // Gráfico de grupos etarios
        const edades = pacientes.map(paciente => {
            if (paciente.fecha_nacimiento) {
                const birthDate = new Date(paciente.fecha_nacimiento);
                const ageDifMs = Date.now() - birthDate.getTime();
                const ageDate = new Date(ageDifMs);
                return Math.abs(ageDate.getUTCFullYear() - 1970);
            }
            return null;
        }).filter(age => age !== null);

        const graficoEdad = graficoEdadBarras(edades);

        if (edades.length > 0) {
            Plotly.newPlot('grafico-edad', graficoEdad.data, graficoEdad.layout);
        } else {
            document.getElementById('grafico-edad').innerHTML = 
                '<div class="alert alert-info">No hay datos de edad disponibles</div>';
        }
        // Gráfico de evolución de minutas
        await graficoMinutasPorMes();

    } catch (error) {
        console.error('Error al crear gráficos:', error);
    }
}

// Funciones para gráficos
function graficoGeneroTorta(pacientes) {
    const generoData = {
        'Femenino': 0,
        'Masculino': 0
    };

    pacientes.forEach(paciente => {
        if (paciente.sexo === 'F') {
            generoData['Femenino']++;
        } else if (paciente.sexo === 'M') {
            generoData['Masculino']++;
        }
    });

    const filteredGeneroData = Object.fromEntries(
        Object.entries(generoData).filter(([_, count]) => count > 0)
    );

    const graficoGenero = {
        data: [{
            values: Object.values(filteredGeneroData),
            labels: Object.keys(filteredGeneroData),
            type: 'pie',
            marker: {
                colors: ['#e83e8c', '#36b9cc']
            },
            textinfo: 'percent+label+value',
            hoverinfo: 'label+percent+value',
            textposition: 'inside',
            insidetextorientation: 'radial',
            hovertemplate: '<b>Género:</b> %{label}<br>' +
                          '<b>Cantidad:</b> %{value} pacientes<br>' +
                          '<b>Porcentaje:</b> %{percent}<br>' +
                          '<extra></extra>'
        }],
        layout: {
            title: {
                text: 'Distribución por Género',
                font: {
                    size: 16,
                    family: 'Arial',
                    color: '#2c3e50'
                }
            },
            height: 200,
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.2
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            margin: {
                l: 20,
                r: 20,
                b: 20,
                t: 40,
                pad: 4
            }
        }
    };

    return graficoGenero;
}

function graficoEdadBarras(edades) {
    const gruposEdad = {
        '18-25': 0,
        '26-35': 0,
        '36-45': 0,
        '46-55': 0,
        '56-65': 0,
        '65+': 0
    };

    edades.forEach(edad => {
        if (edad >= 18 && edad <= 25) gruposEdad['18-25']++;
        else if (edad >= 26 && edad <= 35) gruposEdad['26-35']++;
        else if (edad >= 36 && edad <= 45) gruposEdad['36-45']++;
        else if (edad >= 46 && edad <= 55) gruposEdad['46-55']++;
        else if (edad >= 56 && edad <= 65) gruposEdad['56-65']++;
        else if (edad > 65) gruposEdad['65+']++;
    });

    const graficoEdad = {
        data: [{
            x: Object.keys(gruposEdad),
            y: Object.values(gruposEdad),
            type: 'bar',
            marker: {
                color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
                line: {
                    color: 'rgba(255,255,255,0.8)',
                    width: 2
                }
            },
            text: Object.values(gruposEdad).map(val => val > 0 ? val : ''),
            textposition: 'auto',
            hovertemplate: '<b>Grupo de edad:</b> %{x}<br>' +
                          '<b>Cantidad:</b> %{y} pacientes<br>' +
                          '<extra></extra>'
        }],
        layout: {
            title: {
                text: 'Distribución por grupos de edad',
                font: {
                    size: 16,
                    family: 'Arial',
                    color: '#2c3e50'
                }
            },
            xaxis: {
                title: 'Grupos de Edad',
                tickangle: -45,
                showgrid: false
            },
            yaxis: {
                title: 'Cantidad de Pacientes',
                showgrid: true,
                gridcolor: 'rgba(0,0,0,0.1)'
            },
            height: 200,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            margin: {
                l: 50,
                r: 30,
                b: 80,
                t: 50,
                pad: 4
            }
        }
    };

    return graficoEdad;
}

function totalPacientesCard(totalPacientes) {
    const cardHTML = `
        <div style="text-align: start; padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                <div style="font-size: 3rem; font-weight: bold; color: #333;" 
                     class="counter" data-target="${totalPacientes}">0</div>
                <div style="
                    background-color: #62f485; 
                    border-radius: 30%; 
                    width: 60px; 
                    height: 60px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
                    margin-left: 200px;">
                    <i class="bi bi-people-fill" style="color: white; font-size: 1.5rem;"></i>
                </div>
            </div>
            <div style="font-size: 1.2rem; color: #666;">
                Total Pacientes
            </div>
        </div>
    `;
    
    document.getElementById('total-pacientes').innerHTML = cardHTML;
    
    animarContador();
}

function crearCardTotalMinutas(totalMinutas) {
    const cardHTML = `
        <div style="text-align: start; padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                <div style="font-size: 3rem; font-weight: bold; color: #333;" 
                     class="counter-minutas" data-target="${totalMinutas}">0</div>
                <div style="
                    background-color: #4e73df; 
                    border-radius: 30%; 
                    width: 60px; 
                    height: 60px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(78, 115, 223, 0.3);
                    margin-left: 200px;">
                    <i class="bi bi-file-text-fill" style="color: white; font-size: 1.5rem;"></i>
                </div>
            </div>
            <div style="font-size: 1.2rem; color: #666;">
                Total Minutas
            </div>
        </div>
    `;
    
    document.getElementById('total-minutas').innerHTML = cardHTML;
    animarContador('.counter-minutas'); // Extender función animarContador
}

async function obtenerTotalMinutas() {
    try {
        const sessionData = getSessionData();
        if (!sessionData.isLoggedIn) {
            console.error('No hay sesión activa');
            return 0;
        }

        const idNutricionista = sessionData.id_nutricionista;

        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/minuta/obtener_cantidad_minutas_nutricionista/${idNutricionista}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'success') {
            return data.data.cantidad_minutas; 
        } else {
            console.error('Error al obtener minutas:', data.mensaje);
            return 0; 
        }
    } catch (error) {
        console.error('Error en obtenerTotalMinutas:', error);
        return 0;
    }
}

// Minutas por mes 
async function obtenerMinutasPorMes() {
    try {
        const sessionData = getSessionData();
        if (!sessionData.isLoggedIn) {
            console.error('No hay sesión activa');
            return [];
        }

        const idNutricionista = sessionData.id_nutricionista;
        
        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/minuta/cant_minutas_por_mes_nutricionista/${idNutricionista}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'success') {
            return data.data;
        } else {
            console.error('Error al obtener minutas por mes:', data.mensaje);
            return []; 
        }
    } catch (error) {
        console.error('Error en obtenerMinutasPorMes:', error);
        return [];
    }
}

//Gráfico de minutas por mes
async function graficoMinutasPorMes() {
    try {
        const response = await obtenerMinutasPorMes();
        
        if (!response || response.length === 0) {
            document.getElementById('grafico-detallado').innerHTML = `
                <div class="alert alert-info text-center py-4">
                    <i class="fas fa-chart-line fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">No hay suficientes datos históricos</h6>
                    <p class="text-muted small">Aún no tienes suficiente actividad para mostrar la evolución de minutas.</p>
                </div>
            `;
            return;
        }

        // Procesamiento de datos
        const datos = response.sort((a, b) => {
            const [mesA, anioA] = a.mes_anio.split('-').map(Number);
            const [mesB, anioB] = b.mes_anio.split('-').map(Number);
            return new Date(anioA, mesA-1) - new Date(anioB, mesB-1);
        });

        // Obtener el año para el título
        const primerDato = datos[0].mes_anio.split('-');
        const anioTitulo = primerDato[1];

        // Formateo etiquetas
        const etiquetas = datos.map(item => {
            const [mes] = item.mes_anio.split('-');
            const fecha = new Date(2000, mes-1);
            return fecha.toLocaleDateString('es-ES', { month: 'long' });
        });

        const valores = datos.map(item => item.cantidad_minutas);

        // Configuración del gráfico de puntos
        const trace = {
            x: etiquetas,
            y: valores,
            type: 'scatter',
            mode: 'markers+lines',
            name: 'Minutas creadas',
            marker: {
                color: '#4e73df',
                size: 12,
                line: {
                    color: '#ffffff',
                    width: 2
                },
                symbol: 'circle',
                opacity: 0.9
            },
            line: {
                color: '#4e73df',
                width: 2,
                dash: 'dot',
                shape: 'spline'
            },
            hovertemplate: '<b>%{x}</b><br>Minutas: %{y}<extra></extra>',
            text: valores,
            textposition: 'top center'
        };

        // Calcular máximo para el eje Y
        const maxValor = Math.max(...valores);
        const yMax = maxValor % 1 === 0 ? maxValor : Math.ceil(maxValor);
        
        const layout = {
            title: {
                text: `<b>EVOLUCIÓN DE MINUTAS - ${anioTitulo}</b>`,
                font: {
                    size: 16,
                    family: 'Arial',
                    color: '#2c3e50'
                },
                pad: { t: 10, b: 0 }
            },
            xaxis: {
                tickangle: -45,
                tickfont: {
                    size: 12
                },
                showgrid: true,
                automargin: true
            },
            yaxis: {
                title: {
                    text: 'Cantidad de Minutas',
                    font: {
                        size: 12,
                        color: '#7f8c8d'
                    }
                },
                dtick: 1,
                range: [0, yMax + 0.5],
                gridcolor: 'rgba(0,0,0,0.05)'
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            margin: {
                l: 50,
                r: 30,
                b: 80,
                t: 60,
                pad: 4
            },
            hovermode: 'closest',
            showlegend: false
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        };

        Plotly.newPlot('grafico-detallado', [trace], layout, config);

    } catch (error) {
        console.error('Error al crear gráfico de minutas:', error);
        document.getElementById('grafico-detallado').innerHTML = `
            <div class="alert alert-danger text-center py-4">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <h6>Error al cargar los datos</h6>
                <p class="small">No se pudo generar el gráfico de evolución.</p>
            </div>
        `;
    }
}

// animación del contador para multiples cards
function animarContador(selector = '.counter') {
    const counters = document.querySelectorAll(selector);
    
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        let current = 0;
        const duration = 500;
        const increment = target / (duration / 16);
        
        const timer = setInterval(() => {
            current += increment;
            counter.textContent = Math.floor(current);
            
            if (current >= target) {
                counter.textContent = target;
                clearInterval(timer);
            }
        }, 16);
    });
}

//----------------------APARTADO DE CITAS DEL DIA-----------------------------------------
window.manejarIniciarConsulta = manejarIniciarConsulta;

// Guardar estado de consulta iniciada
function guardarConsultaIniciada(idPaciente) {
    const consultasIniciadas = JSON.parse(localStorage.getItem('consultasIniciadas') || '[]');
    if (!consultasIniciadas.includes(idPaciente)) {
        consultasIniciadas.push(idPaciente);
        localStorage.setItem('consultasIniciadas', JSON.stringify(consultasIniciadas));
    }
}

// Verificar si la consulta está iniciada ono
function estaConsultaIniciada(idPaciente) {
    const consultasIniciadas = JSON.parse(localStorage.getItem('consultasIniciadas') || '[]');
    return consultasIniciadas.includes(idPaciente);
}

// Obtener las citas del nutricionista
async function obtenerCitasNutricionista() {
    try {
        const sessionData = getSessionData();
        if (!sessionData.isLoggedIn) {
            console.error('No se encontró sesión activa');
            return [];
        }

        const idNutricionista = sessionData.id_nutricionista;

        const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/citas_nutricionista/${idNutricionista}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'error') {
            console.error('Error al obtener citas:', data.mensaje);
            return [];
        }

        return data.citas || [];
        
    } catch (error) {
        console.error('Error al obtener citas del nutricionista:', error);
        return [];
    }
}

// Filtrar citas del día actual
function filtrarCitasDelDia(citas) {
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return citas.filter(cita => {
        const fechaCita = new Date(cita.fecha).toISOString().split('T')[0];
        return fechaCita === fechaHoy;
    });
}

// Configuración del botón "Ver más"
function botonVerMas() {
    const toggleButton = document.getElementById('toggleCitas');
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            const hiddenCitas = document.querySelectorAll('.hidden-citas');
            const icon = this.querySelector('i');
            const totalCitas = document.querySelectorAll('.cita-card').length;
            
            hiddenCitas.forEach(cita => {
                if (cita.style.display === 'none' || !cita.style.display) {
                    cita.style.display = 'block';
                    icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
                    this.innerHTML = '<i class="fas fa-chevron-up me-1"></i> Ocultar citas';
                } else {
                    cita.style.display = 'none';
                    icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
                    this.innerHTML = `<i class="fas fa-chevron-down me-1"></i> Ver todas las citas de hoy (${totalCitas})`;
                }
            });
        });
    }
}

// Manejador click en "Iniciar consulta"
function manejarIniciarConsulta(event, cita) {
    event.preventDefault();
    
    const btnIniciar = event.target.closest('.btn-primary');
    
    // Guardar estado de consulta iniciada
    guardarConsultaIniciada(cita.id_paciente);
    
    // Cambiar botón inmediatamente
    btnIniciar.innerHTML = '<i class="fas fa-arrow-right me-1"></i> Volver a la consulta';
    btnIniciar.className = 'btn btn-warning btn-sm btn-consult mb-1';
    btnIniciar.disabled = false;
    
    // Hacer que navegue al perfil
    btnIniciar.onclick = function() {
        window.location.href = `/patients/${cita.id_paciente}/info-general/`;
    };
    
    // Redirigir al perfil inmediatamente
    window.location.href = `/patients/${cita.id_paciente}/info-general/`;
}

// Generar HTML de citas
function generarHTMLCitaConEstados(cita, index) {
    const fechaCita = new Date(`2000-01-01T${cita.hora}`);
    const horaInicio = fechaCita.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });
    
    const fechaFin = new Date(fechaCita.getTime() + 60 * 60 * 1000);
    const horaFin = fechaFin.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });

    const colores = ['4e73df', '1cc88a', 'f6c23e', 'e74a3b', '6f42c1', 'fd7e14'];
    const colorAvatar = colores[index % colores.length];
    
    // Limpiar y validar los campos para el avatar
    const primerNombre = (cita.primer_nombre || '').toString().trim();
    const apellidoPaterno = (cita.apellido_paterno || '').toString().trim();
    
    // Extraer iniciales
    const inicialNombre = primerNombre.charAt(0).toUpperCase() || 'U';
    const inicialApellido = apellidoPaterno.charAt(0).toUpperCase() || 'S';
    const iniciales = inicialNombre + inicialApellido;
    
    // Generar URL del avatar con las iniciales
    const avatarURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(iniciales)}&background=${colorAvatar}&color=fff&size=64&bold=true&length=2`;
    
    // Nombres para mostrar en el HTML
    const nombreMostrar = primerNombre || 'Sin nombre';
    const apellidoMostrar = apellidoPaterno || 'Sin apellido';
    
    // Determinar estado del botón
    const horaActual = new Date();
    const horaInicioCita = new Date(`${new Date().toDateString()} ${cita.hora}`);
    const puedeIniciar = horaActual >= horaInicioCita && cita.estado === 'Reservada';
    const estaCompletada = cita.estado === 'Completada';
    const estaCancelada = cita.estado === 'Cancelada Por Nutricionista';
    
    // Verificar si la consulta fue iniciada localmente
    const consultaIniciadaLocalmente = estaConsultaIniciada(cita.id_paciente);
    const estaEnProceso = cita.estado === 'En proceso' || consultaIniciadaLocalmente;

    const claseOculta = index >= 2 ? 'hidden-citas' : '';
    const estiloOculto = index >= 2 ? 'style="display: none;"' : '';

    // Configurar botón principal
    let configBotonPrincipal = {
        clase: 'btn-secondary',
        texto: '<i class="fas fa-clock me-1"></i> Pendiente',
        habilitado: false,
        onclick: ''
    };

    if (estaCompletada) {
        configBotonPrincipal = {
            clase: 'btn-success',
            texto: '<i class="fas fa-check-circle me-1"></i> Completada',
            habilitado: false,
            onclick: ''
        };
    } else if (estaCancelada) {
        configBotonPrincipal = {
            clase: 'btn-danger',
            texto: '<i class="fas fa-times-circle me-1"></i> Cancelada',
            habilitado: false,
            onclick: ''
        }; 
    } else if (estaEnProceso) {
        configBotonPrincipal = {
            clase: 'btn-warning',
            texto: '<i class="fas fa-arrow-right me-1"></i> Volver a la consulta',
            habilitado: true,
            onclick: `onclick="window.location.href='/patients/${cita.id_paciente}/info-general/'"`
        };
    } else if (puedeIniciar) {
        configBotonPrincipal = {
            clase: 'btn-primary',
            texto: '<i class="fas fa-play me-1"></i> Iniciar consulta',
            habilitado: true,
            onclick: `onclick="manejarIniciarConsulta(event, ${JSON.stringify(cita).replace(/"/g, '&quot;')})"`
        };
    }

    return `
        <div class="cita-card ${claseOculta}" ${estiloOculto}>
            <div class="py-3">
                <div class="row align-items-center p-2">
                    <div class="col-3 text-center">
                        <img src="${avatarURL}" 
                             alt="Avatar de ${nombreMostrar} ${apellidoMostrar} (${iniciales})" 
                             class="patient-avatar rounded-circle"
                             style="width: 50px; height: 50px; object-fit: cover;">
                    </div>
                    <div class="col-5">
                        <h6 class="mb-1">${nombreMostrar} ${apellidoMostrar}</h6>
                        <p class="text-muted small mb-1">
                            <i class="far fa-clock me-1"></i>${horaInicio} - ${horaFin}
                        </p>
                        <p class="text-muted small mb-0">
                            <i class="fas fa-notes-medical me-1"></i>${cita.nombre_centro || 'Centro no especificado'}
                        </p>
                    </div>
                    <div class="col-4">
                        <button class="btn ${configBotonPrincipal.clase} btn-sm btn-consult" 
                                ${!configBotonPrincipal.habilitado ? 'disabled' : ''}
                                ${configBotonPrincipal.onclick}>
                            ${configBotonPrincipal.texto}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Función principal para cargar citas
async function cargarCitasDelDiaConEstados() {
    try {
        const todasLasCitas = await obtenerCitasNutricionista();
        const citasHoy = filtrarCitasDelDia(todasLasCitas);
        citasHoy.sort((a, b) => a.hora.localeCompare(b.hora));
        
        let citasHTML = '';
        citasHoy.forEach((cita, index) => {
            citasHTML += generarHTMLCitaConEstados(cita, index);
        });
        
        if (citasHoy.length === 0) {
            citasHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-calendar-check fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">No tienes citas programadas para hoy</h6>
                    <p class="text-muted small">¡Disfruta tu día libre!</p>
                </div>
            `;
        }
        
        const cardBody = document.getElementById('citas-container');
        if (cardBody) {
            cardBody.innerHTML = citasHTML;
            
            if (citasHoy.length > 2) {
                cardBody.innerHTML += `
                    <div class="text-center mt-3">
                        <button id="toggleCitas" class="btn btn-link expand-btn">
                            <i class="fas fa-chevron-down me-1"></i> Ver todas las citas de hoy (${citasHoy.length})
                        </button>
                    </div>
                `;
                botonVerMas();
            }
        } else {
            console.error('❌ No se encontró el contenedor de citas');
        }
        
        console.log(`✅ Cargadas ${citasHoy.length} citas con persistencia de estado`);
        
    } catch (error) {
        console.error('Error al cargar citas del día:', error);
    }
}