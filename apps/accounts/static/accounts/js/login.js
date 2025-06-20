document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const emailLogin = document.getElementById('emailLogin').value.trim();
    const contraseñaLogin = document.getElementById('contraseñaLogin').value;
    const rememberMe = document.getElementById('remember_me').checked; // Obtener checkbox
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
                // Lógica de recordar sesión
                    if (rememberMe) {
                        // Guardar en localStorage (persiste al cerrar navegador)
                        localStorage.setItem('id_nutricionista', data.id_nutricionista);
                        localStorage.setItem('correo', emailLogin);
                        localStorage.setItem('remember_session', 'true');
                        
                        // Configurar fecha de expiración (30 días)
                        const expireDate = new Date();
                        expireDate.setDate(expireDate.getDate() + 30);
                        localStorage.setItem('session_expiry', expireDate.toISOString());
                        
                        // Limpiar sessionStorage si existía
                        sessionStorage.clear();
                        
                        console.log('Sesión guardada por 30 días');
                    } else {
                        // Guardar en sessionStorage (se borra al cerrar navegador)
                        sessionStorage.setItem('id_nutricionista', data.id_nutricionista);
                        sessionStorage.setItem('correo', emailLogin);
                        
                        // Limpiar localStorage si existía
                        localStorage.removeItem('id_nutricionista');
                        localStorage.removeItem('correo');
                        localStorage.removeItem('remember_session');
                        localStorage.removeItem('session_expiry');
                        
                        console.log('Sesión temporal hasta cerrar navegador');
                    }
                window.location.href = '/accounts/dashboard'; 
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

// Función para verificar sesión al cargar la página
function checkRememberedSession() {
    const rememberSession = localStorage.getItem('remember_session');
    const sessionExpiry = localStorage.getItem('session_expiry');
    const nutricionistaId = localStorage.getItem('id_nutricionista');
    
    if (rememberSession === 'true' && sessionExpiry && nutricionistaId) {
        const expiryDate = new Date(sessionExpiry);
        const now = new Date();
        
        if (now < expiryDate) {
            // Sesión aún válida
            console.log('Sesión recordada activa, redirigiendo...');
            window.location.href = '/accounts/dashboard';
            return true;
        } else {
            // Sesión expirada, limpiar
            console.log('Sesión recordada expirada, limpiando...');
            localStorage.removeItem('id_nutricionista');
            localStorage.removeItem('correo');
            localStorage.removeItem('remember_session');
            localStorage.removeItem('session_expiry');
        }
    }
    
    // Verificar sessionStorage para sesión temporal
    const tempNutricionistaId = sessionStorage.getItem('id_nutricionista');
    if (tempNutricionistaId) {
        window.location.href = '/accounts/dashboard';
        return true;
    }
    
    return false;
}

// Verificar sesión al cargar la página (solo en login)
document.addEventListener('DOMContentLoaded', function() {
    // Solo verificar si estamos en la página de login
    if (window.location.pathname.includes('login')) {
        checkRememberedSession();
    }
});

// Función para obtener datos de sesión (para usar en otras páginas)
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
    
// Limpieza de errores al escribir
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        const errorElement = document.getElementById(`error-${input.id}`);
        if (errorElement && input.value.trim() !== "") {
            errorElement.style.display = "none";
        }
    });
});