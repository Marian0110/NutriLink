document.addEventListener('DOMContentLoaded', function () {
    // ========== Verificación de sesión ==========
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
    // Verificar si hay sesión activa
    const sessionData = getSessionData();
    
    if (!sessionData.isLoggedIn) {
        document.getElementById('alimentosContainer').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                No se pudo identificar al nutricionista. Redirigiendo al login...
            </div>
        `;
        setTimeout(() => {
            window.location.href = '/accounts/login/';
        }, 2000);
        return;
    }

    // ========== USAR ID DE SESIÓN ==========
    const idNutricionista = sessionData.id_nutricionista;
    console.log('Usuario logueado en alimentos:', sessionData.correo);
    console.log('Sesión recordada:', sessionData.isRemembered);

    const API_GRUPOS_URL = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/obtener_grupos_alimenticios_con_id';
    const API_CREAR_ALIMENTO_URL = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/guardar_alimento';
    const API_ACTUALIZAR_ALIMENTO_URL_BASE = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/actualizar_alimento/';
    const API_ELIMINAR_ALIMENTO_URL_BASE = 'https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/eliminar_alimento/';
    
    let todosLosAlimentos = [];
    let alimentosFiltrados = [];
    let todosLosGrupos = [];
    let paginaActual = 1;
    const alimentosPorPagina = 5;
    
    // Variables de filtros
    let filtroTexto = '';
    let filtroGrupo = '';

    const API_ALIMENTOS_URL = `https://nutrilinkapi-production.up.railway.app/api_nutrilink/alimento/alimentos/nutricionista/${idNutricionista}`;

    // Cargar datos iniciales
    async function inicializar() {
        try {
            // Primero cargar grupos, luego alimentos (el orden importa para el mapeo)
            await cargarGrupos();
            await cargarAlimentos();
            aplicarFiltros();
            renderizarAlimentos();
        } catch (error) {
            console.error('Error al inicializar:', error);
            mostrarError('Error al cargar los datos iniciales.');
        }
    }

    // Cargar grupos alimenticios
    async function cargarGrupos() {
        try {
            const response = await fetch(API_GRUPOS_URL);
            if (!response.ok) throw new Error(`Error ${response.status}`);
            
            todosLosGrupos = await response.json();
            
            // Poblar select de grupos en filtros
            const grupoSelect = document.getElementById('grupoSelect');
            grupoSelect.innerHTML = '<option value="">Todos los grupos</option>';
            
            // Poblar select de grupos en modal de nuevo alimento
            const nuevoGrupoSelect = document.querySelector('#agregarAlimentoModal select[name="id_grupo_alimenticio"]');
            nuevoGrupoSelect.innerHTML = '<option value="">Seleccionar grupo</option>';
            
            todosLosGrupos
                .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                .forEach(grupo => {
                    // Para filtros
                    const option1 = document.createElement('option');
                    option1.value = grupo.descripcion;
                    option1.textContent = grupo.descripcion;
                    grupoSelect.appendChild(option1);
                    
                    // Para modal nuevo alimento
                    const option2 = document.createElement('option');
                    option2.value = grupo.id_grupo_alimenticio;
                    option2.textContent = grupo.descripcion;
                    nuevoGrupoSelect.appendChild(option2);
                });

        } catch (error) {
            console.error('Error cargando grupos:', error);
        }
    }

    // Cargar alimentos
    async function cargarAlimentos() {
        try {
            const response = await fetch(API_ALIMENTOS_URL);
            if (!response.ok) throw new Error(`Error ${response.status}`);
            
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                todosLosAlimentos = data.data;
                
                todosLosAlimentos.forEach(alimento => {
                    if (!alimento.id_grupo_alimenticio && alimento.nombre_grupo_alimenticio) {
                        const grupo = todosLosGrupos.find(g => g.descripcion === alimento.nombre_grupo_alimenticio);
                        if (grupo) {
                            alimento.id_grupo_alimenticio = grupo.id_grupo_alimenticio;
                        }
                    }
                    
                    if (alimento.id_grupo_alimenticio && !alimento.nombre_grupo_alimenticio) {
                        const grupo = todosLosGrupos.find(g => g.id_grupo_alimenticio === alimento.id_grupo_alimenticio);
                        if (grupo) {
                            alimento.nombre_grupo_alimenticio = grupo.descripcion;
                        }
                    }
                });
                
            } else {
                throw new Error(data.mensaje || 'Error en la respuesta de la API');
            }
        } catch (error) {
            console.error('Error cargando alimentos:', error);
            throw error;
        }
    }

    // Aplicar filtros
    function aplicarFiltros() {
        alimentosFiltrados = todosLosAlimentos.filter(alimento => {
            // Filtro por texto (nombre del alimento)
            const coincideTexto = !filtroTexto || 
                (alimento.nombre_alimento && alimento.nombre_alimento.toLowerCase().includes(filtroTexto.toLowerCase()));
            
            // Filtro por grupo
            const coincideGrupo = !filtroGrupo || 
                (alimento.nombre_grupo_alimenticio && alimento.nombre_grupo_alimenticio === filtroGrupo);
            
            return coincideTexto && coincideGrupo;
        });
        
        paginaActual = 1; // Resetear a primera página al filtrar
    }

    // Renderizar alimentos con paginación
    function renderizarAlimentos() {
        const container = document.getElementById('alimentosContainer');
        
        if (alimentosFiltrados.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning mt-3">
                    <i class="fas fa-search me-2"></i>
                    No se encontraron alimentos que coincidan con los filtros aplicados.
                </div>
            `;
            return;
        }

        // Calcular paginación
        const totalPaginas = Math.ceil(alimentosFiltrados.length / alimentosPorPagina);
        const inicio = (paginaActual - 1) * alimentosPorPagina;
        const fin = inicio + alimentosPorPagina;
        const alimentosPagina = alimentosFiltrados.slice(inicio, fin);

        // Generar HTML de alimentos
        let alimentosHtml = '';
        alimentosPagina.forEach(alimento => {
            alimentosHtml += generarHtmlAlimento(alimento);
        });

        // Generar HTML de paginación
        const paginacionHtml = generarHtmlPaginacion(totalPaginas);

        container.innerHTML = alimentosHtml + paginacionHtml;
        
        // Agregar event listeners
        agregarEventListenersPaginacion();
        agregarEventListenersModales();
    }

    // Generar HTML de un alimento
    function generarHtmlAlimento(alimento) {
        return `
            <div class="alimento-card">
                <div class="alimento-info">
                    <div class="alimento-nombre">${alimento.nombre_alimento}</div>
                    <div class="alimento-origen">${alimento.origen || ''}</div>
                </div>
                <div class="alimento-derecha">
                    <div class="alimento-valores">
                        <div class="valor">
                            <span>${alimento.lipidos_gr || '0'}g</span>
                            Lípidos
                        </div>
                        <div class="valor">
                            <span>${alimento.kcal || '0'} kcal</span>
                            Calorías
                        </div>
                        <div class="valor">
                            <span>${alimento.proteinas_gr || '0'}g</span>
                            Proteínas
                        </div>
                        <div class="valor">
                            <span>${alimento.carbohidratos_gr || '0'}g</span>
                            CarboH
                        </div>
                    </div>
                    <div class="expansor">
                        <button class="btn" type="button" data-bs-toggle="modal" data-bs-target="#detalleModal${alimento.id_alimento}">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </div>
            </div>
            ${generarModalDetalle(alimento)}
        `;
    }

    // Generar modal de detalle completo
    function generarModalDetalle(alimento) {
        const isUSDA = alimento.origen && alimento.origen.toLowerCase().includes('usda');
        const readonlyAttr = isUSDA ? 'readonly' : '';
        const disabledAttr = isUSDA ? 'disabled' : '';
        const buttonsStyle = isUSDA ? 'style="display: none;"' : '';
        
        // Crear opciones de grupos para el select
        let grupoOptions = '<option value="">Seleccione un grupo...</option>';
        todosLosGrupos.forEach(grupo => {
            const selected = alimento.id_grupo_alimenticio == grupo.id_grupo_alimenticio ? 'selected' : '';
            grupoOptions += `<option value="${grupo.id_grupo_alimenticio}" ${selected}>${grupo.descripcion}</option>`;
        });

        return `
            <div class="modal fade" id="detalleModal${alimento.id_alimento}" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content">
                        <div class="modal-header background">
                            <h5 class="modal-title">
                                <i class="fas fa-utensils me-2"></i>
                                Detalle nutricional de ${alimento.nombre_alimento}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form class="editable-form" data-alimento-id="${alimento.id_alimento}">
                                <input type="hidden" name="id_alimento" value="${alimento.id_alimento}">
                                
                                <fieldset class="info-basica-section mb-4">
                                    <legend class="section-title">Información del Alimento</legend>
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <label class="form-label">Nombre:</label>
                                            <input type="text" class="form-control" name="nombre_alimento" value="${alimento.nombre_alimento}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">Origen:</label>
                                            <input type="text" class="form-control" name="origen" value="${alimento.origen || 'Personalizado'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">Grupo:</label>
                                            <select class="form-select" name="id_grupo_alimenticio" ${disabledAttr}>
                                                ${grupoOptions}
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label">Medida:</label>
                                            <input type="text" class="form-control" name="medida" value="${alimento.medida || 'taza'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label">N° medidas:</label>
                                            <input type="number" step="0.01" class="form-control" name="numero_medida" value="${alimento.numero_medida || '1'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label">Masa (gr/ml):</label>
                                            <input type="number" step="0.01" class="form-control" name="masa" value="${alimento.masa || '100'}" ${readonlyAttr}>
                                        </div>
                                    </div>
                                </fieldset>
                                
                                <fieldset class="macronutrientes-section mb-4">
                                    <legend class="section-title">Macronutrientes (porción)</legend>
                                    <div class="row g-3">
                                        <div class="col-md-3">
                                            <label class="form-label">Lípidos (g):</label>
                                            <input type="number" step="0.01" class="form-control" name="lipidos_gr" value="${alimento.lipidos_gr || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label">Proteínas (g):</label>
                                            <input type="number" step="0.01" class="form-control" name="proteinas_gr" value="${alimento.proteinas_gr || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label">Carbohidratos (g):</label>
                                            <input type="number" step="0.01" class="form-control" name="carbohidratos_gr" value="${alimento.carbohidratos_gr || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label">Calorías (kcal):</label>
                                            <input type="number" step="0.01" class="form-control" name="kcal" value="${alimento.kcal || '0'}" ${readonlyAttr}>
                                        </div>
                                    </div>
                                </fieldset>
                                
                                <fieldset class="micronutrientes-section mb-4">
                                    <legend class="section-title">Micronutrientes (porción)</legend>
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label">Omega 3 (g):</label>
                                            <input type="number" step="0.01" class="form-control" name="n3_gr" value="${alimento.n3_gr || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Vitamina A (µg):</label>
                                            <input type="number" step="0.01" class="form-control" name="vit_a_mcg" value="${alimento.vit_a_mcg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Vitamina B12 (µg):</label>
                                            <input type="number" step="0.01" class="form-control" name="vit_b12_mcg" value="${alimento.vit_b12_mcg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Calcio (mg):</label>
                                            <input type="number" step="0.01" class="form-control" name="calcio_mg" value="${alimento.calcio_mg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Hierro (mg):</label>
                                            <input type="number" step="0.01" class="form-control" name="hierro_mg" value="${alimento.hierro_mg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Selenio (µg):</label>
                                            <input type="number" step="0.01" class="form-control" name="selenio_mcg" value="${alimento.selenio_mcg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Zinc (mg):</label>
                                            <input type="number" step="0.01" class="form-control" name="zinc_mg" value="${alimento.zinc_mg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Potasio (mg):</label>
                                            <input type="number" step="0.01" class="form-control" name="potasio_mg" value="${alimento.potasio_mg || '0'}" ${readonlyAttr}>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label">Sodio (mg):</label>
                                            <input type="number" step="0.01" class="form-control" name="sodio_mg" value="${alimento.sodio_mg || '0'}" ${readonlyAttr}>
                                        </div>
                                    </div>
                                </fieldset>
                                
                                <div class="d-flex justify-content-end gap-2 mt-4">
                                    <button type="button" class="btn btn-danger btn-eliminar-alimento" data-alimento-id="${alimento.id_alimento}" ${buttonsStyle}>
                                        <i class="fas fa-trash-alt me-2"></i>Eliminar
                                    </button>
                                    <button type="submit" class="btn btn-primary btn-guardar" ${buttonsStyle}>
                                        <i class="fas fa-save me-2"></i>Guardar
                                    </button>
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                        <i class="fas fa-times me-2"></i>Cerrar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Generar HTML de paginación
    function generarHtmlPaginacion(totalPaginas) {
        if (totalPaginas <= 1) return '';

        let paginacionHtml = '<div class="pagination-container mt-4"><nav><ul class="pagination justify-content-center">';
        
        // Botón anterior
        if (paginaActual > 1) {
            paginacionHtml += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">««</a>
                </li>
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${paginaActual - 1}">«</a>
                </li>
            `;
        }

        // Números de página
        for (let i = Math.max(1, paginaActual - 2); i <= Math.min(totalPaginas, paginaActual + 2); i++) {
            const activeClass = i === paginaActual ? 'active' : '';
            paginacionHtml += `
                <li class="page-item ${activeClass}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        // Botón siguiente
        if (paginaActual < totalPaginas) {
            paginacionHtml += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${paginaActual + 1}">»</a>
                </li>
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${totalPaginas}">»»</a>
                </li>
            `;
        }

        paginacionHtml += '</ul></nav></div>';
        return paginacionHtml;
    }

    // Event listeners para paginación
    function agregarEventListenersPaginacion() {
        document.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const nuevaPagina = parseInt(this.dataset.page);
                if (nuevaPagina && nuevaPagina !== paginaActual) {
                    paginaActual = nuevaPagina;
                    renderizarAlimentos();
                }
            });
        });
    }

    // Event listeners para modales
    function agregarEventListenersModales() {
        // Event listeners para formularios de edición
        document.querySelectorAll('.editable-form').forEach(form => {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                await actualizarAlimento(this);
            });
        });

        // Event listeners para botones de eliminar
        document.querySelectorAll('.btn-eliminar-alimento').forEach(button => {
            button.addEventListener('click', async function() {
                const alimentoId = this.dataset.alimentoId;
                await eliminarAlimento(alimentoId);
            });
        });
    }

    // Función para actualizar alimento
    async function actualizarAlimento(form) {
        const alimentoId = form.querySelector('input[name="id_alimento"]').value;
        const urlActualizar = API_ACTUALIZAR_ALIMENTO_URL_BASE + alimentoId;

        const submitButton = form.querySelector('.btn-guardar');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

        const formData = new FormData(form);

        const parseFloatOrNull = (value) => {
            if (value === null || String(value).trim() === '') return null;
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
        };
        
        const parseIntOrNull = (value) => {
            if (value === null || String(value).trim() === '') return null;
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
        };

        const data = {
            nombre_alimento: formData.get('nombre_alimento'),
            origen: formData.get('origen'),
            id_grupo_alimenticio: parseIntOrNull(formData.get('id_grupo_alimenticio')),
            medida: formData.get('medida'),
            numero_medida: parseFloatOrNull(formData.get('numero_medida')),
            masa: parseFloatOrNull(formData.get('masa')),
            kcal: parseFloatOrNull(formData.get('kcal')),
            proteinas_gr: parseFloatOrNull(formData.get('proteinas_gr')),
            carbohidratos_gr: parseFloatOrNull(formData.get('carbohidratos_gr')),
            lipidos_gr: parseFloatOrNull(formData.get('lipidos_gr')),
            n3_gr: parseFloatOrNull(formData.get('n3_gr')),
            vit_a_mcg: parseFloatOrNull(formData.get('vit_a_mcg')),
            vit_b12_mcg: parseFloatOrNull(formData.get('vit_b12_mcg')),
            calcio_mg: parseFloatOrNull(formData.get('calcio_mg')),
            hierro_mg: parseFloatOrNull(formData.get('hierro_mg')),
            selenio_mcg: parseFloatOrNull(formData.get('selenio_mcg')),
            zinc_mg: parseFloatOrNull(formData.get('zinc_mg')),
            potasio_mg: parseFloatOrNull(formData.get('potasio_mg')),
            sodio_mg: parseFloatOrNull(formData.get('sodio_mg')),
            id_nutricionista: idNutricionista
        };

        try {
            const response = await fetch(urlActualizar, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.status === "success") {
                Swal.fire({
                    icon: 'success',
                    title: '¡Actualizado!',
                    text: 'Alimento actualizado correctamente.',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // Cerrar modal
                const modalElement = form.closest('.modal');
                if (modalElement) {
                    const modalInstance = bootstrap.Modal.getInstance(modalElement);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                }
                
                // Recargar datos
                await cargarAlimentos();
                aplicarFiltros();
                renderizarAlimentos();

            } else {
                let errorMessage = 'Error al actualizar el alimento.';
                if (result && result.mensaje) {
                    errorMessage = result.mensaje;
                } else if (result && result.errors) {
                    errorMessage += '<br>' + Object.values(result.errors).join('<br>');
                }
                Swal.fire('Error', errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error al actualizar:', error);
            Swal.fire('Error de Conexión', 'No se pudo conectar con el servidor.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }

    // Función para eliminar alimento
    async function eliminarAlimento(alimentoId) {
        const urlEliminar = API_ELIMINAR_ALIMENTO_URL_BASE + alimentoId;

        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "¡No podrás revertir esto!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminarlo!',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(urlEliminar, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                        'Content-Type': 'application/json'
                    }
                });

                const resultData = await response.json();

                if (response.ok && resultData.status === "success") {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Eliminado!',
                        text: 'Alimento eliminado correctamente.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    
                    // Cerrar modal si está abierto
                    const modalElement = document.querySelector(`#detalleModal${alimentoId}`);
                    if (modalElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modalElement);
                        if (modalInstance) {
                            modalInstance.hide();
                        }
                    }
                    
                    // Recargar datos
                    await cargarAlimentos();
                    aplicarFiltros();
                    renderizarAlimentos();

                } else {
                    Swal.fire('Error', resultData.mensaje || 'No se pudo eliminar el alimento.', 'error');
                }
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire('Error de Conexión', 'No se pudo conectar con el servidor.', 'error');
            }
        }
    }

    // Event listeners para filtros
    document.getElementById('filtrosForm').addEventListener('submit', function(e) {
        e.preventDefault();
        filtroTexto = document.getElementById('searchInput').value.trim();
        aplicarFiltros();
        renderizarAlimentos();
    });

    // Filtrar en tiempo real al escribir
    document.getElementById('searchInput').addEventListener('input', function() {
        filtroTexto = this.value.trim();
        aplicarFiltros();
        renderizarAlimentos();
    });

    document.getElementById('grupoSelect').addEventListener('change', function() {
        filtroGrupo = this.value;
        aplicarFiltros();
        renderizarAlimentos();
    });

    // Event listener para formulario de nuevo alimento
    document.getElementById('nuevoAlimentoForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await crearNuevoAlimento(this);
    });

    // Función para crear nuevo alimento
    async function crearNuevoAlimento(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

        const formData = new FormData(form);

        const parseFloatOrNull = (value) => {
            if (value === null || String(value).trim() === '') return null;
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
        };
        
        const parseIntOrNull = (value) => {
            if (value === null || String(value).trim() === '') return null;
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
        };

        const data = {
            nombre_alimento: formData.get('nombre_alimento'),
            origen: formData.get('origen') || 'Personalizado',
            id_grupo_alimenticio: parseIntOrNull(formData.get('id_grupo_alimenticio')),
            medida: formData.get('medida'),
            numero_medida: parseFloatOrNull(formData.get('numero_medida')),
            masa: parseFloatOrNull(formData.get('cantidad_porcion')),
            kcal: parseFloatOrNull(formData.get('kcal')),
            proteinas_gr: parseFloatOrNull(formData.get('proteinas_gr')),
            carbohidratos_gr: parseFloatOrNull(formData.get('carbohidratos_gr')),
            lipidos_gr: parseFloatOrNull(formData.get('lipidos_gr')),
            n3_gr: parseFloatOrNull(formData.get('omega_gr')),
            vit_a_mcg: parseFloatOrNull(formData.get('vitamina_a_mcg')),
            vit_b12_mcg: parseFloatOrNull(formData.get('vitamina_b12_mcg')),
            calcio_mg: parseFloatOrNull(formData.get('calcio_mg')),
            hierro_mg: parseFloatOrNull(formData.get('hierro_mg')),
            selenio_mcg: parseFloatOrNull(formData.get('selenio_mcg')),
            zinc_mg: parseFloatOrNull(formData.get('zinc_mg')),
            potasio_mg: parseFloatOrNull(formData.get('potasio_mg')),
            sodio_mg: parseFloatOrNull(formData.get('sodio_mg')),
            id_nutricionista: idNutricionista
        };

        try {
            const response = await fetch(API_CREAR_ALIMENTO_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.status === "success") {
                Swal.fire({
                    icon: 'success',
                    title: '¡Creado!',
                    text: result.mensaje || 'Alimento agregado correctamente.',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // Cerrar modal
                const modalElement = form.closest('.modal');
                if (modalElement) {
                    const modalInstance = bootstrap.Modal.getInstance(modalElement);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                }
                
                // Limpiar formulario
                form.reset();
                
                // Recargar datos
                await cargarAlimentos();
                aplicarFiltros();
                renderizarAlimentos();

            } else {
                let errorMessage = 'Error al agregar el alimento.';
                if (result && result.mensaje) {
                    errorMessage = result.mensaje;
                } else if (result && result.errors) {
                    errorMessage += '<br>' + Object.values(result.errors).join('<br>');
                }
                Swal.fire('Error', errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error al crear alimento:', error);
            Swal.fire('Error de Conexión', 'No se pudo conectar con el servidor.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }

    // Función para mostrar errores
    function mostrarError(mensaje) {
        document.getElementById('alimentosContainer').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${mensaje}
            </div>
        `;
    }

    // Función para prevenir valores negativos en inputs numéricos
    function configurarValidacionInputsNumericos() {
        // Select a todos los inputs de macronutrientes y micronutrientes
        const inputsNumericos = document.querySelectorAll('input[type="number"][min="0"]');
        
        inputsNumericos.forEach(input => {
            // Prevenir que se escriban valores negativos
            input.addEventListener('input', function() {
                if (this.value < 0) {
                    this.value = 0;
                }
            });
            
            // Validar al perder el foco
            input.addEventListener('blur', function() {
                if (this.value < 0 || this.value === '') {
                    this.value = 0;
                }
            });
            
            // Prevenir el ingreso de caracteres que podrían resultar en números negativos
            input.addEventListener('keydown', function(e) {
                // Prevenir el signo menos (código 189 o 109)
                if (e.keyCode === 189 || e.keyCode === 109) {
                    e.preventDefault();
                }
            });
        });
    }

  // Llamar la función cuando se carga la página
  configurarValidacionInputsNumericos();

  // Configurar validaciones cuando se abran los modales de edición
  document.addEventListener('shown.bs.modal', function(e) {
      if (e.target.classList.contains('modal')) {
          configurarValidacionInputsNumericos();
      }
    });
    // Inicializar la aplicación
    inicializar();
});