document.addEventListener('DOMContentLoaded', async () => {
    // Variables de sesión
    let correo = sessionStorage.getItem("correo");
    let contrasena = sessionStorage.getItem("contrasena");
    let id_nutricionista = sessionStorage.getItem('id_nutricionista');
    // Llamado a función de obtención de centros de atención
    obtenerCentrosAtencion(id_nutricionista);

    // Función para deshabilitar opciones ya seleccionadas
    function disableSelectedOptions(selectElement) {
      const container = document.getElementById('especialidades-container');
      if (!container) return;

      const selectedValues = Array.from(container.querySelectorAll('input[type="hidden"]')).map(input => input.value);

      Array.from(selectElement.options).forEach(option => {
        if (option.value && selectedValues.includes(option.value)) {
          option.disabled = true;
        } else if (option.value) {
          option.disabled = false;
        }
      });
    }

    // Función para agregar un ítem seleccionado
    function addSelectedItem(containerId, value, text) {
      const container = document.getElementById(containerId);
      const itemId = 'item-' + Math.random().toString(36).substr(2, 9);

      const itemElement = document.createElement('div');
      itemElement.className = 'selected-item d-inline-flex align-items-center bg-light rounded-pill px-3 py-1 me-2 mb-2';
      itemElement.id = itemId;

      itemElement.innerHTML = `
        ${text}
        <span class="remove-item ms-2" style="cursor:pointer;">×</span>
        <input type="hidden" name="especialidades[]" value="${value}">
      `;

      itemElement.querySelector('.remove-item').addEventListener('click', () => {
        removeItem(itemId, containerId, value);
      });

      container.appendChild(itemElement);
    }

    // Función para quitar un ítem
    function removeItem(itemId, containerId, value) {
      const item = document.getElementById(itemId);
      if (item) item.remove();

      const select = document.getElementById('especializacion');
      if (select) {
        Array.from(select.options).forEach(option => {
          if (option.value === value) {
            option.disabled = false;
          }
        });
      }
    }

    // function addAnother(type) {
    //   const select = document.getElementById(type === 'especialidades' ? 'especializacion' : type);
    //   if (select) {
    //     disableSelectedOptions(select);
    //     select.focus();
    //   }
    // }
    // Cargar perfil del nutricionista
    try {
      const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/obtener_nutricionista_mas_especialidades/${id_nutricionista}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data && data.primer_nombre) {
          document.getElementById("pNombre").value = data.primer_nombre || '';
          document.getElementById("sNombre").value = data.segundo_nombre || '';
          document.getElementById("apePater").value = data.apellido_paterno || '';
          document.getElementById("apeMater").value = data.apellido_materno || '';
          document.getElementById("email").value = data.correo || '';
          document.getElementById("rut").value = data.rut_nutricionista ? `${data.rut_nutricionista}-${data.dv}` : '';
          document.getElementById("fechaNacimiento").value = data.fecha_nacimiento ? data.fecha_nacimiento.split('T')[0] : '';
          document.getElementById("telefono").value = data.telefono || '';

          const especialidadesContainer = document.getElementById('especialidades-container');
          if (data.especialidades) {
            especialidadesContainer.innerHTML = '';
            const especialidades = Array.isArray(data.especialidades) ? data.especialidades : [data.especialidades];

            especialidades.forEach(esp => {
              if (esp && esp.id_especialidad) {
                const select = document.getElementById('especializacion');
                const option = Array.from(select.options).find(
                  opt => opt.value === esp.id_especialidad.toString()
                );

                const text = option ? option.text : `Especialidad ${esp.id_especialidad}`;
                addSelectedItem('especialidades-container', esp.id_especialidad, text);
              }
            });
            disableSelectedOptions(document.getElementById('especializacion'));
          }
        } else {
          Swal.fire('Advertencia', data.mensaje || 'Nutricionista no encontrado', 'warning');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener datos del perfil');
      }
    } catch (error) {
      console.error('Error al cargar el perfil:', error);
      Swal.fire('Error', error.message || 'Error al cargar los datos del perfil', 'error');
    }

    // Select de especialidades
    const especializacionSelect = document.getElementById('especializacion');
    if (especializacionSelect) {
      especializacionSelect.addEventListener('change', function () {
        if (this.value && !this.disabled) {
          const container = document.getElementById('especialidades-container');
          const existingValues = Array.from(container.querySelectorAll('input[type="hidden"]')).map(input => input.value);

          if (!existingValues.includes(this.value)) {
            addSelectedItem('especialidades-container', this.value, this.options[this.selectedIndex].text);
            disableSelectedOptions(this);
          } else {
            alert('Esta especialidad ya fue seleccionada');
          }
          this.selectedIndex = 0;
        }
      });
      disableSelectedOptions(especializacionSelect);
    }

    // Formulario de perfil
    const profileForm = document.getElementById("profile-form");
    profileForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const datos = {
        correo: correo,
        contrasena: contrasena,
        primer_nombre: document.getElementById("pNombre").value || null,
        segundo_nombre: document.getElementById("sNombre").value || null,
        apellido_paterno: document.getElementById("apePater").value || null,
        apellido_materno: document.getElementById("apeMater").value || null,
        fecha_nacimiento: document.getElementById("fechaNacimiento").value || null,
        telefono: document.getElementById("telefono").value || null
      };

      try {
        const response = await fetch("https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/modificar", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(datos)
        });

        const result = await response.json();
        if (response.ok) {
          Swal.fire('¡Éxito!', result.mensaje, 'success');
        } else {
          Swal.fire('Error', result.error, 'error');
        }
      } catch (error) {
        Swal.fire('Error', 'Error de red o del servidor.', 'error');
      }
    });

    // Formulario de contraseña
    const passForm = document.getElementById("password-form");
    passForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const actual = document.getElementById("passActual").value;
      const nueva = document.getElementById("passNueva").value;
      const confirmar = document.getElementById("confirmarPass").value;

      if (nueva !== confirmar) {
        Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
        return;
      }

      const datos = {
        correo: correo,
        contrasena_actual: actual,
        contrasena_nueva: nueva
      };

      try {
        const response = await fetch("https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/modificar_contrasena", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(datos)
        });

        const result = await response.json();
        if (response.ok) {
          Swal.fire('¡Éxito!', result.mensaje, 'success');
          document.getElementById("password-form").reset();
          sessionStorage.setItem("contrasena", nueva);
          contrasena = nueva;
        } else {
          Swal.fire('Error', result.error || 'No se pudo cambiar la contraseña', 'error');
        }
      } catch (error) {
        Swal.fire('Error', 'Error de red o del servidor.', 'error');
      }
    });

    // Configurar formulario de especialización
    const especializacionForm = document.getElementById("especializacion-form");
    if (especializacionForm) {
      especializacionForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const especialidades = Array.from(document.querySelectorAll('#especialidades-container input[type="hidden"]')).map(input => {
          const itemDiv = input.parentElement;
          const nombreEspecialidad = itemDiv.textContent.trim().replace('×', '').trim();
          return nombreEspecialidad;
        });

        if (especialidades.length === 0) {
          Swal.fire('Error', 'Debes seleccionar al menos una especialidad', 'error');
          return;
        }

        try {
          const response = await fetch("https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/sincronizar_especialidades", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              id_nutricionista: parseInt(id_nutricionista),
              especialidades: especialidades
            })
          });

          const result = await response.json();

          if (response.ok) {
            Swal.fire('¡Éxito!', result.mensaje || 'Especialidades actualizadas correctamente', 'success');
          } else {
            Swal.fire('Error', result.mensaje || 'Error al sincronizar especialidades', 'error');
          }
        } catch (error) {
          Swal.fire('Error', 'Error al sincronizar especialidades: ' + error.message, 'error');
        }
      });
    }

    // Formulario para registrar nuevo centro de atención
    const centroForm = document.getElementById("form-agregar-centro");
    const nombreCentroInput = document.getElementById("nombreCentro");
    const direccionCentroInput = document.getElementById("direccionCentro");

centroForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Limpiar errores visuales
  nombreCentroInput.classList.remove("is-invalid");
  direccionCentroInput.classList.remove("is-invalid");
  document.getElementById("error-nombreCentro").textContent = '';
  document.getElementById("error-direccionCentro").textContent = '';

  const nombre_centro = nombreCentroInput.value.trim();
  const direccion = direccionCentroInput.value.trim();
  const id_centro = document.getElementById("idCentroEditar").value || null;
  const esEdicion = !!id_centro;

  let error = false;

  if (!nombre_centro) {
    nombreCentroInput.classList.add("is-invalid");
    document.getElementById("error-nombreCentro").textContent = "Este campo es obligatorio.";
    error = true;
  }

  if (!direccion) {
    direccionCentroInput.classList.add("is-invalid");
    document.getElementById("error-direccionCentro").textContent = "Este campo es obligatorio.";
    error = true;
  }

  if (error) return;

  const url = esEdicion
    ? "https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/modificar_centro_atencion"
    : "https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/registrar_centro_atencion";

  const payload = esEdicion
    ? { id_centro: parseInt(id_centro), nombre_centro, direccion }
    : { nombre_centro, direccion, id_nutricionista };

  const metodo = esEdicion ? "PATCH" : "POST";

  try {
    const response = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok && result.status === "ok") {
      // Cerrar modal con Bootstrap 5
      const modal = bootstrap.Modal.getInstance(document.getElementById("modalAgregarCentro"));
      modal.hide();

      // Limpiar formulario y modo edición
      centroForm.reset();
      document.getElementById("idCentroEditar").value = '';
      document.getElementById("modalAgregarCentroLabel").textContent = "Agregar centro de atención";

      // Feedback
      Swal.fire("¡Éxito!", result.mensaje, "success");

      // Recargar lista de centros
      obtenerCentrosAtencion(id_nutricionista);
    } else {
      Swal.fire("Error", result.mensaje || "No se pudo guardar el centro", "error");
    }

  } catch (error) {
    console.error("Error al guardar centro:", error);
    Swal.fire("Error", "Error de red o del servidor", "error");
  }
});

    async function obtenerCentrosAtencion(id_nutricionista) {
      const contenedor = document.getElementById('lista-centros');
      contenedor.innerHTML = '<p class="text-muted">Cargando centros registrados...</p>';

      try {
        const respuesta = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/centros_atencion/${id_nutricionista}`);
        const data = await respuesta.json();

        if (data.status === 'ok') {
          if (data.centros.length === 0) {
            contenedor.innerHTML = '<p class="text-muted">No tienes centros registrados aún.</p>';

            return;
          }

          contenedor.innerHTML = ''; // Limpiar contenido anterior

          data.centros.forEach(centro => {
            const div = document.createElement('div');
            div.className = 'mb-3 p-3 border rounded shadow-sm';
            div.style.backgroundColor = '#f9f9f9';

            div.innerHTML = `
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">${centro.nombre_centro}</h6>
                  <p class="mb-0 text-muted">${centro.direccion}</p>
                </div>
                <div class="d-flex align-items-center ms-3">
                  <button class="btn btn-sm btn-outline-primary me-2" title="Editar" onclick="editarCentro(${centro.id_centro})">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" title="Eliminar" onclick="eliminarCentro(${centro.id_centro})">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            `;

            contenedor.appendChild(div);
          });

        } else {
          contenedor.innerHTML = `<p class="text-danger">${data.mensaje}</p>`;
          // Mostrar advertencia con Swal de forma diferida
          setTimeout(() => {
            Swal.fire({
              title: '¡Atención!',
              html: `
    <p>Aún no has registrado ningún centro de atención. Es necesario agregar al menos uno para agendar citas.</p>
    <button id="btnAgregarCentroSwal" class="btn btn-success mt-3">+ Agregar centro de atención</button>
  `,
              icon: 'warning',
              showConfirmButton: false,
              didRender: () => {
                const btn = document.getElementById('btnAgregarCentroSwal');
                if (btn) {
                  btn.addEventListener('click', () => {
                    Swal.close(); // Cierra la alerta
                    const modal = new bootstrap.Modal(document.getElementById("modalAgregarCentro"));
                    modal.show(); // Abre el modal de agregar centro
                  });
                }
              }
            });
          }, 100);
        }

      } catch (error) {
        console.error('Error al obtener centros:', error);
        contenedor.innerHTML = '<p class="text-danger">Ocurrió un error al cargar los centros.</p>';
      }
    }

    window.eliminarCentro = async function(id_centro) {
      Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción eliminará el centro de atención de forma permanente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            const response = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/eliminar_centro_atencion/${id_centro}`, {
              method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok && data.status === 'ok') {
              Swal.fire('Eliminado', data.mensaje, 'success');
              const id_nutricionista = sessionStorage.getItem('id_nutricionista');
              obtenerCentrosAtencion(id_nutricionista); // Refrescar lista
            } else {
              Swal.fire('Error', data.mensaje || 'No se pudo eliminar el centro', 'error');
            }
          } catch (error) {
            console.error('Error al eliminar centro:', error);
            Swal.fire('Error', 'Error de red o del servidor', 'error');
          }
        }
      });
    }

    window.editarCentro = async function(id_centro) {
  const id_nutricionista = sessionStorage.getItem("id_nutricionista");

  try {
    const respuesta = await fetch(`https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/centros_atencion/${id_nutricionista}`);
    const data = await respuesta.json();

    if (data.status === 'ok') {
      const centro = data.centros.find(c => c.id_centro === id_centro);
      if (!centro) {
        return Swal.fire("Error", "Centro no encontrado", "error");
      }

      document.getElementById("modalAgregarCentroLabel").textContent = "Editar centro de atención";
      document.getElementById("nombreCentro").value = centro.nombre_centro;
      document.getElementById("direccionCentro").value = centro.direccion;
      document.getElementById("idCentroEditar").value = centro.id_centro;

      const modal = new bootstrap.Modal(document.getElementById("modalAgregarCentro"));
      modal.show();
    } else {
      Swal.fire("Error", data.mensaje || "No se pudo cargar el centro", "error");
    }

  } catch (error) {
    console.error("Error al cargar centro para edición:", error);
    Swal.fire("Error", "Error de red o del servidor", "error");
  }
};

  });
