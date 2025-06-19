document.getElementById("logout-link").addEventListener("click", function(e) {
  e.preventDefault();

  Swal.fire({
    title: '¿Estás seguro/a?',
    text: '¿Deseas cerrar sesión?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'Cerrando sesión...',
        html: 'Espere un momento',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Limpiar sessionStorage y redirigir
      setTimeout(() => {
        sessionStorage.removeItem("id_nutricionista");
        sessionStorage.removeItem("correo");
        sessionStorage.removeItem("contrasena");
        window.location.href = LOGIN_URL;  // Variable definida en el template
      }, 3000);
    }
  });
});

document.getElementById("eliminar-cuenta").addEventListener("click", async function(e) {
  e.preventDefault();

  // Primera confirmacion
  const { isConfirmed: confirm1 } = await Swal.fire({
    title: '¿Eliminar cuenta permanentemente?',
    text: 'Esta acción no se puede deshacer y perderás todos tus datos',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc3545',
    reverseButtons: true
  });

  if (!confirm1) return;

  // Segunda confirmacion con entrada de credenciales
  const { value: formValues, isConfirmed: confirm2 } = await Swal.fire({
    title: 'Confirmar eliminación',
    html:
      '<p>Por seguridad, ingresa tus credenciales:</p>' +
      '<input id="swal-email" class="swal2-input" placeholder="Correo electrónico" type="email">' +
      '<input id="swal-password" class="swal2-input" placeholder="Contraseña" type="password">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Confirmar eliminación',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc3545',
    preConfirm: () => {
      return {
        email: document.getElementById('swal-email').value,
        password: document.getElementById('swal-password').value
      }
    },
    validationMessage: 'Ambos campos son requeridos'
  });

  if (!confirm2) return;

  try {
    // Mostrar carga mientras se procesa
    Swal.fire({
      title: 'Eliminando cuenta...',
      html: 'Esto puede tomar unos momentos',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // Envio solicitud al endpoint
    const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/eliminar', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        correo: formValues.email,
        contrasena: formValues.password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al eliminar la cuenta');
    }

    // Exito - limpiar sesion y redirigir a login
    Swal.fire({
      title: 'Cuenta eliminada',
      text: data.mensaje || 'Tu cuenta ha sido eliminada permanentemente',
      icon: 'success'
    }).then(() => {
      sessionStorage.clear();
      window.location.href = LOGIN_URL;  // Variable definida en el template
    });

  } catch (error) {
    // Manejo de errores especificos
    let errorMessage = error.message;
    
    if (errorMessage.includes('Correo no registrado')){
      errorMessage = 'El correo ingresado no está registrado, intenta de nuevo';
    } else if (errorMessage.includes('Contraseña incorrecta')) {
      errorMessage = 'La contraseña ingresada es incorrecta, intenta de nuevo';
    }

    Swal.fire({
      title: 'Error',
      text: errorMessage,
      icon: 'error'
    });
  }
});