// ============================================
// Formatea un número como pesos colombianos (10000 -> "10.000")
// Se usa en cualquier parte del sitio donde se muestre un precio (servicios, tienda, panel admin)
// ============================================
function formatearPrecioCOP(valor) {
    return Math.round(valor).toLocaleString('es-CO');
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

    // Anima un solo contador, desde 0 hasta su data-target
    function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-target'));
        const duration = 1500; // duración total de la animación, en milisegundos
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1); // valor entre 0 y 1
            const currentValue = Math.floor(progress * target);

            el.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(update); // sigue animando hasta llegar a 1
            } else {
                el.textContent = target; // asegura el número exacto al final
            }
        }

        requestAnimationFrame(update);
    }

    // Detecta cuándo un contador entra en pantalla, para dispararlo solo una vez
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
    const API_BASE = 'http://127.0.0.1:8000/api';

    // Actualiza el botón "Iniciar sesión" del navbar según si hay sesión activa,
    // y ajusta el link del panel (Admin / Adiestrador) según el rol del usuario
    function updateAuthButton() {
        const token = localStorage.getItem('access_token');
        const nombre = localStorage.getItem('user_nombre');
        const rolGuardado = localStorage.getItem('user_rol');
        const authButton = document.getElementById('authButton');
        const dropdownMenu = document.getElementById('authDropdownMenu');

        if (token && nombre && authButton) {
            authButton.textContent = nombre;
            authButton.removeAttribute('data-bs-toggle');
            authButton.removeAttribute('data-bs-target');
            authButton.setAttribute('data-bs-toggle', 'dropdown');

            // Ajusta el link del panel según el rol: admin, adiestrador o cliente (sin panel)
            const panelLink = dropdownMenu.querySelector('a[href="/admin-panel/"]');
            if (panelLink) {
                if (rolGuardado === 'adiestrador') {
                    panelLink.href = '/panel-adiestrador/';
                    panelLink.textContent = 'Panel Adiestrador';
                } else if (rolGuardado !== 'administrador') {
                    panelLink.remove(); // un cliente no ve ningún link de panel
                }
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

                window.location.reload();
            } catch (err) {
                errorBox.textContent = 'No se pudo conectar con el servidor.';
                errorBox.classList.remove('d-none');
            }
        };
    }

    // --- Mostrar/ocultar el bloque de certificado + especialidades según el rol elegido en el registro ---
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

            // Especialidades marcadas por el propio adiestrador al registrarse
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

                // Si es adiestrador, hacemos un login automático (invisible) para poder
                // subir su certificado justo después de registrarse
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



    // --- Filtro y búsqueda de la tienda ---
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

            const reqHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

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
                            <div class="border rounded-3 p-3 mb-2 d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${s.servicio}</strong> — ${s.perro_nombre}
                                    <div class="text-muted small">Inicio: ${s.fecha_inicio}</div>
                                </div>
                                <span class="badge ${badgeColor[s.estado] || 'bg-secondary'}">${s.estado}</span>
                            </div>
                        `).join('');
                    });
            }
            cargarMisSolicitudes();

            // Envía el formulario: crea la solicitud, y si adjuntó foto del perro, la sube aparte
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
                    perro_nombre: document.getElementById('reqPerroNombre').value,
                    perro_raza: document.getElementById('reqPerroRaza').value,
                    perro_edad: parseInt(document.getElementById('reqPerroEdad').value),
                    perro_peso: parseFloat(document.getElementById('reqPerroPeso').value),
                    perro_sexo: document.getElementById('reqPerroSexo').value,
                    perro_esterilizado: document.getElementById('reqPerroEsterilizado').value === 'true',
                    perro_vacunas_al_dia: document.getElementById('reqPerroVacunas').value === 'true',
                    perro_conducta: document.getElementById('reqPerroConducta').value,
                    perro_salud: document.getElementById('reqPerroSalud').value
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

                    // Si adjuntó foto, la subimos aparte (multipart/form-data, no JSON)
                    const foto = document.getElementById('reqPerroFoto').files[0];
                    if (foto) {
                        const formData = new FormData();
                        formData.append('foto', foto);
                        await fetch(`${API_BASE}/requests/${result.id}/foto/`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });
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