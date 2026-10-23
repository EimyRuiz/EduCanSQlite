(function () {
    'use strict';

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const SESSION_KEYS = ['access_token', 'user_nombre', 'user_rol', 'user_foto'];

    // ----------------------------------------------------------------
    // Utilidades de validación visual
    // ----------------------------------------------------------------

    // Pinta un campo como válido (verde) o inválido (rojo + mensaje).
    // msg vacío = válido. showValid=false evita el verde (en el login solo se muestra el rojo).
    function mark(input, msg, showValid) {
        const ok = !msg;
        input.classList.toggle('is-invalid', !ok);
        input.classList.toggle('is-valid', ok && showValid);
        if (!ok) {
            const field = input.closest('.auth-field');
            const fb = field && field.querySelector('.invalid-feedback');
            if (fb) fb.textContent = msg;
        }
        return ok;
    }

    function clearMarks(form) {
        form.querySelectorAll('.is-valid, .is-invalid').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
    }

    // Lee un valor sin espacios sobrantes
    const val = id => document.getElementById(id).value.trim();


    // ----------------------------------------------------------------
    // REDIRECCIÓN DESPUÉS DE INICIAR SESIÓN
    // Al enviar el login se deja una marca ("login_pending"). main.js hace el login y recarga la página;
    // al cargar de nuevo, si hay marca y hay sesión, se manda al usuario directo a su panel.
    // ----------------------------------------------------------------
    function redirectAfterLogin() {
        let pending = null;
        try { pending = sessionStorage.getItem('login_pending'); } catch (e) { /* ignorar */ }
        if (!pending) return false;
        try { sessionStorage.removeItem('login_pending'); } catch (e) { /* ignorar */ }

        const token = localStorage.getItem('access_token');
        if (!token) return false;   // el login falló: no hay sesión, no se redirige

        const rol = localStorage.getItem('user_rol');
        const nombre = localStorage.getItem('user_nombre') || '';
        const destinos = {
            cliente: '/mi-perfil/',
            adiestrador: '/panel-adiestrador/',
            administrador: '/admin-panel/'
        };
        const destino = destinos[rol] || '/';

        try { sessionStorage.setItem('welcome_msg', `¡Bienvenido de nuevo, ${nombre}!`); } catch (e) { /* ignorar */ }
        if (window.location.pathname !== destino) {
            window.location.href = destino;
            return true;
        }
        return false;
    }

    // ----------------------------------------------------------------
    // 1. NAVBAR
    // ----------------------------------------------------------------
    function renderNavbar() {
        const guest = document.getElementById('navGuest');
        const user = document.getElementById('navUser');
        if (!guest || !user) return;

        const token = localStorage.getItem('access_token');
        const nombre = localStorage.getItem('user_nombre');
        if (!token || !nombre) {            // sin sesión: se ven los botones de invitado
            guest.classList.remove('d-none');
            user.classList.add('d-none');
            return;
        }

        const rol = localStorage.getItem('user_rol');
        const foto = localStorage.getItem('user_foto');
        guest.classList.add('d-none');
        user.classList.remove('d-none');

        document.getElementById('navUserName').textContent = nombre;
        document.getElementById('navUserRole').textContent =
            { cliente: 'Cliente', adiestrador: 'Adiestrador', administrador: 'Admin' }[rol] || rol;

        // Avatar: foto real si existe; si no, la inicial del nombre
        const avatar = document.getElementById('navAvatar');
        avatar.textContent = '';
        if (foto) {
            const img = document.createElement('img');
            img.src = foto;
            img.alt = nombre;
            avatar.appendChild(img);
        } else {
            avatar.textContent = nombre.charAt(0).toUpperCase();
        }

        // Link al panel según el rol
        const panel = {
            administrador: ['/admin-panel/', 'Panel de administración'],
            adiestrador: ['/panel-adiestrador/', 'Mi panel'],
            cliente: ['/mi-perfil/', 'Mi panel']
        }[rol] || ['/', 'Inicio'];
        document.getElementById('navPanelLink').href = panel[0];
        document.getElementById('navPanelText').textContent = panel[1];

        // Cerrar sesión: borra solo las llaves de sesión (conserva "Recordarme")
        document.getElementById('logoutBtn').onclick = function (e) {
            e.preventDefault();
            SESSION_KEYS.forEach(k => localStorage.removeItem(k));
            window.location.href = '/';
        };
    }

    // ----------------------------------------------------------------
    // 2. LOGIN
    // ----------------------------------------------------------------
    function initLogin() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        const emailInput = document.getElementById('loginEmail');
        const passInput = document.getElementById('loginPassword');
        const remember = document.getElementById('loginRemember');

        function validateEmail() {
            const v = emailInput.value.trim();
            return mark(emailInput, !v ? 'Por favor introduce tu correo.' : (!EMAIL_RE.test(v) ? 'Por favor introduce un correo válido.' : ''), false);
        }
        function validatePass() {
            return mark(passInput, passInput.value ? '' : 'Por favor introduce tu contraseña.', false);
        }

        // Al mostrar el modal: limpia mensajes y rellena el correo si lo habían recordado
        document.getElementById('loginModal').addEventListener('show.bs.modal', function () {
            clearMarks(form);
            ['loginError', 'loginInfo'].forEach(id => document.getElementById(id).classList.add('d-none'));
            try {
                const saved = localStorage.getItem('remember_email');
                if (saved) { emailInput.value = saved; remember.checked = true; }
            } catch (e) { /* localStorage no disponible */ }
        });

        emailInput.addEventListener('blur', validateEmail);
        passInput.addEventListener('blur', validatePass);
        emailInput.addEventListener('input', () => emailInput.classList.contains('is-invalid') && validateEmail());
        passInput.addEventListener('input', () => passInput.classList.contains('is-invalid') && validatePass());

        // Captura el submit ANTES que main.js: si hay errores, no deja que main.js envíe nada
        form.addEventListener('submit', function (e) {
            const ok = validateEmail() & validatePass();   // "&" evalúa ambos para marcar los dos campos
            if (!ok) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            try {
                if (remember.checked) localStorage.setItem('remember_email', emailInput.value.trim());
                else localStorage.removeItem('remember_email');
                sessionStorage.setItem('login_pending', '1');
            } catch (err) { /* ignorar */ }
        }, true);

        // "¿Olvidaste tu contraseña?": aún no hay envío de correos, se avisa con un mensaje
        document.getElementById('forgotPasswordLink').addEventListener('click', function (e) {
            e.preventDefault();
            const box = document.getElementById('loginInfo');
            box.textContent = 'La recuperación de contraseña estará disponible próximamente. Por ahora, comunícate con el administrador.';
            box.classList.remove('d-none');
        });
    }

    // ----------------------------------------------------------------
    // 3. REGISTRO (2 pasos)
    // ----------------------------------------------------------------
    function passwordChecks(p) {
        return {
            length: p.length >= 8,
            upper: /[A-ZÁÉÍÓÚÑ]/.test(p),
            lower: /[a-záéíóúñ]/.test(p),
            number: /\d/.test(p)
        };
    }

    function initRegister() {
        const form = document.getElementById('registerForm');
        if (!form) return;

        const $ = id => document.getElementById(id);
        const pass = $('registerPassword');
        const confirm = $('registerPasswordConfirm');
        const terms = $('registerTerminos');
        let step = 1;   // paso actual del formulario

        // Cada validador devuelve '' si está bien, o el mensaje de error
        const rules = {
            registerNombre: () => val('registerNombre').length >= 2 ? '' : 'Escribe tu nombre.',
            registerApellido: () => val('registerApellido').length >= 2 ? '' : 'Escribe tu apellido.',
            registerEmail: () => {
                const v = val('registerEmail');
                return !v ? 'Escribe tu correo.' : (EMAIL_RE.test(v) ? '' : 'Por favor introduce un correo válido.');
            },
            registerTelefono: () => {
                const digits = val('registerTelefono').replace(/\D/g, '');
                return digits.length >= 7 && digits.length <= 15 ? '' : 'Introduce un teléfono válido (7 a 15 dígitos).';
            },
            registerPassword: () => {
                const c = passwordChecks(pass.value);
                return c.length && c.upper && c.lower && c.number
                    ? '' : 'La contraseña no cumple los requisitos.';
            },
            registerPasswordConfirm: () => !confirm.value ? 'Confirma tu contraseña.'
                : (confirm.value === pass.value ? '' : 'Las contraseñas no coinciden.')
        };

        const STEP1_FIELDS = ['registerNombre', 'registerApellido', 'registerEmail', 'registerTelefono'];
        const STEP2_FIELDS = ['registerPassword', 'registerPasswordConfirm'];

        function check(id) { return mark($(id), rules[id](), true); }

        // Valida una lista de campos SIN cortarse en el primer error (para marcarlos todos)
        function checkAll(ids) {
            let ok = true;
            ids.forEach(id => { if (!check(id)) ok = false; });
            return ok;
        }

        // ---- Cambio de paso ----
        function goTo(n) {
            step = n;
            $('regStep1').classList.toggle('d-none', n !== 1);
            $('regStep2').classList.toggle('d-none', n !== 2);
            $('regDot1').classList.toggle('active', n === 1);
            $('regDot1').classList.toggle('done', n === 2);
            $('regDot2').classList.toggle('active', n === 2);
            $('regLine').classList.toggle('done', n === 2);
            $('regStepLabel').textContent = n === 1
                ? 'Paso 1 de 2 · Datos personales'
                : 'Paso 2 de 2 · Perfil y seguridad';
            const body = document.querySelector('#registerModal .modal-body');
            if (body) body.scrollTop = 0;
        }
        $('regBackBtn').addEventListener('click', () => goTo(1));

        // ---- Requisitos de contraseña (círculo -> chulito verde) ----
        function updatePwRules() {
            const c = passwordChecks(pass.value);
            document.querySelectorAll('#pwRules li').forEach(li => {
                const ok = c[li.dataset.rule];
                li.classList.toggle('ok', ok);
                li.querySelector('i').className = ok ? 'bi bi-check-circle-fill' : 'bi bi-circle';
            });
        }

        // ---- Validación en vivo ----
        Object.keys(rules).forEach(id => {
            const el = $(id);
            el.addEventListener('blur', () => check(id));
            el.addEventListener('input', () => {
                if (id === 'registerPassword') {
                    updatePwRules();
                    if (confirm.value) check('registerPasswordConfirm');   // re-compara al cambiar la contraseña
                }
                // en vivo solo después de que el campo ya se marcó una vez
                if (el.classList.contains('is-invalid') || el.classList.contains('is-valid') || id === 'registerPassword') check(id);
            });
        });

        terms.addEventListener('change', () => terms.classList.toggle('is-invalid', !terms.checked));

        // Certificado y especialidades: obligatorios solo para adiestradores
        function validateTrainer() {
            if ($('registerRol').value !== 'adiestrador') return true;
            const err = $('certificadoError');
            let msg = '';
            if (!$('registerCertificado').files.length) msg = 'Adjunta tu certificado.';
            else if (!document.querySelector('.especialidad-registro:checked')) msg = 'Elige al menos un servicio.';
            err.textContent = msg;
            err.classList.toggle('d-none', !msg);
            return !msg;
        }

        // ---- Submit: se captura ANTES que main.js ----
        form.addEventListener('submit', function (e) {
            // PASO 1: "Continuar" (o Enter). Nunca se envía al servidor, solo avanza.
            if (step === 1) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (checkAll(STEP1_FIELDS)) goTo(2);
                return;
            }

            // PASO 2: "Completar registro". Se revisa todo; si algo del paso 1 falla, se vuelve a él.
            if (!checkAll(STEP1_FIELDS)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                goTo(1);
                return;
            }
            let ok = checkAll(STEP2_FIELDS);
            if (!terms.checked) { terms.classList.add('is-invalid'); ok = false; }
            if (!validateTrainer()) ok = false;

            if (!ok) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const firstBad = $('regStep2').querySelector('.is-invalid');
                if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // si todo está bien, el evento sigue y main.js hace el envío a la API
        }, true);

        // form.reset() (lo llama main.js al terminar bien): limpia colores, requisitos y vuelve al paso 1
        form.addEventListener('reset', function () {
            setTimeout(() => {
                clearMarks(form);
                updatePwRules();
                $('certificadoWrapper').classList.add('d-none');
                $('certificadoError').classList.add('d-none');
                goTo(1);
            }, 0);
        });

        // Al abrir el modal se parte limpio
        $('registerModal').addEventListener('show.bs.modal', function () {
            ['registerError', 'registerSuccess'].forEach(id => $(id).classList.add('d-none'));
            goTo(1);
        });
    }

    // ----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        if (redirectAfterLogin()) return; 
        renderNavbar();
        initLogin();
        initRegister();
    });
})();