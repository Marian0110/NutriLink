console.log('appointments.js cargado');

function generarBloquesHorarios() {
    const contenedor = document.getElementById('bloques-horarios');
    contenedor.innerHTML = '';
    const inicio = 8;
    const fin = 23;

    for (let hora = inicio; hora < fin; hora++) {
        const horaStr = hora.toString().padStart(2, '0') + ':00';
        const col = document.createElement('div');
        col.className = 'col';

        col.innerHTML = `
        <div class="border rounded-3 shadow-sm d-flex align-items-center justify-content-center mx-auto" style="height: 40px; max-width: 200px;">
            <div class="form-check m-0">
                <input class="form-check-input me-1" type="checkbox" value="${horaStr}" id="hora-${hora}">
                <label class="form-check-label small" for="hora-${hora}">${horaStr}</label>
            </div>
        </div>
        `;

        contenedor.appendChild(col);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const inputFecha = document.getElementById('fecha');
    if (inputFecha) {
        inputFecha.addEventListener('change', generarBloquesHorarios);
    }
});