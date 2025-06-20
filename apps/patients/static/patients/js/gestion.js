document.addEventListener('DOMContentLoaded', function () {
    // ========== NUEVO: Verificación de sesión ==========
    function getSessionData() {
        // Primero verificar localStorage (sesión recordada)
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
        // Si no hay sesión, mostrar mensaje y redirigir al login
        const pacientesTableBody = document.getElementById('pacientes-table-body');
        if (pacientesTableBody) {
            pacientesTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        No se pudo identificar al nutricionista. Redirigiendo al login...
                    </td>
                </tr>
            `;
        }
        setTimeout(() => {
            window.location.href = '/accounts/login/';
        }, 2000);
        return;
    }

    // ========== USAR ID DE SESIÓN ==========
    const idNutricionista = sessionData.id_nutricionista;
    console.log('Usuario logueado en pacientes:', sessionData.correo);
    console.log('Sesión recordada:', sessionData.isRemembered);

    // ========== RESTO DEL CÓDIGO ORIGINAL (con cambios mínimos) ==========
    async function cargarCentrosEnModal(id_nutricionista) {
      const selectCentro = document.getElementById('select-centro-atencion');
      selectCentro.innerHTML = '<option value="">Cargando centros...</option>';

      try {
        const respuesta = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/centros_atencion/${id_nutricionista}`);
        const data = await respuesta.json();

        if (data.status === 'ok') {
          if (data.centros.length === 0) {
            selectCentro.innerHTML = '<option value="">No hay centros disponibles</option>';
            return;
          }

          selectCentro.innerHTML = '<option value="">Seleccione un centro...</option>';
          data.centros.forEach(centro => {
            const option = document.createElement('option');
            option.value = centro.id_centro;
            option.textContent = centro.nombre_centro;
            selectCentro.appendChild(option);
          });

        } else {
          throw new Error(data.mensaje);
        }
      } catch (error) {
        console.error('Error al cargar centros en modal:', error);
        selectCentro.innerHTML = '<option value="">Error al cargar</option>';
      }
    }

    // Elementos del DOM con validacion
    const pacientesTableBody = document.getElementById('pacientes-table-body');
    const form = document.getElementById('paciente-form');
    const patientModalElement = document.getElementById('patientModal');
    const patientModal = patientModalElement ? new bootstrap.Modal(patientModalElement) : null;
    const addPatientBtn = document.getElementById('addPatientBtn');
    // Modal de Agendar Cita
    const agendarCitaModalElement = document.getElementById('agendarCitaModal');
    const agendarCitaModal = agendarCitaModalElement ? new bootstrap.Modal(agendarCitaModalElement) : null;
    const formAgendarCita = document.getElementById('form-agendar-cita');
    const selectDisponibilidad = document.getElementById('select-disponibilidad');

    const selectCentro = document.getElementById('select-centro-atencion');

    // Listener: cuando cambia el centro, carga las horas disponibles filtradas por ese centro
    selectCentro?.addEventListener('change', async function () {
      const idCentroSeleccionado = this.value;
      // ========== CAMBIO: Usar función en lugar de sessionStorage directo ==========
      const currentSessionData = getSessionData();
      const idNutricionistaActual = currentSessionData.id_nutricionista;
      
      selectDisponibilidad.innerHTML = '<option value="">Cargando horas...</option>';
      mapaDisponibilidades = {};

      if (!idCentroSeleccionado || !idNutricionistaActual) {
        selectDisponibilidad.innerHTML = '<option value="">Seleccione un centro válido</option>';
        return;
      }

      try {
        const res = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/disponibilidad_nutricionista/${idNutricionistaActual}`);
        const data = await res.json();

        if (!res.ok || data.status !== 'ok') throw new Error(data.mensaje || 'No se pudo obtener disponibilidad');

        const ahora = new Date();
        const siguienteHora = new Date(ahora);
        siguienteHora.setMinutes(0, 0, 0);
        siguienteHora.setHours(ahora.getHours() + 1);

        const opciones = data.disponibilidades
          .filter(d => {
            if (d.estado !== 'Disponible') return false;
            if (parseInt(d.id_centro) !== parseInt(idCentroSeleccionado)) return false;

            const [anio, mes, dia] = d.fecha.split('T')[0].split('-');
            const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
            const [horaStr, minutosStr] = d.hora.split(':');

            fechaObj.setHours(parseInt(horaStr), parseInt(minutosStr), 0, 0);
            return fechaObj >= siguienteHora;
          })
          .map(d => {
            const [anio, mes, dia] = d.fecha.split('T')[0].split('-');
            const fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
            const fechaTexto = fechaObj.toLocaleDateString('es-CL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            });

            const horaTexto = d.hora.slice(0, 5);
            const label = `${fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}, ${horaTexto}`;
            mapaDisponibilidades[label] = d.id_disponibilidad;
            return `<option value="${label}">${label}</option>`;
          });

        selectDisponibilidad.innerHTML = opciones.length > 0
          ? '<option value="">Seleccione una hora...</option>' + opciones.join('')
          : '<option value="">No hay horas disponibles</option>';
      } catch (error) {
        console.error('Error al cargar horas:', error);
        selectDisponibilidad.innerHTML = '<option value="">Error al cargar horas</option>';
      }
    });

    // Mapa de ID disponibilidad
    let mapaDisponibilidades = {};

    // Variable global para la paginación
    let currentPage = 1;

    // Inicializacion con validacion
    if (addPatientBtn) {
      addPatientBtn.addEventListener('click', prepareAddModal);
    }

    if (pacientesTableBody) {
      fetchPacientes();
    }

    function updatePatientCounter(count) {
      const counter = document.getElementById('patientCounter');
      if (counter) {
        counter.textContent = `Total: ${count}`;
      }
    }

    // Funcion principal cargar lista de pacientes
    async function fetchPacientes() {
      // ========== CAMBIO: Usar función en lugar de sessionStorage directo ==========
      const currentSessionData = getSessionData();
      if (!currentSessionData.isLoggedIn) {
        showError('Debe iniciar sesión como nutricionista');
        redirectToLogin();
        return;
      }
      
      const idNutricionistaActual = currentSessionData.id_nutricionista;
      cargarCentrosEnModal(idNutricionistaActual);

      try {
        showLoading();

        const response = await fetch(
          `https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/obtener_pacientes_nutricionista/${idNutricionistaActual}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        const data = await response.json();

        if (!response.ok || data.status === 'error') {
          throw new Error(data.mensaje || 'Error al obtener pacientes');
        }
        updatePatientCounter(data.data?.length || 0);
        renderPacientes(data.data || []);

      } catch (error) {
        showError(error.message);
        updatePatientCounter(0);
      }
    }

    function renderPacientes(pacientes) {
      if (!pacientesTableBody) return;

      if (pacientes.length === 0) {
        pacientesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">No se encontraron pacientes registrados</td>
        </tr>
        `;
        return;
      }

      let html = '';
      pacientes.forEach((paciente, index) => {
        const fullName = `
          ${paciente.primer_nombre || ''} 
          ${paciente.segundo_nombre || ''} 
          ${paciente.apellido_paterno || ''} 
          ${paciente.apellido_materno || ''}
        `.replace(/\s+/g, ' ').trim();
        const rutDisplay = `${paciente.rut_paciente || ''}-${paciente.dv || ''}`.replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, '$1.');

        const patientData = {
          id: paciente.id_paciente,
          firstName: paciente.primer_nombre,
          secondName: paciente.segundo_nombre,
          lastName: paciente.apellido_paterno,
          mothersMaidenName: paciente.apellido_materno,
          rut: `${paciente.rut_paciente}-${paciente.dv}`,
          birthDate: paciente.fecha_nacimiento,
          gender: paciente.sexo,
          email: paciente.correo,
          phone: paciente.telefono
        };

        const encodedData = btoa(JSON.stringify(patientData));

        html += `
          <tr>
            <th scope="row">${index + 1}</th>
            <td onclick="location.href='/patients/${paciente.id_paciente}/info-general/'" style="cursor: pointer;">${fullName}</td>
            <td onclick="location.href='/patients/${paciente.id_paciente}/info-general/'" style="cursor: pointer;">${paciente.correo || ''}</td>
            <td onclick="location.href='/patients/${paciente.id_paciente}/info-general/'" style="cursor: pointer;">${rutDisplay}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-2 edit-btn"
                  data-bs-toggle="modal" 
                  data-bs-target="#patientModal"
                  data-patient-id="${paciente.id_paciente}"
                  data-patient-data="${encodedData}">
                <i class="fas fa-edit"></i>
              </button>

              <button class="btn btn-sm btn-outline-success me-2 agendar-btn"
                  data-patient-id="${paciente.id_paciente}"
                  data-patient-nombre="${fullName}">
                <i class="fas fa-calendar-plus"></i>
              </button>

              <button class="btn btn-sm btn-outline-danger delete-btn" data-patient-id="${paciente.id_paciente}">
                <i class="fas fa-trash-alt"></i>
              </button>
            </td>
          </tr>
        `;
      });

      pacientesTableBody.innerHTML = html;
      setupEventListeners();
    }

    // Edicion modal dinamico
    function setupEventListeners() {
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          prepareEditModal(this);
        });
      });

      // Eliminacion modal dinamico
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const id_paciente = this.getAttribute('data-patient-id');

          const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar paciente?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
          });

          if (isConfirmed) {
            try {
              const response = await fetch(
                `https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/borrar/${id_paciente}`,
                { method: 'DELETE' }
              );

              if (!response.ok) {
                throw new Error('Error al eliminar paciente');
              }

              await Swal.fire('¡Éxito!', 'Paciente eliminado correctamente', 'success');
              fetchPacientes();
            } catch (error) {
              Swal.fire('Error', error.message, 'error');
            }
          }
        });
      });
    }

    // Funciones para manejar el modal dinamico (editar y agregar)
    function prepareAddModal() {
      resetModal();
      setModalMode('add');
    }

    function prepareEditModal(button) {
      if (!button) return;

      try {
        const patientData = JSON.parse(atob(button.getAttribute('data-patient-data')));
        const patientId = button.getAttribute('data-patient-id');

        setModalMode('edit');

        // Llenar formulario con validación de elementos
        const idField = document.getElementById('id');
        if (idField) idField.value = patientId;

        setValueIfExists('primer_nombre', patientData.firstName);
        setValueIfExists('segundo_nombre', patientData.secondName);
        setValueIfExists('apellido_paterno', patientData.lastName);
        setValueIfExists('apellido_materno', patientData.mothersMaidenName);

        // RUT
        if (patientData.rut) {
          const [rut, dv] = patientData.rut.split('-');
          setValueIfExists('rut_paciente', rut);
          setValueIfExists('dv', dv);
        }

        const birthDate = patientData.birthDate ? patientData.birthDate.split('T')[0] : ''; //Formateo de fecha
        setValueIfExists('fecha_nacimiento', birthDate);
        setValueIfExists('sexo', patientData.gender);
        setValueIfExists('correo', patientData.email);
        setValueIfExists('telefono', patientData.phone);
      } catch (error) {
        console.error('Error preparing edit modal:', error);
        Swal.fire('Error', 'No se pudo cargar la información del paciente', 'error');
      }
    }

    function setValueIfExists(elementId, value) {
      const element = document.getElementById(elementId);
      if (element) {
        element.value = value || '';
      }
    }

    //Funcion para cambio de modal dependiendo del btn (editar o agregar)
    function setModalMode(mode) {
      const actionText = document.getElementById('modalActionText');
      const submitText = document.getElementById('submitBtnText');
      const modalIcon = document.getElementById('modalIcon');

      if (!actionText || !submitText || !modalIcon) return;

      if (mode === 'add') {
        actionText.textContent = 'Registrar';
        submitText.textContent = 'Registrar';
        modalIcon.className = 'fas fa-user-plus me-2';
      } else {
        actionText.textContent = 'Editar';
        submitText.textContent = 'Actualizar';
        modalIcon.className = 'fas fa-user-edit me-2';
      }
    }

    function resetModal() {
      if (form) form.reset();
      const idField = document.getElementById('id');
      if (idField) idField.value = '';
    }

    // Funciones auxiliares
    function showLoading() { //loader carga de pacientes
      if (!pacientesTableBody) return;

      pacientesTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </td>
      </tr>
      `;
    }

    // Mensaje error de la api, pacientes vinculados al nutricionista
    function showError(message) {
      if (!pacientesTableBody) return;

      pacientesTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger">${message}</td>
      </tr>
      `;
    }

    function redirectToLogin() {
      window.location.href = LOGIN_URL;  // Variable definida en el template
    }

    // Validacion del RUT
    function validarRutChileno(rut, dv) {
      if (!rut || !dv) return false;

      rut = rut.replace(/\./g, '');
      if (rut.length < 7 || rut.length > 8) return false;

      dv = dv.toUpperCase();
      let suma = 0;
      let multiplo = 2;

      for (let i = rut.length - 1; i >= 0; i--) {
        suma += parseInt(rut.charAt(i)) * multiplo;
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
      }

      const dvEsperado = 11 - (suma % 11);
      const dvFinal = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
      return dv === dvFinal;
    }

    // Submit del formulario
    if (form) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();

        // Obtencion de campos
        const rutInput = document.getElementById('rut_paciente');
        const dvInput = document.getElementById('dv');

        if (!rutInput || !dvInput) {
          Swal.fire('Error', 'Campos de RUT no encontrados', 'error');
          return;
        }

        const rut = rutInput.value.trim();
        const dv = dvInput.value.trim().toUpperCase();

        if (!rut || !dv) {
          Swal.fire('Error', 'RUT y dígito verificador son obligatorios', 'error');
          return;
        }

        if (!validarRutChileno(rut, dv)) {
          Swal.fire('Error', 'El RUT ingresado no es válido', 'error');
          return;
        }

        // ========== CAMBIO: Usar función en lugar de sessionStorage directo ==========
        const currentSessionData = getSessionData();
        if (!currentSessionData.isLoggedIn) {
          Swal.fire({
            icon: 'error',
            title: 'Error de sesión',
            text: 'Debe iniciar sesión como nutricionista primero',
          });
          redirectToLogin();
          return;
        }

        const id_nutricionista = currentSessionData.id_nutricionista;

        // Preparacion de datos del paciente
        const pacienteData = {
          id_paciente: document.getElementById('id')?.value || null,
          rut_paciente: rut,
          dv: dv,
          primer_nombre: document.getElementById('primer_nombre')?.value.trim() || '',
          segundo_nombre: document.getElementById('segundo_nombre')?.value.trim() || null,
          apellido_paterno: document.getElementById('apellido_paterno')?.value.trim() || '',
          apellido_materno: document.getElementById('apellido_materno')?.value.trim() || null,
          correo: document.getElementById('correo')?.value.trim() || '',
          id_nutricionista: id_nutricionista,
          fecha_nacimiento: document.getElementById('fecha_nacimiento')?.value || '',
          sexo: document.getElementById('sexo')?.value || '',
          telefono: document.getElementById('telefono')?.value.trim() || null
        };

        // Validaciones adicionales
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pacienteData.correo)) {
          Swal.fire('Error', 'Ingrese un correo electrónico válido', 'error');
          return;
        }

        if (!pacienteData.fecha_nacimiento) {
          Swal.fire('Error', 'La fecha de nacimiento es obligatoria', 'error');
          return;
        }

        // Configurar envio de datos, edicion o registro
        const submitBtn = document.getElementById('submitBtn');
        if (!submitBtn) return;

        const isEditMode = document.getElementById('id')?.value !== '';
        const endpoint = isEditMode ?
          'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/modificar' :
          'https://nutrilinkapi-production.up.railway.app/api_nutrilink/paciente/registrar';

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Procesando...';

        try {
          const response = await fetch(endpoint, {
            method: isEditMode ? 'PATCH' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(pacienteData)
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || result.message || 'Error al procesar la solicitud');
          }

          await Swal.fire({
            title: '¡Éxito!',
            text: result.mensaje || (isEditMode ? 'Paciente actualizado' : 'Paciente registrado'),
            icon: 'success'
          });

          if (patientModal) {
            patientModal.hide();
          }
          updatePatientCounter(document.querySelectorAll('#pacientes-table-body tr').length);
          resetModal();
          setModalMode('add');
          fetchPacientes();

        } catch (error) {
          console.error('Error:', error);
          Swal.fire({
            title: 'Error',
            text: error.message,
            icon: 'error'
          });
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i class="fas fa-save me-2"></i>${isEditMode ? 'Actualizar' : 'Registrar'}`;
        }
      });
    }

    // Resetear modal al cerrar
    if (patientModalElement) {
      patientModalElement.addEventListener('hidden.bs.modal', function () {
        resetModal();
        setModalMode('add');
      });
    }

    // Función agendar nueva cita
    document.addEventListener('click', async function (e) {
      const btn = e.target.closest('.agendar-btn');
      if (btn) {
        const idPaciente = btn.getAttribute('data-patient-id');
        if (!idPaciente) return;

        document.getElementById('input-id-paciente').value = idPaciente;

        // ========== CAMBIO: Usar función en lugar de sessionStorage directo ==========
        const currentSessionData = getSessionData();
        if (!currentSessionData.isLoggedIn) {
          Swal.fire('Error', 'No se encontró sesión de nutricionista', 'error');
          return;
        }

        const idNutricionistaActual = currentSessionData.id_nutricionista;
        await cargarCentrosEnModal(idNutricionistaActual);

        document.getElementById('select-disponibilidad').innerHTML = '<option value="">Seleccione un centro primero</option>';
        mapaDisponibilidades = {};

        agendarCitaModal.show();
      }
    });

    if (formAgendarCita) {
      formAgendarCita.addEventListener('submit', async function (event) {
        event.preventDefault();

        const idPaciente = document.getElementById('input-id-paciente')?.value;
        const horaSeleccionada = selectDisponibilidad.value;
        const idCentro = document.getElementById('select-centro-atencion')?.value;

        if (!idPaciente || !horaSeleccionada || !mapaDisponibilidades[horaSeleccionada]) {
          Swal.fire('Error', 'Debe seleccionar una hora válida para agendar la cita', 'error');
          return;
        }

        if (!idCentro) {
          Swal.fire('Error', 'Debe seleccionar un centro de atención', 'error');
          return;
        }

        const idDisponibilidad = mapaDisponibilidades[horaSeleccionada];
        const motivo = document.getElementById('input-motivo')?.value.trim() || null;
        const nota = document.getElementById('input-notas')?.value.trim() || null;

        const body = {
          id_paciente: parseInt(idPaciente),
          id_disponibilidad: idDisponibilidad,
          motivo_consulta: motivo,
          notas: nota,
          id_centro: parseInt(idCentro)
        };

        try {
          const res = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/agenda/solicitar_cita', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });

          const data = await res.json();

          if (!res.ok || data.status !== 'ok') {
            throw new Error(data.mensaje || 'No se pudo registrar la cita');
          }

          await Swal.fire('¡Éxito!', data.mensaje, 'success');
          agendarCitaModal?.hide();
          formAgendarCita.reset();

        } catch (error) {
          console.error(error);
          Swal.fire('Error', error.message || 'Error al registrar cita', 'error');
        }
      });
    }
});