// ============================================
// Formatea un número como pesos colombianos (10000 -> "10.000")
// Se usa en cualquier parte del sitio donde se muestre un precio (servicios, tienda, panel admin)
// ============================================
function formatearPrecioCOP(valor) {
    return Math.round(valor).toLocaleString('es-CO');
}

// ============================================
// Calcula hace cuánto tiempo se creó algo, en formato legible
// Ej: "hace 3 horas", "hace 2 días"
// Está aquí AFUERA del DOMContentLoaded para que cualquier página
// que cargue main.js pueda usarla (igual que formatearPrecioCOP)
// ============================================
function tiempoTranscurrido(fechaISO) {
    const ahora = new Date();
    const fecha = new Date(fechaISO);
    const segundos = Math.floor((ahora - fecha) / 1000);

    if (segundos < 60) return 'hace un momento';
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} hora${horas !== 1 ? 's' : ''}`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} día${dias !== 1 ? 's' : ''}`;
}

// Espera a que todo el HTML esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded', function () {


    // ============================================
    // SCROLL REVEAL: hace aparecer elementos (como las tarjetas del Inicio)
    // con una animación cuando el usuario baja y los ve entrar en pantalla
    // ============================================
    const revealElements = document.querySelectorAll('.reveal-up');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2, rootMargin: '0px 0px -150px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));


    // ============================================
    // CONTADORES ANIMADOS (+500, +8, 98% en la sección "Sobre EDUCAN")
    // ============================================
    const counters = document.querySelectorAll('.counter');

    function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-target'));
        const duration = 1500;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentValue = Math.floor(progress * target);

            el.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = target;
            }
        }

        requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => observer.observe(counter));


    // ============================================
    // LOGIN, REGISTRO, Y EL BOTÓN DE SESIÓN DEL NAVBAR
    // ============================================
    const API_BASE = '/api';

    function updateAuthButton() {
        const token = localStorage.getItem('access_token');
        const nombre = localStorage.getItem('user_nombre');
        const rolGuardado = localStorage.getItem('user_rol');
        const authButton = document.getElementById('authButton');
        const dropdownMenu = document.getElementById('authDropdownMenu');

        if (token && nombre && authButton) {
            const foto = localStorage.getItem('user_foto');
            authButton.innerHTML = foto
                ? `<img src="${foto}" class="rounded-circle me-2" width="26" height="26" style="object-fit:cover;">${nombre}`
                : nombre;
            authButton.removeAttribute('data-bs-toggle');
            authButton.removeAttribute('data-bs-target');
            authButton.setAttribute('data-bs-toggle', 'dropdown');

            const panelLink = dropdownMenu.querySelector('a[href="/admin-panel/"]');
            if (panelLink) {
                if (rolGuardado === 'adiestrador') {
                    panelLink.href = '/panel-adiestrador/';
                    panelLink.textContent = 'Panel Adiestrador';
                } else if (rolGuardado === 'cliente') {
                    panelLink.href = '/mi-perfil/';
                    panelLink.textContent = 'Mi Perfil';
                }
                // si es administrador, se queda igual apuntando a /admin-panel/
            }

            dropdownMenu.classList.remove('d-none');

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = function (e) {
                    e.preventDefault();
                    localStorage.clear();
                    window.location.href = '/';
                };
            }
        }
    }
    updateAuthButton();

    
    // ============================================
    // VALIDACIÓN DE CAMPOS: cada campo solo acepta lo que le corresponde
    // (también limpia lo que se pegue con Ctrl+V)
    // ============================================
    const QUITAR_NO_LETRAS = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g;   // deja letras, espacios, apóstrofo y guion
    const QUITAR_NO_NUMEROS = /\D/g;                          // deja solo números

    function limitarCampo(id, quitar, maxLen) {
        const campo = document.getElementById(id);
        if (!campo) return;                                   // si la página no tiene ese campo, no pasa nada
        if (maxLen) campo.maxLength = maxLen;
        campo.addEventListener('input', function () {
            const limpio = this.value.replace(quitar, '');
            if (limpio !== this.value) this.value = limpio;
        });
    }

    // Registro: nombre, apellido y ciudad solo con letras; teléfono solo con números
    ['registerNombre', 'registerApellido', 'registerCiudad'].forEach(id => limitarCampo(id, QUITAR_NO_LETRAS, 40));
    limitarCampo('registerTelefono', QUITAR_NO_NUMEROS, 10);
    const campoTel = document.getElementById('registerTelefono');
    if (campoTel) {
        campoTel.inputMode = 'numeric';
        campoTel.pattern = '[0-9]{7,10}';
        campoTel.title = 'Escribe solo números (entre 7 y 10 dígitos).';
    }

        // Mi perfil (página /mi-perfil/): mismos controles que el registro
    ['pNombre', 'pApellido', 'pCiudad'].forEach(id => limitarCampo(id, QUITAR_NO_LETRAS, 40));
    limitarCampo('pTelefono', QUITAR_NO_NUMEROS, 10);
    const pTel = document.getElementById('pTelefono');
    if (pTel) {
        pTel.inputMode = 'numeric';
        pTel.pattern = '[0-9]{7,10}';
        pTel.title = 'Escribe solo números (entre 7 y 10 dígitos).';
    }

    // Mascotas: nombre y raza solo con letras; edad y peso solo con números positivos
    limitarCampo('petNombre', QUITAR_NO_LETRAS, 30);
    limitarCampo('petRaza', QUITAR_NO_LETRAS, 40);
    const petEdad = document.getElementById('petEdad');
    const petPeso = document.getElementById('petPeso');
    if (petEdad) { petEdad.min = 0; petEdad.max = 30; petEdad.step = 1; }
    if (petPeso) { petPeso.min = 0.1; petPeso.max = 150; petPeso.step = 0.1; }
    [petEdad, petPeso].forEach(campo => {
        if (!campo) return;
        // en un campo numérico el navegador deja escribir e, +, - : aquí se bloquean
        campo.addEventListener('keydown', e => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault(); });
    });
    if (petEdad) petEdad.addEventListener('keydown', e => { if (e.key === '.' || e.key === ',') e.preventDefault(); });   // la edad va en años enteros
    ['petConducta', 'petSalud'].forEach(id => { const c = document.getElementById(id); if (c) c.maxLength = 200; });

        // Contacto (/contacto/): nombre solo letras, teléfono solo números
    limitarCampo('cNombre', QUITAR_NO_LETRAS, 60);
    limitarCampo('cTelefono', QUITAR_NO_NUMEROS, 10);
    const cTel = document.getElementById('cTelefono');
    if (cTel) cTel.inputMode = 'numeric';

    // Tienda, datos de entrega: ciudad solo letras, teléfono solo números,
    // dirección con letras, números y los signos típicos (# - . , °)
    const QUITAR_DIRECCION = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s#\-.,°ºª]/g;
    limitarCampo('coCiudad', QUITAR_NO_LETRAS, 40);
    limitarCampo('coTelefono', QUITAR_NO_NUMEROS, 10);
    limitarCampo('coDireccion', QUITAR_DIRECCION, 120);
    const coTel = document.getElementById('coTelefono');
    if (coTel) coTel.inputMode = 'numeric';

    // --- Formulario de Login ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async function (e) {
            e.preventDefault();
            const errorBox = document.getElementById('loginError');
            errorBox.classList.add('d-none');

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch(`${API_BASE}/users/login/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await res.json();

                if (!res.ok) {
                    errorBox.textContent = result.error || 'Error al iniciar sesión.';
                    errorBox.classList.remove('d-none');
                    return;
                }

                localStorage.setItem('access_token', result.access);
                localStorage.setItem('user_nombre', result.usuario.nombre);
                localStorage.setItem('user_rol', result.usuario.rol);
                localStorage.setItem('user_foto', result.usuario.foto || '');

                window.location.reload();
            } catch (err) {
                errorBox.textContent = 'No se pudo conectar con el servidor.';
                errorBox.classList.remove('d-none');
            }
        };
    }

    // --- Mostrar/ocultar certificado + especialidades según el rol elegido en el registro ---
    const registerRolSelect = document.getElementById('registerRol');
    if (registerRolSelect) {
        registerRolSelect.onchange = function () {
            const wrapper = document.getElementById('certificadoWrapper');
            wrapper.classList.toggle('d-none', this.value !== 'adiestrador');
        };
    }

    // --- Formulario de Registro ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async function (e) {
            e.preventDefault();
            const errorBox = document.getElementById('registerError');
            const successBox = document.getElementById('registerSuccess');
            errorBox.classList.add('d-none');
            successBox.classList.add('d-none');

            const rol = document.getElementById('registerRol').value;

            const especialidadesSeleccionadas = Array.from(
                document.querySelectorAll('.especialidad-registro:checked')
            ).map(c => c.value);

            const payload = {
                nombre: document.getElementById('registerNombre').value,
                apellido: document.getElementById('registerApellido').value,
                email: document.getElementById('registerEmail').value,
                telefono: document.getElementById('registerTelefono').value,
                ciudad: document.getElementById('registerCiudad').value,
                password: document.getElementById('registerPassword').value,
                rol: rol,
                especialidades_solicitadas: especialidadesSeleccionadas
            };

            try {
                const res = await fetch(`${API_BASE}/users/register/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (!res.ok) {
                    errorBox.textContent = result.error || JSON.stringify(result);
                    errorBox.classList.remove('d-none');
                    return;
                }

                if (rol === 'adiestrador') {
                    const certificado = document.getElementById('registerCertificado').files[0];

                    const loginRes = await fetch(`${API_BASE}/users/login/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: payload.email, password: payload.password })
                    });
                    const loginResult = await loginRes.json();

                    if (certificado && loginRes.ok) {
                        const formData = new FormData();
                        formData.append('certificado', certificado);
                        await fetch(`${API_BASE}/users/upload-certificado/`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${loginResult.access}` },
                            body: formData
                        });
                    }

                    successBox.textContent = 'Cuenta creada. Tu certificado quedó pendiente de revisión por el administrador.';
                    successBox.classList.remove('d-none');
                    registerForm.reset();
                    return;
                }

                successBox.textContent = 'Cuenta creada correctamente. Ya puedes iniciar sesión.';
                successBox.classList.remove('d-none');
                registerForm.reset();
            } catch (err) {
                errorBox.textContent = 'No se pudo conectar con el servidor.';
                errorBox.classList.remove('d-none');
            }
        };
    }


    // ============================================
    // FILTRO Y BÚSQUEDA DE LA TIENDA (página /shop/)
    // ============================================
    const buscarProducto = document.getElementById('buscarProducto');
    const filtroCategoria = document.getElementById('filtroCategoria');

    if (buscarProducto && filtroCategoria) {
        function filtrarProductos() {
            const texto = buscarProducto.value.toLowerCase();
            const categoria = filtroCategoria.value;
            let visibles = 0;

            document.querySelectorAll('.producto-item').forEach(item => {
                const nombre = item.querySelector('h5').textContent.toLowerCase();
                const coincideTexto = nombre.includes(texto);
                const coincideCategoria = !categoria || item.dataset.categoria === categoria;

                const mostrar = coincideTexto && coincideCategoria;
                item.classList.toggle('d-none', !mostrar);
                if (mostrar) visibles++;
            });
            document.getElementById('sinResultados').classList.toggle('d-none', visibles > 0);
        }

        buscarProducto.addEventListener('input', filtrarProductos);
        filtroCategoria.addEventListener('change', filtrarProductos);
    }

    
    // ============================================
    // SOLICITUD DE SERVICIO (página /solicitar-servicio/)
    // Solo la usa un cliente logueado
    // ============================================
    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
        const token = localStorage.getItem('access_token');
        const rolActual = localStorage.getItem('user_rol');

        if (!token || rolActual !== 'cliente') {
            document.getElementById('noAuthMsg').classList.remove('d-none');
        } else {
            document.getElementById('requestFormWrapper').classList.remove('d-none');

            // reqHeaders se declara AQUÍ, antes de usarse en cualquier función de este bloque
            const reqHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            
            // Fecha de hoy en hora local, formato AAAA-MM-DD (el que usa el <input type="date">)
            function hoyISO() {
                const d = new Date();
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            }
            // El calendario no deja elegir días que ya pasaron (ni ayer, ni meses anteriores)
            document.getElementById('reqFecha').min = hoyISO();

            // Llena el <select> de mascotas con las que el cliente ya tiene registradas
            function cargarMisMascotas() {
                fetch(`${API_BASE}/pets/`, { headers: reqHeaders }).then(r => r.json()).then(mascotas => {
                    const select = document.getElementById('reqMascota');
                    if (!mascotas.length) {
                        document.getElementById('sinMascotasMsg').classList.remove('d-none');
                        select.disabled = true;
                        return;
                    }
                    select.innerHTML = '<option value="" disabled selected>Selecciona una mascota</option>' +
                        mascotas.map(m => `<option value="${m.id}">${m.nombre} (${m.raza})</option>`).join('');
                });
            }
            cargarMisMascotas();

            // Carga y pinta las solicitudes que este cliente ya ha hecho
            const MESES_SOL = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                        // Huella de patita (para el círculo de cada solicitud)
            const PATA_RS = '<ellipse cx="5.5" cy="11" rx="2" ry="2.6"/><ellipse cx="9.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="14.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="18.5" cy="11" rx="2" ry="2.6"/><path d="M12 11c-3 0-5.5 3-5.5 5.7 0 2 1.6 2.8 3 2.8 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.4 0 3-.8 3-2.8C17.5 14 15 11 12 11z"/>';
            function escSol(t) {
                return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            }
            // "2026-10-30" -> "30 oct 2026"
            function fechaCorta(iso) {
                const p = String(iso || '').split('-');
                if (p.length < 3) return escSol(iso || '');
                return parseInt(p[2], 10) + ' ' + MESES_SOL[parseInt(p[1], 10) - 1] + ' ' + p[0];
            }

            function cargarMisSolicitudes() {
                fetch(`${API_BASE}/requests/`, { headers: reqHeaders })
                    .then(r => r.json())
                    .then(solicitudes => {
                        const cont = document.getElementById('misSolicitudes');
                        if (!Array.isArray(solicitudes) || !solicitudes.length) {
                            cont.innerHTML = '<div class="rs-vacio"><i class="bi bi-inbox"></i>Aún no has hecho ninguna solicitud.</div>';
                            return;
                        }
                        cont.innerHTML = solicitudes.map(s => {
                            const estado = ['pendiente', 'aceptada', 'rechazada', 'completado'].includes(s.estado) ? s.estado : '';
                            const a = s.adiestrador_info;
                            const entrenador = ((s.estado === 'aceptada' || s.estado === 'completado') && a) ? `
                                <div class="rs-trainer">
                                    ${a.foto
                                        ? `<img class="rs-trainer-av" src="${escSol(a.foto)}" alt="">`
                                        : `<span class="rs-trainer-av">${escSol(((a.nombre || '?').charAt(0) + (a.apellido || '').charAt(0)).toUpperCase())}</span>`}
                                    <div class="info">
                                        <b>${escSol(a.nombre)} ${escSol(a.apellido)}</b>
                                        <div class="rs-chips">${(a.especialidades || []).map(e => `<span>${escSol(e)}</span>`).join('')}</div>
                                    </div>
                                    ${a.certificado ? `<a href="${escSol(a.certificado)}" target="_blank" rel="noopener" class="rs-cert"><i class="bi bi-file-earmark-text"></i>Ver certificado</a>` : ''}
                                </div>` : '';
                            return `
                            <div class="rs-sol ${estado}">
                                <div class="rs-sol-top">
                                    <div class="rs-sol-main">
                                        <span class="rs-ico rs-ico-sm"><svg viewBox="0 0 24 24" aria-hidden="true">${PATA_RS}</svg></span>
                                        <div>
                                            <h3>${escSol(s.servicio)}</h3>
                                            <div class="rs-meta">
                                                <span><i class="bi bi-heart"></i>${escSol(s.perro_nombre)}</span>
                                                <span><i class="bi bi-calendar3"></i>Inicio: ${fechaCorta(s.fecha_inicio)}</span>
                                            </div>
                                            ${s.estado === 'pendiente' ? `<div class="rs-espera"><i class="bi bi-clock"></i>Esperando desde ${escSol(tiempoTranscurrido(s.creado_en))}</div>` : ''}
                                        </div>
                                    </div>
                                    <span class="rs-pill ${estado}">${escSol(s.estado)}</span>
                                </div>
                                ${entrenador}
                            </div>`;
                        }).join('');
                    });
            }
            cargarMisSolicitudes();

            // Envía el formulario: crea la solicitud usando la mascota seleccionada
            requestForm.onsubmit = async function (e) {
                e.preventDefault();
                const errorBox = document.getElementById('requestError');
                const successBox = document.getElementById('requestSuccess');
                errorBox.classList.add('d-none');
                successBox.classList.add('d-none');

                const payload = {
                    servicio: document.getElementById('reqServicio').value,
                    duracion: document.getElementById('reqDuracion').value,
                    fecha_inicio: document.getElementById('reqFecha').value,
                    mascota_id: parseInt(document.getElementById('reqMascota').value)
                };

                
                // Por si escriben la fecha a mano: no se acepta una fecha que ya pasó
                if (payload.fecha_inicio < hoyISO()) {
                    errorBox.textContent = 'La fecha de inicio no puede ser una fecha que ya pasó.';
                    errorBox.classList.remove('d-none');
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE}/requests/`, {
                        method: 'POST', headers: reqHeaders, body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (!res.ok) {
                        errorBox.textContent = result.error || JSON.stringify(result);
                        errorBox.classList.remove('d-none');
                        return;
                    }

                    successBox.textContent = 'Solicitud enviada correctamente.';
                    successBox.classList.remove('d-none');
                    requestForm.reset();
                    cargarMisSolicitudes();
                } catch (err) {
                    errorBox.textContent = 'No se pudo conectar con el servidor.';
                    errorBox.classList.remove('d-none');
                }
            };
        }
    }

});