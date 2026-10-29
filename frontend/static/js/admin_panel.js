document.addEventListener('DOMContentLoaded', function () {
    const rol = localStorage.getItem('user_rol');
    const token = localStorage.getItem('access_token');
    const nombre = localStorage.getItem('user_nombre') || 'Admin';

    // Solo el administrador puede ver este panel
    if (rol !== 'administrador') {
        document.getElementById('noAccess').classList.remove('d-none');
        return;
    }
    document.getElementById('adminContent').classList.remove('d-none');
    document.getElementById('adminNombre').textContent = nombre;
    const fotoAdmin = localStorage.getItem('user_foto');
    document.getElementById('adminAvatar').innerHTML = fotoAdmin && fotoAdmin !== 'null'
        ? '<img src="' + fotoAdmin.replace(/"/g, '') + '" alt="">' : nombre.charAt(0).toUpperCase();

    const API = '/api';
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Escapa texto antes de meterlo en HTML (evita que un comentario con <script> se ejecute)
    function esc(t) {
        return String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    const fmt = n => '$' + Math.round(n).toLocaleString('es-CO');

    // Envía una petición y, si el servidor responde con error, lanza un Error con el mensaje en español
    async function enviar(url, metodo, datos) {
        const opciones = { method: metodo, headers };
        if (datos !== undefined) opciones.body = JSON.stringify(datos);
        const r = await fetch(url, opciones);
        let cuerpo = {};
        try { cuerpo = await r.json(); } catch (e) { /* 204 sin cuerpo */ }
        if (!r.ok) {
            // Formatos posibles: {error: "..."}, {detail: "..."} o {campo: ["..."]}
            let msg = cuerpo.error || cuerpo.detail;
            if (!msg) {
                const primero = Object.values(cuerpo)[0];
                msg = Array.isArray(primero) ? primero[0] : null;
            }
            if (r.status === 403) msg = msg || 'No tienes permiso para hacer esto.';
            throw new Error(msg || 'No se pudo completar la acción.');
        }
        return cuerpo;
    }

    // Muestra un mensaje (verde si salió bien, rojo si falló) bajo un formulario
    function aviso(idElemento, texto, ok) {
        const el = document.getElementById(idElemento);
        el.className = 'small mt-2 ' + (ok ? 'text-success' : 'text-danger');
        el.textContent = texto;
    }

    // Sube un archivo (multipart). No se pone Content-Type: el navegador lo calcula solo.
    async function subirImagen(url, archivo) {
        const datos = new FormData();
        datos.append('imagen', archivo);
        const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: datos });
        let cuerpo = {};
        try { cuerpo = await r.json(); } catch (e) { /* sin cuerpo */ }
        if (!r.ok) throw new Error(cuerpo.error || cuerpo.detail || 'No se pudo subir la imagen.');
        return cuerpo;
    }

    // Miniatura para las tablas (si no hay foto, un ícono)
    function miniatura(ruta) {
        return ruta
            ? `<img src="${esc(ruta)}" class="rounded me-2" width="38" height="38" style="object-fit:cover" alt="">`
            : '<span class="d-inline-flex align-items-center justify-content-center rounded bg-light text-muted me-2" style="width:38px;height:38px"><i class="bi bi-image"></i></span>';
    }

    // ============================================
    // Estado compartido del panel
    // ============================================
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const PATA = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="5.5" cy="11" rx="2" ry="2.6"/><ellipse cx="9.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="14.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="18.5" cy="11" rx="2" ry="2.6"/><path d="M12 11c-3 0-5.5 3-5.5 5.7 0 2 1.6 2.8 3 2.8 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.4 0 3-.8 3-2.8C17.5 14 15 11 12 11z"/></svg>';
    const notif = { mensajes: 0, adiestradores: 0, stock: 0, comunidad: 0 };   // lo que muestra la campana
    let usuarios = [];          // todos los usuarios (vienen de /api/community/moderation/usuarios/)
    let pedidosCache = [];
    let solicitudesCache = [];
    let alertaCerrada = false;

    const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

    // "2026-10" a partir de una fecha ISO (hora local; las fechas sin hora se leen tal cual)
    function ymDe(iso) {
        if (!iso) return '';
        if (String(iso).length <= 10) return String(iso).slice(0, 7);
        const d = new Date(iso);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function fechaBonita(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        const dia = d.getDate() + ' ' + MESES_CORTO[d.getMonth()].toLowerCase() + ' ' + d.getFullYear();
        const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        return dia + '<br>' + hora;
    }
    function iniciales(nombreCompleto) {
        const p = String(nombreCompleto || '?').trim().split(/\s+/);
        return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase();
    }
    function avatarUsuario(u, extra) {
        return u.foto
            ? `<span class="ad-av ${extra || ''}"><img src="${esc(u.foto)}" alt=""></span>`
            : `<span class="ad-av ${extra || ''}">${esc(iniciales(u.nombre + ' ' + u.apellido))}</span>`;
    }

    // ============================================
    // Cabecera de cada sección y navegación del menú
    // ============================================
    const SECCIONES = {
        resumen:    { titulo: 'Bienvenido, ' + nombre, sub: 'Panel de administración de EDUCAN', icono: '', pata: true },
        usuarios:   { titulo: 'Usuarios', sub: 'Gestiona los usuarios de EDUCAN.', icono: '<i class="bi bi-people-fill"></i>' },
        pendientes: { titulo: 'Adiestradores', sub: 'Revisa y gestiona las solicitudes de aprobación', icono: '<i class="bi bi-people-fill"></i>' },
        calendario: { titulo: 'Calendario de servicios', sub: 'Visualiza y gestiona los servicios programados de EDUCAN.', icono: '<i class="bi bi-calendar3"></i>' },
        servicios:  { titulo: 'Servicios', sub: 'Gestiona los servicios de EDUCAN.', icono: PATA },
        productos:  { titulo: 'Productos', sub: 'Gestiona los productos de la tienda.', icono: '<i class="bi bi-box-seam-fill"></i>' },
        pedidos:    { titulo: 'Pedidos', sub: 'Gestiona los pedidos realizados en EDUCAN.', icono: '<i class="bi bi-cart-fill"></i>' },
        resenas:    { titulo: 'Reseñas', sub: 'Las reseñas de los clientes y las respuestas de EDUCAN.', icono: '<i class="bi bi-star-fill"></i>' },
        mensajes:   { titulo: 'Mensajes', sub: 'Lo que escriben los visitantes desde la página de Contacto.', icono: '<i class="bi bi-envelope-fill"></i>' },
        comunidad:  { titulo: 'Comunidad', sub: 'Modera lo que se publica en el blog.', icono: '<i class="bi bi-chat-heart-fill"></i>' },
        imagenes:   { titulo: 'Imágenes del sitio', sub: 'Las fotos fijas de las páginas del sitio.', icono: '<i class="bi bi-images"></i>' }
    };

    function pintarCabecera(sec) {
        const s = SECCIONES[sec];
        const migas = sec === 'resumen' ? '' :
            `<nav class="ad-crumbs"><i class="bi bi-house-door"></i> Panel de administración <i class="bi bi-chevron-right"></i> <b>${esc(s.titulo)}</b></nav>`;
        document.getElementById('adTitulo').innerHTML = migas +
            `<h1 class="ad-h1">${s.icono ? `<span class="ad-h1-ico">${s.icono}</span>` : ''}${esc(s.titulo)}${s.pata ? ' ' + PATA : ''}</h1>` +
            `<p class="ad-sub">${esc(s.sub)}</p>`;
    }

    let calendarioIniciado = false; // FullCalendar solo se debe inicializar una vez
    function mostrarSeccion(sec) {
        if (!SECCIONES[sec]) return;
        document.querySelectorAll('.ad-nav-link[data-section]').forEach(l => l.classList.toggle('active', l.dataset.section === sec));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.add('d-none'));
        document.getElementById('section-' + sec).classList.remove('d-none');
        document.querySelector('.ad-main').scrollTop = 0;
        pintarCabecera(sec);

        // El calendario se renderiza solo cuando se entra por primera vez
        if (sec === 'calendario' && !calendarioIniciado) { cargarCalendario(); calendarioIniciado = true; }
        // Estas secciones se recargan cada vez que se abren
        if (sec === 'resumen') cargarResumen();
        if (sec === 'usuarios' || sec === 'pendientes') cargarUsuarios();
        if (sec === 'resenas') cargarResenas();
        if (sec === 'mensajes') cargarMensajes();
        if (sec === 'comunidad') cargarComunidad();
        if (sec === 'pedidos') cargarPedidos();
        if (sec === 'imagenes') cargarImagenesSitio();
    }

    document.querySelectorAll('.ad-nav-link[data-section]').forEach(link => {
        link.addEventListener('click', function (e) { e.preventDefault(); mostrarSeccion(this.dataset.section); });
    });
    // Tarjetas del Resumen y avisos de la campana: llevan a su sección
    document.addEventListener('click', function (e) {
        const ir = e.target.closest('[data-ir]');
        if (ir) { e.preventDefault(); document.querySelectorAll('.ad-dd').forEach(d => d.classList.remove('open')); mostrarSeccion(ir.dataset.ir); }
    });

    // ============================================
    // Menús desplegables: campana y usuario
    // ============================================
    document.querySelectorAll('.ad-dd > button').forEach(b => {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            const caja = this.parentElement;
            const abierto = caja.classList.contains('open');
            document.querySelectorAll('.ad-dd').forEach(d => d.classList.remove('open'));
            if (!abierto) caja.classList.add('open');
        });
    });
    document.addEventListener('click', () => document.querySelectorAll('.ad-dd').forEach(d => d.classList.remove('open')));

    document.getElementById('btnSalir').addEventListener('click', function () {
        ['access_token', 'user_nombre', 'user_rol', 'user_foto'].forEach(k => localStorage.removeItem(k));
        location.href = '/';
    });

    function pintarCampana() {
        const avisos = [
            { n: notif.mensajes, ico: 'bi-envelope-fill', txt: plural(notif.mensajes, 'mensaje sin leer', 'mensajes sin leer'), sec: 'mensajes' },
            { n: notif.adiestradores, ico: 'bi-person-check-fill', txt: plural(notif.adiestradores, 'adiestrador por aprobar', 'adiestradores por aprobar'), sec: 'pendientes' },
            { n: notif.stock, ico: 'bi-exclamation-triangle-fill', txt: plural(notif.stock, 'producto con stock bajo', 'productos con stock bajo'), sec: 'productos' },
            { n: notif.comunidad, ico: 'bi-shield-exclamation', txt: plural(notif.comunidad, 'contenido por revisar en la comunidad', 'contenidos por revisar en la comunidad'), sec: 'comunidad' }
        ].filter(a => a.n > 0);
        document.getElementById('puntoCampana').classList.toggle('d-none', !avisos.length);
        document.getElementById('menuCampana').innerHTML = avisos.length
            ? avisos.map(a => `<button type="button" data-ir="${a.sec}"><i class="bi ${a.ico}"></i>${esc(a.txt)}</button>`).join('')
            : '<div class="ad-vacio"><i class="bi bi-check-circle me-1"></i>Todo al día, no hay novedades.</div>';
    }

    // ============================================
    // Usuarios (lista completa, con buscador, filtros, paginación y botones)
    // ============================================
    const POR_PAGINA = 8;
    let paginaUsuarios = 1;

    async function cargarUsuarios() {
        try {
            usuarios = await enviar(`${API}/community/moderation/usuarios/`, 'GET');
        } catch (err) {
            document.getElementById('usuariosBody').innerHTML =
                '<tr><td colspan="7" class="text-danger">Error: ' + esc(err.message) + '</td></tr>';
            return;
        }
        document.getElementById('statUsuarios').textContent = usuarios.length;
        notif.adiestradores = usuarios.filter(u => u.rol === 'adiestrador' && u.estado_aprobacion === 'pendiente').length;
        pintarCampana();
        pintarUsuarios();
        pintarAdiestradores();
    }

    function pillRol(rol) {
        const clase = rol === 'administrador' ? 'ad-pill-blue' : (rol === 'adiestrador' ? 'ad-pill-amber' : '');
        const texto = rol.charAt(0).toUpperCase() + rol.slice(1);
        return `<span class="ad-pill ${clase}">${esc(texto)}</span>`;
    }
    function pillEstado(u) {
        if (u.estado === 'inactivo') return '<span class="ad-pill ad-pill-red ad-pill-dot" title="' + esc(u.motivo_restriccion) + '">Inactivo</span>';
        if (u.rol === 'adiestrador' && u.estado_aprobacion === 'pendiente') return '<span class="ad-pill ad-pill-grey ad-pill-dot">Pendiente</span>';
        if (u.rol === 'adiestrador' && u.estado_aprobacion === 'rechazado') return '<span class="ad-pill ad-pill-grey ad-pill-dot">Rechazado</span>';
        return '<span class="ad-pill ad-pill-dot">Activo</span>';
    }

    function usuariosFiltrados() {
        const q = document.getElementById('usrBuscar').value.trim().toLowerCase();
        const rolF = document.getElementById('usrRol').value;
        const estF = document.getElementById('usrEstado').value;
        const orden = document.getElementById('usrOrden').value;
        let lista = usuarios.filter(u => {
            if (rolF && u.rol !== rolF) return false;
            if (estF === 'activo' && u.estado !== 'activo') return false;
            if (estF === 'inactivo' && u.estado !== 'inactivo') return false;
            if (!q) return true;
            return (u.nombre + ' ' + u.apellido + ' ' + u.email + ' ' + u.rol).toLowerCase().includes(q);
        });
        if (orden === 'viejos') lista = lista.slice().reverse();
        if (orden === 'nombre') lista = lista.slice().sort((a, b) => (a.nombre + a.apellido).localeCompare(b.nombre + b.apellido, 'es'));
        return lista;
    }

    function pintarUsuarios() {
        const lista = usuariosFiltrados();
        const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
        if (paginaUsuarios > paginas) paginaUsuarios = paginas;
        const ini = (paginaUsuarios - 1) * POR_PAGINA;
        const visibles = lista.slice(ini, ini + POR_PAGINA);

        document.getElementById('usuariosBody').innerHTML = visibles.length ? visibles.map((u, i) => {
            const esAdmin = u.rol === 'administrador';
            const acciones = esAdmin ? '<span class="text-muted small">—</span>' : `
                <div class="ad-acciones">
                    ${u.estado === 'inactivo'
                        ? `<button type="button" class="ad-btn ad-btn-sm ad-btn-line" onclick="cambiarEstadoUsuario(${u.id}, 'reactivar')"><i class="bi bi-person-check"></i>Activar</button>`
                        : `<button type="button" class="ad-btn ad-btn-sm ad-btn-line" onclick="cambiarEstadoUsuario(${u.id}, 'desactivar')"><i class="bi bi-person-slash"></i>Desactivar</button>`}
                    <button type="button" class="ad-btn ad-btn-sm ad-btn-red-o" onclick="eliminarUsuario(${u.id})"><i class="bi bi-trash"></i>Eliminar</button>
                </div>`;
            return `<tr>
                <td>${ini + i + 1}</td>
                <td><div class="ad-persona">${avatarUsuario(u)}<span>${esc(u.nombre)} ${esc(u.apellido)}</span></div></td>
                <td>${esc(u.email)}</td>
                <td>${pillRol(u.rol)}</td>
                <td>${pillEstado(u)}</td>
                <td class="ad-fecha">${fechaBonita(u.creado_en)}</td>
                <td>${acciones}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="7" class="ad-vacio-grande">No hay usuarios que coincidan.</td></tr>';

        document.getElementById('usrConteo').textContent = `Mostrando ${visibles.length} de ${lista.length} usuarios`;
        let botones = `<button type="button" ${paginaUsuarios === 1 ? 'disabled' : ''} data-pag="${paginaUsuarios - 1}"><i class="bi bi-chevron-left"></i></button>`;
        for (let p = 1; p <= paginas; p++) botones += `<button type="button" class="${p === paginaUsuarios ? 'on' : ''}" data-pag="${p}">${p}</button>`;
        botones += `<button type="button" ${paginaUsuarios === paginas ? 'disabled' : ''} data-pag="${paginaUsuarios + 1}"><i class="bi bi-chevron-right"></i></button>`;
        document.getElementById('usrPaginas').innerHTML = botones;
    }

    ['usrBuscar', 'usrRol', 'usrEstado', 'usrOrden'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => { paginaUsuarios = 1; pintarUsuarios(); });
    });
    document.getElementById('usrPaginas').addEventListener('click', function (e) {
        const b = e.target.closest('[data-pag]');
        if (!b || b.disabled) return;
        paginaUsuarios = parseInt(b.dataset.pag, 10);
        pintarUsuarios();
    });

    // Desactivar / Activar una cuenta
    window.cambiarEstadoUsuario = async function (id, accion) {
        if (accion === 'desactivar' && !confirm('¿Desactivar esta cuenta? No podrá iniciar sesión hasta que la actives de nuevo.')) return;
        try {
            const r = await enviar(`${API}/community/moderation/users/${id}/`, 'POST', { accion });
            aviso('usrMsg', r.mensaje, true);
        } catch (err) { aviso('usrMsg', err.message, false); }
        cargarUsuarios();
        actualizarBadgeComunidad();
    };

    // Eliminar una cuenta para siempre
    window.eliminarUsuario = async function (id) {
        const u = usuarios.find(x => x.id === id);
        const nombreU = u ? (u.nombre + ' ' + u.apellido) : 'este usuario';
        if (!confirm('¿Eliminar a ' + nombreU + '? Se borrarán también sus publicaciones, comentarios y pedidos. Esto no se puede deshacer.')) return;
        try {
            const r = await enviar(`${API}/community/moderation/users/${id}/eliminar/`, 'DELETE');
            aviso('usrMsg', r.mensaje, true);
        } catch (err) { aviso('usrMsg', err.message, false); }
        cargarUsuarios();
        actualizarBadgeComunidad();
        cargarResumen();
    };

    // ============================================
    // Adiestradores: aprobar / rechazar
    // ============================================
    let filtroAdiestradores = 'pendiente';

    document.querySelectorAll('#section-pendientes [data-filtro]').forEach(card => {
        card.addEventListener('click', function () {
            filtroAdiestradores = this.dataset.filtro;
            pintarAdiestradores();
        });
    });

    function pintarAdiestradores() {
        const todos = usuarios.filter(u => u.rol === 'adiestrador');
        const por = estado => todos.filter(u => u.estado_aprobacion === estado);
        document.getElementById('adiPend').textContent = por('pendiente').length;
        document.getElementById('adiAprob').textContent = por('aprobado').length;
        document.getElementById('adiRech').textContent = por('rechazado').length;
        document.querySelectorAll('#section-pendientes [data-filtro]').forEach(c => c.classList.toggle('active', c.dataset.filtro === filtroAdiestradores));

        const lista = por(filtroAdiestradores);
        const caja = document.getElementById('adiestradoresLista');
        if (!lista.length) {
            const txt = { pendiente: 'No hay solicitudes pendientes.', aprobado: 'Aún no hay adiestradores aprobados.', rechazado: 'No hay solicitudes rechazadas.' }[filtroAdiestradores];
            caja.innerHTML = `<div class="ad-panel ad-vacio-grande"><i class="bi bi-check-circle fs-3 d-block mb-2 text-success"></i>${txt}</div>`;
            return;
        }
        const titulo = { pendiente: 'Solicitud pendiente', aprobado: 'Adiestrador aprobado', rechazado: 'Solicitud rechazada' }[filtroAdiestradores];
        const pill = { pendiente: '<span class="ad-pill ad-pill-amber"><i class="bi bi-clock"></i>Pendiente de revisión</span>',
                       aprobado: '<span class="ad-pill"><i class="bi bi-check-circle"></i>Aprobado</span>',
                       rechazado: '<span class="ad-pill ad-pill-red"><i class="bi bi-x-circle"></i>Rechazado</span>' }[filtroAdiestradores];
        caja.innerHTML = lista.map(u => {
            const esp = (u.estado_aprobacion === 'aprobado' && u.especialidades.length) ? u.especialidades : u.especialidades_solicitadas;
            return `
            <div class="ad-panel mb-3">
                <div class="ad-panel-head"><h5><i class="bi bi-file-earmark-text-fill"></i>${titulo}</h5>${pill}</div>
                <div class="ad-person">
                    ${avatarUsuario(u, 'ad-av-lg')}
                    <div class="flex-grow-1"><h6>${esc(u.nombre)} ${esc(u.apellido)}</h6><span>${esc(u.email)}</span></div>
                    ${u.certificado ? `<a href="${esc(u.certificado)}" target="_blank" rel="noopener" class="ad-btn ad-btn-line"><i class="bi bi-file-earmark-text"></i>Ver certificado</a>` : '<span class="text-danger small">Sin certificado</span>'}
                </div>
                <h6 class="ad-esp-title"><i class="bi bi-award"></i>Especialidades solicitadas</h6>
                <div class="ad-esp">${(esp || []).map(e => `<span>${esc(e)}</span>`).join('') || '<span>Ninguna seleccionada</span>'}</div>
                <div class="ad-actions">
                    <div class="ad-note"><i class="bi bi-info-circle"></i>Verifica el certificado antes de aprobar la solicitud.</div>
                    ${u.estado_aprobacion !== 'aprobado' ? `<button type="button" class="ad-btn ad-btn-green" onclick="decidirAdiestrador(${u.id}, 'aprobar')"><i class="bi bi-check-lg"></i>Aprobar solicitud</button>` : ''}
                    ${u.estado_aprobacion !== 'rechazado' ? `<button type="button" class="ad-btn ad-btn-red-o" onclick="decidirAdiestrador(${u.id}, 'rechazar')"><i class="bi bi-x-lg"></i>Rechazar</button>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    window.decidirAdiestrador = async function (id, accion) {
        try {
            await enviar(`${API}/users/aprobar/${id}/`, 'POST', { accion });
            aviso('adiMsg', accion === 'aprobar' ? 'Adiestrador aprobado.' : 'Solicitud rechazada.', true);
        } catch (err) { aviso('adiMsg', err.message, false); }
        cargarUsuarios();
    };

    // ============================================
    // Calendario (FullCalendar) — solicitudes aceptadas, coloreadas por duración
    // ============================================
    const COLOR_DURACION = { corto: '#2fb85a', mediano: '#4a9bea', largo: '#f5b800', muy_largo: '#f26d6d' };

    // Alto del calendario: se ajusta a la pantalla
    function altoCalendario() {
        return Math.max(460, window.innerHeight - 300);
    }

    function cargarCalendario() {
        fetch(`${API}/requests/`, { headers }).then(r => r.json()).then(solicitudes => {
            const eventos = solicitudes
                .filter(s => s.estado === 'aceptada')
                .map(s => {
                    const color = COLOR_DURACION[s.duracion] || '#999';
                    return {
                        title: `${s.servicio}`,
                        start: s.fecha_inicio,
                        backgroundColor: color + '33',     // el mismo color, muy suave
                        borderColor: 'transparent',
                        extendedProps: { cliente: s.cliente_nombre, servicio: s.servicio, perro: s.perro_nombre, punto: color }
                    };
                });

            const calendar = new FullCalendar.Calendar(document.getElementById('calendarioServicios'), {
                initialView: 'dayGridMonth',
                locale: 'es',
                firstDay: 0,                  // la semana empieza en domingo
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
                buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
                events: eventos,
                dayMaxEvents: 2,
                eventContent: function (arg) {
                    return { html: `<div class="ad-ev"><i style="background:${esc(arg.event.extendedProps.punto)}"></i>${esc(arg.event.title)}</div>` };
                },
                eventClick: function (info) {
                    const p = info.event.extendedProps;
                    alert(`Servicio: ${p.servicio}\nCliente: ${p.cliente}${p.perro ? '\nPerro: ' + p.perro : ''}`);
                },
                height: altoCalendario()
            });
            calendar.render();
            window.addEventListener('resize', () => calendar.setOption('height', altoCalendario()));
        });
    }

    
    // ============================================
    // Resumen: tarjetas, aviso de stock y gráficas (todo con datos reales)
    // ============================================
    const STOCK_BAJO = 10;   // por debajo de este número se avisa

    // Aviso en el Resumen con los productos que se están acabando
    function pintarAlertaStock(productos) {
        const caja = document.getElementById('alertaStock');
        const bajos = productos.filter(p => p.stock < STOCK_BAJO).sort((a, b) => a.stock - b.stock);
        if (!bajos.length || alertaCerrada) { caja.classList.add('d-none'); caja.innerHTML = ''; return; }
        caja.classList.remove('d-none');
        caja.innerHTML = `
            <div class="ad-alert">
                <span class="ad-alert-ico"><i class="bi bi-exclamation-triangle-fill"></i></span>
                <div class="flex-grow-1">
                    <b>Stock bajo: ${bajos.length} producto${bajos.length > 1 ? 's' : ''} con menos de ${STOCK_BAJO} unidades</b>
                    <ul>${bajos.map(p => `<li>${esc(p.nombre)} — ${p.stock === 0 ? '<b>agotado</b>' : p.stock + ' unidades'}</li>`).join('')}</ul>
                </div>
                <i class="bi bi-box-seam ad-alert-deco"></i>
                <button type="button" class="ad-alert-x" id="cerrarAlerta" title="Cerrar aviso"><i class="bi bi-x-lg"></i></button>
            </div>`;
        document.getElementById('cerrarAlerta').onclick = function () { alertaCerrada = true; caja.classList.add('d-none'); };
    }
    function actualizarStock(productos) {
        notif.stock = productos.filter(p => p.stock < STOCK_BAJO).length;
        pintarCampana();
    }

    // Selector de mes (últimos 12 meses) para las dos gráficas de dona
    (function llenarMeses() {
        const sel = document.getElementById('resMes');
        const hoy = new Date();
        let html = '<option value="todo">Todo el tiempo</option>';
        for (let i = 0; i < 12; i++) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const texto = MESES[d.getMonth()].charAt(0).toUpperCase() + MESES[d.getMonth()].slice(1) + ' ' + d.getFullYear();
            html += `<option value="${ym}">${texto}</option>`;
        }
        sel.innerHTML = html;
    })();
    document.getElementById('resMes').addEventListener('change', pintarGraficas);
    document.getElementById('chMeses').addEventListener('change', pintarGraficas);

    async function cargarResumen() {
        try { const p = await enviar(`${API}/orders/`, 'GET'); if (Array.isArray(p)) pedidosCache = p; } catch (err) { /* se queda con lo anterior */ }
        try { const s = await enviar(`${API}/requests/`, 'GET'); if (Array.isArray(s)) solicitudesCache = s; } catch (err) { /* idem */ }
        document.getElementById('statPedidos').textContent = pedidosCache.length;
        pintarGraficas();
    }

    // Techo "redondo" para el eje de las barras (4 intervalos)
    function techoBarras(max) {
        const paso = Math.max(1, max / 4);
        const base = Math.pow(10, Math.floor(Math.log10(paso)));
        const bonito = [1, 2, 3, 4, 5, 6, 8, 10].map(m => m * base).find(v => v >= paso);
        return bonito * 4;
    }

    function pintarBarras() {
        const n = parseInt(document.getElementById('chMeses').value, 10);
        const hoy = new Date();
        const meses = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            meses.push({ ym: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), corto: MESES_CORTO[d.getMonth()], total: 0 });
        }
        pedidosCache.filter(p => p.estado !== 'cancelado').forEach(p => {
            const m = meses.find(x => x.ym === ymDe(p.creado_en));
            if (m) m.total += p.items.reduce((s, i) => s + i.cantidad, 0);
        });
        const techo = techoBarras(Math.max(...meses.map(m => m.total), 1));
        let rejilla = '';
        for (let i = 0; i <= 4; i++) rejilla += `<div class="ad-grid" style="bottom:${i * 25}%"><span>${techo * i / 4}</span></div>`;
        const barras = meses.map((m, i) =>
            `<div class="ad-bar ${i === meses.length - 1 ? 'last' : ''}" style="height:${m.total / techo * 100}%">${m.total ? `<b>${m.total}</b>` : ''}</div>`).join('');
        document.getElementById('chVentas').innerHTML =
            `<div class="ad-bars">${rejilla}${barras}</div><div class="ad-meses">${meses.map(m => `<span>${m.corto}</span>`).join('')}</div>`;
    }

    // Gráfica de dona hecha con un degradado cónico (sin librerías)
    function pintarDona(idCaja, segmentos, etiqueta) {
        const total = segmentos.reduce((a, s) => a + s.n, 0);
        let acum = 0;
        const degradado = total
            ? segmentos.filter(s => s.n > 0).map(s => { const ini = acum / total * 100; acum += s.n; return `${s.color} ${ini}% ${acum / total * 100}%`; }).join(',')
            : '#ece8dd 0% 100%';
        document.getElementById(idCaja).innerHTML = `
            <div class="ad-dona-wrap"><div class="ad-dona" style="background:conic-gradient(${degradado})">
                <div class="ad-dona-centro"><b>${total}</b><span>${etiqueta}</span></div></div></div>
            ${segmentos.map(s => `<div class="ad-leg"><i style="background:${s.color}"></i><span>${s.nombre}</span><b>${s.n}</b><small>${total ? Math.round(s.n / total * 100) + '%' : '0%'}</small></div>`).join('')}`;
    }

    function pintarGraficas() {
        pintarBarras();
        const mes = document.getElementById('resMes').value;
        const enMes = fecha => mes === 'todo' || ymDe(fecha) === mes;

        // Servicios por estado (según las solicitudes de servicio)
        const ss = { term: 0, proc: 0, canc: 0, otros: 0 };
        solicitudesCache.filter(s => enMes(s.fecha_inicio)).forEach(s => {
            const e = String(s.estado || '').toLowerCase();
            if (e.includes('complet') || e.includes('termin')) ss.term++;
            else if (e.includes('acept') || e.includes('proceso')) ss.proc++;
            else if (e.includes('cancel') || e.includes('rechaz')) ss.canc++;
            else ss.otros++;
        });
        pintarDona('chServicios', [
            { nombre: 'Terminados', n: ss.term, color: '#6d8b45' }, { nombre: 'En proceso', n: ss.proc, color: '#e3c98c' },
            { nombre: 'Cancelados', n: ss.canc, color: '#8fb3d9' }, { nombre: 'Otros', n: ss.otros, color: '#d8656b' }], 'Servicios');

        // Pedidos por estado
        const cuenta = estado => pedidosCache.filter(p => p.estado === estado && enMes(p.creado_en)).length;
        pintarDona('chPedidos', [
            { nombre: 'Pendiente', n: cuenta('pendiente'), color: '#f3d58a' }, { nombre: 'Confirmado', n: cuenta('confirmado'), color: '#6d8b45' },
            { nombre: 'Enviado', n: cuenta('enviado'), color: '#8fb3d9' }, { nombre: 'Entregado', n: cuenta('entregado'), color: '#b9cba5' },
            { nombre: 'Cancelado', n: cuenta('cancelado'), color: '#d8656b' }], 'Pedidos');
    }

    // Mensajes sin leer (para la campana)
    async function contarMensajes() {
        try {
            const lista = await enviar(`${API}/contact/`, 'GET');
            notif.mensajes = Array.isArray(lista) ? lista.filter(m => !m.leido).length : 0;
            pintarCampana();
        } catch (err) { /* sin aviso si falla */ }
    }


    // ============================================
    // Servicios: listar, crear, editar, eliminar (con foto)
    // ============================================
    let serviciosCache = {};   // guarda los servicios en memoria para editarlos sin meter datos en el HTML

    function cargarServicios() {
        fetch(`${API}/services/`).then(r => r.json()).then(servicios => {
            serviciosCache = {};
            servicios.forEach(s => { serviciosCache[s.id] = s; });
            document.getElementById('statServicios').textContent = servicios.length;
            document.getElementById('serviciosBody').innerHTML = servicios.map(s =>
                `<tr>
                    <td>${miniatura(s.imagen)}${esc(s.nombre)}</td>
                    <td>$${formatearPrecioCOP(s.precio)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="editarServicio('${s.id}')">Editar</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarServicio('${s.id}')">Eliminar</button>
                    </td>
                </tr>`
            ).join('');
        });
    }
    cargarServicios();

    function limpiarServicio() {
        document.getElementById('servicioForm').reset();
        document.getElementById('servId').value = '';
        document.getElementById('servSubmitBtn').textContent = 'Agregar';
        document.getElementById('servCancelBtn').classList.add('d-none');
    }
    document.getElementById('servCancelBtn').onclick = limpiarServicio;

    window.editarServicio = function (id) {
        const servicio = serviciosCache[id];
        if (!servicio) return;
        document.getElementById('servId').value = servicio.id;
        document.getElementById('servNombre').value = servicio.nombre;
        document.getElementById('servDescripcion').value = servicio.descripcion;
        document.getElementById('servPrecio').value = servicio.precio;
        document.getElementById('servSubmitBtn').textContent = 'Guardar cambios';
        document.getElementById('servCancelBtn').classList.remove('d-none');
        aviso('servMsg', 'Editando "' + servicio.nombre + '". Si eliges una foto, reemplaza la anterior.', true);
    };

    document.getElementById('servicioForm').onsubmit = async function (e) {
        e.preventDefault();
        const id = document.getElementById('servId').value;
        const archivo = document.getElementById('servImagen').files[0];
        const datos = {
            nombre: document.getElementById('servNombre').value,
            descripcion: document.getElementById('servDescripcion').value,
            precio: parseFloat(document.getElementById('servPrecio').value)
        };
        try {
            const res = await enviar(id ? `${API}/services/${id}/` : `${API}/services/`, id ? 'PUT' : 'POST', datos);
            let idServicio = id || res.id;
            if (!idServicio) {          // por si la respuesta de crear no trae el id: se busca por nombre
                const lista = await (await fetch(`${API}/services/`)).json();
                const creado = lista.find(s => s.nombre === datos.nombre);
                idServicio = creado ? creado.id : null;
            }
            let texto = id ? 'Servicio actualizado.' : 'Servicio creado.';
            if (archivo && idServicio) {
                try { await subirImagen(`${API}/services/${idServicio}/imagen/`, archivo); texto += ' Foto guardada.'; }
                catch (errImg) { texto += ' Pero la foto no se pudo subir: ' + errImg.message; }
            }
            aviso('servMsg', texto, true);
            limpiarServicio();
            cargarServicios();
        } catch (err) {
            aviso('servMsg', err.message, false);
        }
    };

    window.eliminarServicio = async function (id) {
        try {
            await enviar(`${API}/services/${id}/`, 'DELETE');
            aviso('servMsg', 'Servicio eliminado.', true);
            cargarServicios();
        } catch (err) {
            aviso('servMsg', err.message, false);
        }
    };

    
    // ============================================
    // Productos: listar, crear, editar, eliminar, reponer stock (con foto)
    // ============================================

    function insigniaStock(n) {
        const clase = n === 0 ? 'bg-danger' : (n < STOCK_BAJO ? 'bg-warning text-dark' : 'bg-success');
        return `<span class="badge ${clase}">${n === 0 ? 'Agotado' : n}</span>`;
    }


    let productosCache = {};   // igual que arriba: los productos se guardan en memoria

    function cargarProductos() {
        fetch(`${API}/products/`).then(r => r.json()).then(productos => {
            productosCache = {};
            productos.forEach(p => { productosCache[p.id] = p; });
            document.getElementById('statProductos').textContent = productos.length;
            pintarAlertaStock(productos);
            actualizarStock(productos);
            document.getElementById('productosBody').innerHTML = productos.map(p =>
                `<tr>
                    <td>${miniatura(p.imagen)}${esc(p.nombre)}</td>
                    <td>${insigniaStock(p.stock)}</td>
                    <td>$${formatearPrecioCOP(p.precio)}</td>
                    <td>
                        <div class="input-group input-group-sm" style="width:125px">
                            <input type="number" min="1" class="form-control" id="add-${p.id}" placeholder="+ uds">
                            <button class="btn btn-outline-secondary" onclick="reponerStock('${p.id}')">Reponer</button>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="editarProducto('${p.id}')">Editar</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto('${p.id}')">Eliminar</button>
                    </td>
                </tr>`
            ).join('');
        });
    }
    cargarProductos();

    function limpiarProducto() {
        document.getElementById('productoForm').reset();
        document.getElementById('prodId').value = '';
        document.getElementById('prodSubmitBtn').textContent = 'Agregar';
        document.getElementById('prodCancelBtn').classList.add('d-none');
        document.getElementById('prodStockCol').classList.remove('d-none');
    }
    document.getElementById('prodCancelBtn').onclick = limpiarProducto;

    window.editarProducto = function (id) {
        const producto = productosCache[id];
        if (!producto) return;
        document.getElementById('prodId').value = producto.id;
        document.getElementById('prodNombre').value = producto.nombre;
        document.getElementById('prodCategoria').value = producto.categoria;
        document.getElementById('prodDescripcion').value = producto.descripcion;
        document.getElementById('prodPrecio').value = producto.precio;
        document.getElementById('prodStockCol').classList.add('d-none');   // al editar no se toca el stock
        document.getElementById('prodSubmitBtn').textContent = 'Guardar cambios';
        document.getElementById('prodCancelBtn').classList.remove('d-none');
        aviso('prodMsg', 'Editando "' + producto.nombre + '". Si eliges una foto, reemplaza la anterior.', true);
    };

    document.getElementById('productoForm').onsubmit = async function (e) {
        e.preventDefault();
        const id = document.getElementById('prodId').value;
        const archivo = document.getElementById('prodImagen').files[0];
        const datos = {
            nombre: document.getElementById('prodNombre').value,
            categoria: document.getElementById('prodCategoria').value,
            descripcion: document.getElementById('prodDescripcion').value,
            precio: parseFloat(document.getElementById('prodPrecio').value)
        };
        if (!id) {      // el stock inicial solo se pide al crear
            const stockInicial = document.getElementById('prodStock').value;
            if (stockInicial === '') { aviso('prodMsg', 'Escribe el stock inicial del producto.', false); return; }
            datos.stock = parseInt(stockInicial, 10);
        }
        try {
            const res = await enviar(id ? `${API}/products/${id}/` : `${API}/products/`, id ? 'PUT' : 'POST', datos);
            const idProducto = id || res.id;
            let texto = id ? 'Producto actualizado.' : 'Producto creado.';
            if (archivo && idProducto) {
                try { await subirImagen(`${API}/products/${idProducto}/imagen/`, archivo); texto += ' Foto guardada.'; }
                catch (errImg) { texto += ' Pero la foto no se pudo subir: ' + errImg.message; }
            }
            aviso('prodMsg', texto, true);
            limpiarProducto();
            cargarProductos();
        } catch (err) {
            aviso('prodMsg', err.message, false);
        }
    };

    window.reponerStock = async function (id) {
        const campo = document.getElementById('add-' + id);
        const cantidad = parseInt(campo.value, 10);
        if (!cantidad || cantidad < 1) { aviso('prodMsg', 'Escribe cuántas unidades entraron.', false); return; }
        try {
            const res = await enviar(`${API}/products/${id}/stock/`, 'POST', { cantidad });
            aviso('prodMsg', `${res.mensaje} Ahora hay ${res.stock}.`, true);
            cargarProductos();
        } catch (err) {
            aviso('prodMsg', err.message, false);
        }
    };

    window.eliminarProducto = async function (id) {
        try {
            await enviar(`${API}/products/${id}/`, 'DELETE');
            aviso('prodMsg', 'Producto eliminado.', true);
            cargarProductos();
        } catch (err) {
            aviso('prodMsg', err.message, false);
        }
    };

    // ============================================
    // Pedidos de la tienda: ver y cambiar estado
    // ============================================
    const ESTADOS_PEDIDO = [
        ['pendiente', 'Pendiente'], ['confirmado', 'Confirmado'], ['enviado', 'Enviado'],
        ['entregado', 'Entregado'], ['cancelado', 'Cancelado']
    ];

    function cargarPedidos() {
        fetch(`${API}/orders/`, { headers }).then(r => r.json()).then(lista => {
            const cont = document.getElementById('pedidosContainer');
            if (!Array.isArray(lista) || !lista.length) {
                cont.innerHTML = '<p class="text-muted mb-0">Aún no hay pedidos.</p>';
                return;
            }
            cont.innerHTML = lista.map(p => `
                <div class="border rounded-3 p-3 mb-3 ${p.estado === 'cancelado' ? 'bg-light' : ''}">
                    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                        <div>
                            <strong>Pedido #${p.id}</strong>
                            <span class="text-muted small ms-2">${esc(new Date(p.creado_en).toLocaleString('es-CO'))}</span>
                            <div class="small">${esc(p.cliente_nombre)} · ${esc(p.cliente_email)}</div>
                        </div>
                        <strong>${fmt(p.total)}</strong>
                    </div>
                    ${p.items.map(i => `<div class="d-flex justify-content-between small"><span>${i.cantidad} × ${esc(i.nombre)}</span><span>${fmt(i.subtotal)}</span></div>`).join('')}
                    <p class="text-muted small mt-2 mb-2"><i class="bi bi-geo-alt me-1"></i>${esc(p.direccion)}, ${esc(p.ciudad)} · ${esc(p.telefono)}${p.notas ? '<br><em>' + esc(p.notas) + '</em>' : ''}</p>
                    <div class="d-flex gap-2 align-items-center">
                        <select class="form-select form-select-sm" style="width:auto" id="estado-${p.id}" ${p.estado === 'cancelado' ? 'disabled' : ''}>
                            ${ESTADOS_PEDIDO.map(([v, t]) => `<option value="${v}" ${v === p.estado ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        ${p.estado === 'cancelado' ? '<span class="small text-muted">Cancelado (el stock ya volvió al inventario)</span>'
                            : `<button class="btn btn-sm btn-olive" onclick="guardarEstadoPedido(${p.id})">Guardar estado</button>`}
                    </div>
                    <div id="pedMsg-${p.id}" class="small mt-1"></div>
                </div>`).join('');
        });
    }

    window.guardarEstadoPedido = async function (id) {
        const estado = document.getElementById('estado-' + id).value;
        try {
            await enviar(`${API}/orders/${id}/`, 'PATCH', { estado });
            cargarPedidos();
            cargarProductos();     // si se canceló, el stock cambió
            cargarResumen();
        } catch (err) {
            const msg = document.getElementById('pedMsg-' + id);
            msg.className = 'small mt-1 text-danger';
            msg.textContent = err.message;
        }
    };

    // ============================================
    // Reseñas: ver las calificaciones y responderlas
    // ============================================
    function estrellasHTML(n) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<i class="bi ${i <= n ? 'bi-star-fill' : 'bi-star'}" style="color:#e0a526"></i>`;
        }
        return html;
    }

    // "Nombre + insignia" de quien escribió la respuesta
    function quienRespondio(r) {
        const esAdiestrador = r.respondido_por_rol === 'adiestrador';
        return `<strong>${esc(r.respondido_por_nombre)}</strong>
                <span class="badge ms-1 ${esAdiestrador ? 'bg-olive text-white' : 'bg-dark'}">${esAdiestrador ? 'Adiestrador' : 'Administrador'}</span>`;
    }

    function tarjetaResena(r) {
        const respondida = !!r.respuesta_admin;
        return `
            <div class="border rounded-3 p-3 mb-3 ${respondida ? 'bg-light' : ''}">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <div>
                        <strong>${esc(r.cliente_nombre)}</strong>
                        <span class="text-muted small ms-2">${esc(r.servicio)}</span>
                    </div>
                    <div>${estrellasHTML(r.estrellas)}</div>
                </div>
                <p class="mb-2">${esc(r.comentario) || '<span class="text-muted">Sin comentario.</span>'}</p>
                ${respondida ? `<div class="small text-success mb-1"><i class="bi bi-check-circle-fill me-1"></i>Respondida por ${quienRespondio(r)}</div>` : ''}
                <div class="d-flex gap-2">
                    <input class="form-control form-control-sm" id="resp-${r.id}" maxlength="500"
                           placeholder="Escribe una respuesta pública" value="${esc(r.respuesta_admin)}"
                           ${respondida ? 'disabled' : ''}>
                    <button class="btn btn-sm ${respondida ? 'btn-outline-secondary' : 'btn-olive'}" id="btn-${r.id}"
                            onclick="accionResena(${r.id})">${respondida ? 'Editar' : 'Responder'}</button>
                </div>
                <div id="respMsg-${r.id}" class="small mt-1"></div>
            </div>`;
    }

    function cargarResenas() {
        fetch(`${API}/reviews/`, { headers }).then(r => r.json()).then(resenas => {
            document.getElementById('resenasContainer').innerHTML = resenas.length
                ? resenas.map(tarjetaResena).join('')
                : '<p class="text-muted mb-0">Aún no hay reseñas.</p>';
        });
    }

    // Un solo botón: si la casilla está bloqueada (ya respondida) la habilita para editar; si no, guarda.
    window.accionResena = async function (id) {
        const input = document.getElementById('resp-' + id);
        const boton = document.getElementById('btn-' + id);
        const msg = document.getElementById('respMsg-' + id);

        if (input.disabled) {
            input.disabled = false;
            input.focus();
            boton.textContent = 'Guardar';
            boton.className = 'btn btn-sm btn-olive';
            return;
        }
        try {
            await enviar(`${API}/reviews/${id}/responder/`, 'POST', { respuesta: input.value.trim() });
            cargarResenas();   // se vuelve a dibujar: casilla gris + "Respondida por ..."
        } catch (err) {
            msg.className = 'small mt-1 text-danger';
            msg.textContent = err.message;
        }
    };

    // ============================================
    // Mensajes de contacto
    // ============================================
    function cargarMensajes() {
        fetch(`${API}/contact/`, { headers }).then(r => r.json()).then(lista => {
            const contenedor = document.getElementById('mensajesContainer');
            if (!Array.isArray(lista) || !lista.length) {
                contenedor.innerHTML = '<p class="text-muted mb-0">Aún no hay mensajes.</p>';
                return;
            }
            contenedor.innerHTML = lista.map(m => `
                <div class="border rounded-3 p-3 mb-3 ${m.leido ? 'bg-light' : ''}">
                    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
                        <div>
                            <strong>${esc(m.nombre)}</strong>
                            <span class="text-muted small ms-2">${esc(m.email)}${m.telefono ? ' · ' + esc(m.telefono) : ''}</span>
                        </div>
                        <div>
                            <span class="badge bg-secondary">${esc(m.motivo_texto)}</span>
                            ${m.leido ? '' : '<span class="badge bg-danger ms-1">Nuevo</span>'}
                        </div>
                    </div>
                    <p class="mb-2">${esc(m.mensaje)}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted small">${esc(new Date(m.creado_en).toLocaleString('es-CO'))}</span>
                        ${m.leido
                            ? '<span class="small text-success"><i class="bi bi-check-circle-fill me-1"></i>Leído</span>'
                            : `<button class="btn btn-sm btn-olive" onclick="marcarLeido(${m.id})">Marcar como leído</button>`}
                    </div>
                </div>`).join('');
        });
    }

    window.marcarLeido = async function (id) {
        try {
            await enviar(`${API}/contact/${id}/leido/`, 'POST');
            cargarMensajes();
            contarMensajes();
        } catch (err) { /* si falla, la lista queda como estaba */ }
    };

    
    // ============================================
    // Comunidad: moderación del blog
    // ============================================
    // Número rojo en el menú con lo que está esperando revisión
    async function actualizarBadgeComunidad() {
        try {
            const r = await enviar(`${API}/community/moderation/resumen/`, 'GET');
            const badge = document.getElementById('badgeComunidad');
            badge.textContent = r.pendientes;
            badge.classList.toggle('d-none', !r.pendientes);
            notif.comunidad = r.pendientes; pintarCampana();
        } catch (err) { /* sin aviso si falla */ }
    }

    function hastaTexto(iso) {
        return iso ? 'Hasta el ' + new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                   : 'Sin fecha de fin (hasta que la reactives)';
    }

    async function cargarComunidad() {
        let d;
        try {
            d = await enviar(`${API}/community/moderation/`, 'GET');
        } catch (err) {
            aviso('comMensaje', err.message, false);
            return;
        }
        const badge = document.getElementById('badgeComunidad');
        badge.textContent = d.pendientes;
        badge.classList.toggle('d-none', !d.pendientes);
        notif.comunidad = d.pendientes; pintarCampana();

        // ---- Por revisar ----
        const bloque = (tipo, etiqueta, x, contexto) => `
            <div class="border border-danger-subtle rounded-3 p-3 mb-2 bg-danger-subtle bg-opacity-25">
                <div class="d-flex justify-content-between flex-wrap gap-2 mb-1">
                    <div>
                        <span class="badge bg-secondary me-1">${etiqueta}</span>
                        <strong>${esc(x.autor.nombre)}</strong>
                        <span class="text-muted small ms-1">${esc(x.autor.email)} · ${esc(new Date(x.creado_en).toLocaleString('es-CO'))}</span>
                    </div>
                    <span class="badge bg-danger">Palabra detectada: ${esc(x.palabra)}</span>
                </div>
                <p class="mb-1">${esc(x.texto)}</p>
                ${contexto ? `<p class="text-muted small mb-2">En la publicación: "${esc(contexto)}..."</p>` : ''}
                <button class="btn btn-sm btn-olive me-1" onclick="moderarContenido('${tipo}', ${x.id}, 'restaurar')">Restaurar (no es ofensivo)</button>
                <button class="btn btn-sm btn-outline-danger me-1" onclick="moderarContenido('${tipo}', ${x.id}, 'eliminar')">Eliminar</button>
                <button class="btn btn-sm btn-outline-dark" onclick="moderarUsuario(${x.autor.id}, 'desactivar')">Desactivar cuenta</button>
            </div>`;
        const pendientes = d.comentarios_bloqueados.map(c => bloque('comments', 'Comentario', c, c.publicacion))
            .concat(d.publicaciones_bloqueadas.map(p => bloque('posts', 'Publicación', p, '')));
        document.getElementById('comPorRevisar').innerHTML = pendientes.join('')
            || '<p class="text-muted mb-0"><i class="bi bi-check-circle text-success me-1"></i>No hay nada por revisar.</p>';

        // ---- Cuentas suspendidas ----
        document.getElementById('comRestricciones').innerHTML = d.restricciones.map(r => `
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 border rounded-3 p-3 mb-2">
                <div>
                    <strong>${esc(r.usuario.nombre)}</strong> <span class="text-muted small">${esc(r.usuario.email)}</span>
                    <div class="small ${r.activa ? 'text-danger' : 'text-muted'}">${esc(r.motivo)} · ${esc(hastaTexto(r.hasta))}${r.activa ? '' : ' (ya venció)'}</div>
                </div>
                <button class="btn btn-sm btn-outline-success" onclick="moderarUsuario(${r.usuario.id}, 'reactivar')">Reactivar cuenta</button>
            </div>`).join('') || '<p class="text-muted mb-0">No hay cuentas suspendidas.</p>';

        // ---- Recientes ----
        const filaPub = p => `
            <div class="d-flex justify-content-between align-items-start gap-2 border rounded-3 p-2 mb-2">
                <div class="d-flex gap-2">
                    ${miniatura(p.imagen)}
                    <div><span class="badge bg-secondary me-1">Publicación</span><strong class="small">${esc(p.autor.nombre)}</strong>
                        <div class="small">${esc(p.texto)}</div></div>
                </div>
                <div class="text-nowrap">
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarContenidoComunidad('posts', ${p.id})">Eliminar</button>
                    <button class="btn btn-sm btn-outline-dark" onclick="moderarUsuario(${p.autor.id}, 'desactivar')">Desactivar cuenta</button>
                </div>
            </div>`;
        const filaCom = c => `
            <div class="d-flex justify-content-between align-items-start gap-2 border rounded-3 p-2 mb-2">
                <div><span class="badge bg-light text-dark border me-1">Comentario</span><strong class="small">${esc(c.autor.nombre)}</strong>
                    <div class="small">${esc(c.texto)}</div></div>
                <div class="text-nowrap">
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarContenidoComunidad('comments', ${c.id})">Eliminar</button>
                    <button class="btn btn-sm btn-outline-dark" onclick="moderarUsuario(${c.autor.id}, 'desactivar')">Desactivar cuenta</button>
                </div>
            </div>`;
        document.getElementById('comRecientes').innerHTML =
            d.recientes_publicaciones.map(filaPub).join('') + d.recientes_comentarios.map(filaCom).join('')
            || '<p class="text-muted mb-0">Aún no hay publicaciones.</p>';
    }

    // Restaurar o eliminar un comentario / publicación bloqueado
    window.moderarContenido = async function (tipo, id, accion) {
        if (accion === 'eliminar' && !confirm('¿Confirmas que es inapropiado? Quedará eliminado y la suspensión de la cuenta sigue.')) return;
        try {
            const r = await enviar(`${API}/community/moderation/${tipo}/${id}/`, 'POST', { accion });
            aviso('comMensaje', r.mensaje, true);
        } catch (err) { aviso('comMensaje', err.message, false); }
        cargarComunidad();
    };

    // Desactivar o reactivar una cuenta
    window.moderarUsuario = async function (id, accion) {
        if (accion === 'desactivar' && !confirm('¿Desactivar esta cuenta? No podrá iniciar sesión hasta que la reactives.')) return;
        try {
            const r = await enviar(`${API}/community/moderation/users/${id}/`, 'POST', { accion });
            aviso('comMensaje', r.mensaje, true);
        } catch (err) { aviso('comMensaje', err.message, false); }
        cargarComunidad();
    };

    // Borrar una publicación o un comentario ya publicado
    window.borrarContenidoComunidad = async function (tipo, id) {
        if (!confirm('¿Eliminar esto de la comunidad?')) return;
        try {
            const r = await enviar(`${API}/community/${tipo}/${id}/`, 'DELETE');
            aviso('comMensaje', r.mensaje, true);
        } catch (err) { aviso('comMensaje', err.message, false); }
        cargarComunidad();
    };

    // ============================================
    // Imágenes del sitio: banner de la tienda, Nosotros y galería del inicio
    // ============================================
    function cargarImagenesSitio() {
        fetch(`${API}/site-images/`, { headers }).then(r => r.json()).then(lista => {
            document.getElementById('imagenesContainer').innerHTML = lista.map(i => `
                <div class="d-flex flex-wrap align-items-center gap-3 border rounded-3 p-3 mb-2">
                    ${i.imagen
                        ? `<img src="${esc(i.imagen)}" width="90" height="64" class="rounded" style="object-fit:cover" alt="">`
                        : '<span class="d-inline-flex align-items-center justify-content-center rounded bg-light text-muted" style="width:90px;height:64px"><i class="bi bi-image fs-4"></i></span>'}
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${esc(i.descripcion)}</div>
                        <div class="small ${i.imagen ? 'text-success' : 'text-muted'}">${i.imagen ? 'Foto subida' : 'Sin foto todavía'}</div>
                        <div id="imgMsg-${i.clave}" class="small text-danger"></div>
                    </div>
                    <input type="file" class="form-control form-control-sm" style="max-width:240px" accept="image/png,image/jpeg,image/webp" id="imgFile-${i.clave}">
                    <button class="btn btn-sm btn-olive" onclick="subirImagenSitio('${i.clave}')">Subir</button>
                    ${i.imagen ? `<button class="btn btn-sm btn-outline-danger" onclick="quitarImagenSitio('${i.clave}')">Quitar</button>` : ''}
                </div>`).join('');
        });
    }

    window.subirImagenSitio = async function (clave) {
        const archivo = document.getElementById('imgFile-' + clave).files[0];
        const msg = document.getElementById('imgMsg-' + clave);
        if (!archivo) { msg.textContent = 'Elige una imagen primero.'; return; }
        try {
            await subirImagen(`${API}/site-images/${clave}/`, archivo);
            cargarImagenesSitio();
        } catch (err) { msg.textContent = err.message; }
    };

    window.quitarImagenSitio = async function (clave) {
        try {
            await enviar(`${API}/site-images/${clave}/`, 'DELETE');
            cargarImagenesSitio();
        } catch (err) {
            document.getElementById('imgMsg-' + clave).textContent = err.message;
        }
    };

    // ============================================
    // Arranque
    // ============================================
    pintarCampana();
    cargarUsuarios();
    contarMensajes();
    actualizarBadgeComunidad();
    cargarServicios();
    cargarProductos();
    mostrarSeccion('resumen');
});