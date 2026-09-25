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
            function cargarMisSolicitudes() {
                fetch(`${API_BASE}/requests/`, { headers: reqHeaders })
                    .then(r => r.json())
                    .then(solicitudes => {
                        const cont = document.getElementById('misSolicitudes');
                        if (!solicitudes.length) {
                            cont.innerHTML = '<p class="text-muted small">Aún no has hecho ninguna solicitud.</p>';
                            return;
                        }
                        const badgeColor = { pendiente: 'bg-warning text-dark', aceptada: 'bg-success', rechazada: 'bg-danger' };
                        cont.innerHTML = solicitudes.map(s => `
                            <div class="border rounded-3 p-3 mb-2">
                            <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>${s.servicio}</strong> — ${s.perro_nombre}
                                        <div class="text-muted small">Inicio: ${s.fecha_inicio}</div>
                                        ${s.estado === 'pendiente' ? `<div class="text-warning small">Esperando desde ${tiempoTranscurrido(s.creado_en)}</div>` : ''}
                                    </div>
                                    <span class="badge ${badgeColor[s.estado] || 'bg-secondary'}">${s.estado}</span>
                                </div>
                                ${s.estado === 'aceptada' && s.adiestrador_info ? `
                                    <hr>
                                    <div class="d-flex align-items-center gap-2">
                                        <img src="${s.adiestrador_info.foto || 'https://via.placeholder.com/50'}" class="rounded-circle" width="50" height="50" style="object-fit:cover;">
                                        <div>
                                            <strong>${s.adiestrador_info.nombre} ${s.adiestrador_info.apellido}</strong>
                                            <div class="text-muted small">${(s.adiestrador_info.especialidades || []).join(', ')}</div>
                                            ${s.adiestrador_info.certificado ? `<a href="${s.adiestrador_info.certificado}" target="_blank" class="small">Ver certificado</a>` : ''}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('');
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