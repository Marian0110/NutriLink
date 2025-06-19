document.getElementById('registro-form').addEventListener('submit', async function(e) {
        // Reseteo de errores
        document.querySelectorAll('.error-message').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    
        // Obtención de valores
        const primerNombre = document.getElementById('primerNombre').value.trim();
        const apellidoP = document.getElementById('apellidoP').value.trim();
        const rut = document.getElementById('rut').value.trim();
        const digitoV = document.getElementById('dv').value;
        const email = document.getElementById('email').value.trim();
        const contraseña = document.getElementById('contraseña').value;
        const confirmarC = document.getElementById('confirmarC').value;
    
        // Mensajes de error
        const errorPrimerNombre = document.getElementById('error-primerNombre');
        const errorApellidoP = document.getElementById('error-apellidoP');
        const errorRut = document.getElementById('error-rut');
        const errorDv = document.getElementById('error-dv');
        const errorEmail = document.getElementById('error-email');
        const errorContraseña = document.getElementById('error-contraseña');
        const errorConfirmarC = document.getElementById('error-confirmarC');
        
        let valid = true;
    
        if (primerNombre === "" && apellidoP === "" && rut === "" && digitoV === "" && email === "" && contraseña === "" && confirmarC === "") {
            Swal.fire({
                icon: 'error',
                title: '¡Campos vacíos!',
                text: 'Por favor, rellene todos los campos obligatorios.',
                confirmButtonText: 'Aceptar'
            });
            valid = false;
        }
    
        if (valid) {
            const dvRegex = /^[0-9Kk]{1}$/;
            if (!dvRegex.test(digitoV)) {
                errorDv.textContent = "Dígito verificador inválido (debe ser un número o K)";
                errorDv.style.display = "block";
                valid = false;
            } else {
                errorDv.style.display = "none";
            }
            
            if (!validarRutChileno(rut, digitoV)) {
                errorRut.textContent = "RUT inválido";
                errorRut.style.display = "block";
                valid = false;
            } else {
                errorRut.style.display = "none";
            }
    
            const nombreRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,}$/;
            if (!nombreRegex.test(primerNombre)) {
                errorPrimerNombre.textContent = "El nombre debe tener al menos 3 caracteres";
                errorPrimerNombre.style.display = "block";
                valid = false;
            } else {
                errorPrimerNombre.style.display = "none";
            }
    
            if (!nombreRegex.test(apellidoP)) {
                errorApellidoP.textContent = "El primer apellido debe tener al menos 3 caracteres";
                errorApellidoP.style.display = "block";
                valid = false;
            } else {
                errorApellidoP.style.display = "none";
            }
    
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errorEmail.textContent = "Correo electrónico inválido";
                errorEmail.style.display = "block";
                valid = false;
            } else {
                errorEmail.style.display = "none";
            }
    
            const passRegex = /^(?=.*[A-Z]).{6,}$/;
            if (!passRegex.test(contraseña)) {
                errorContraseña.textContent = "La contraseña debe tener al menos 6 caracteres y una mayúscula";
                errorContraseña.style.display = "block";
                valid = false;
            } else {
                errorContraseña.style.display = "none";
            }
    
            if (contraseña !== confirmarC) {
                errorConfirmarC.textContent = "Las contraseñas no coinciden";
                errorConfirmarC.style.display = "block";
                valid = false;
            } else {
                errorConfirmarC.style.display = "none";
            }
        }
    
        if (valid) {
            try {
                // Mostrar loader mientras se procesa
                Swal.fire({
                    title: 'Procesando registro',
                    html: 'Por favor espera...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                // Hacemos la petición a la API
                const response = await fetch('https://nutrilinkapi-production.up.railway.app/api_nutrilink/nutricionista/registrar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        rut_nutricionista: rut,
                        dv: digitoV,
                        primer_nombre: primerNombre,
                        apellido_paterno: apellidoP,
                        correo: email,
                        contrasena: contraseña,
                    })
                });
    
                const data = await response.json();
    
                if (response.ok) {
                    sessionStorage.setItem('id_nutricionista', data.id_nutricionista);

                    Swal.fire({
                        icon: 'success',
                        title: '¡Registro exitoso!',
                        text: data.mensaje || 'Ahora puedes iniciar sesión.',
                        confirmButtonText: 'Aceptar'
                    }).then(() => {
                        window.location.href = LOGIN_URL;  // Variable definida en el template
                    });
                } else {
                    // Manejar errores específicos de la API
                    let errorMessage = 'Error al registrar. Verifica los datos ingresados.';
                    
                    if (data.error) {
                        errorMessage = data.error;
                        
                        // Mapear errores específicos a campos del formulario
                        if (data.error.includes('correo') || data.error.includes('email')) {
                            errorEmail.textContent = data.error;
                            errorEmail.style.display = "block";
                        } else if (data.error.includes('RUT') || data.error.includes('rut')) {
                            errorRut.textContent = data.error;
                            errorRut.style.display = "block";
                        }
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Error al registrar',
                        text: errorMessage,
                        confirmButtonText: 'Aceptar'
                    });
                }
            } catch (error) {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error de conexión',
                    text: 'No se pudo conectar con el servidor.',
                    confirmButtonText: 'Aceptar'
                });
            }
        }
    });
    
    // Validación de RUT
    function validarRutChileno(rut, dv) {
        rut = rut.replace(/\./g, ''); // Eliminamos puntos si los hay
        if (rut.length < 7 || rut.length > 8) return false; // Validamos largo
    
        dv = dv.toUpperCase(); // En caso de que sea 'k'
    
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
    
    // Ocultar errores al escribir
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', function() {
            const errorElement = document.getElementById(`error-${input.id}`);
            if (errorElement && input.value.trim() !== "") {
                errorElement.style.display = "none";
            }
        });
    });
