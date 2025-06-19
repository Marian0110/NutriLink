document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const emailLogin = document.getElementById('emailLogin').value.trim();
    const contraseñaLogin = document.getElementById('contraseñaLogin').value;
    const errorEmailLogin = document.getElementById('error-emailLogin');
    const errorContraseñaLogin = document.getElementById('error-contraseñaLogin');
    
    let valid = true;
    
    if (emailLogin === "" && contraseñaLogin === "") {
        Swal.fire({
            icon: 'error',
            title: '¡Campos vacíos!',
            text: 'Por favor, rellene todos los campos obligatorios.',
            confirmButtonText: 'Aceptar'
        });
        valid = false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLogin)) {
        errorEmailLogin.textContent = "Correo electrónico inválido";
        errorEmailLogin.style.display = "block";
        valid = false;
    } else {
        errorEmailLogin.style.display = "none";
    }
    
    if (valid) {
        try {
            const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    correo: emailLogin,
                    contrasena: contraseñaLogin
                })
            });
    
            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Autentificación exitosa',
                    confirmButtonText: 'Aceptar'
                });
                setTimeout(() => {
                // Login correcto, guardar el token o guardar credenciales en sessionStorage (no recomendado para produccion)
                sessionStorage.setItem('id_nutricionista', data.id_nutricionista); 
                sessionStorage.setItem('correo', emailLogin);
                sessionStorage.setItem('contrasena', contraseñaLogin);
                // localStorage.setItem('token', data.token); // falta esto en lugar del
                window.location.href = '/accounts/perfil'; 
                }, 2000);
                    
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de autenticación',
                    text: data.message || 'Correo o contraseña incorrectos',
                    confirmButtonText: 'Aceptar'
                });
            }
        } catch (error) {
            console.error('Error en la solicitud:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de red',
                text: 'No se pudo conectar con el servidor. Intenta nuevamente.',
                    confirmButtonText: 'Aceptar'
            });
        }
    }
});
    
// Limpieza de errores al escribir
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        const errorElement = document.getElementById(`error-${input.id}`);
        if (errorElement && input.value.trim() !== "") {
            errorElement.style.display = "none";
        }
    });
});