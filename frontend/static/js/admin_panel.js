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
            if (r.status === 403) msg = msg || 'No tienes permiso para hacer esto.';;
            if (r.status === 401) msg = 'Tu sesión venció. Cierra sesión y vuelve a entrar.';
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
    // Un solo "escuchador" para todo: abre el menú que se tocó y cierra los demás (o todos si se toca afuera).
    // La marca _adDd evita que se procese dos veces si por error el script llegara a cargarse dos veces.
    document.addEventListener('click', function (e) {
        if (e._adDd) return;
        e._adDd = true;
        const b = e.target.closest('.ad-dd > button');
        const abierto = !!b && b.parentElement.classList.contains('open');
        document.querySelectorAll('.ad-dd').forEach(d => d.classList.remove('open'));
        if (b && !abierto) b.parentElement.classList.add('open');
    });

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
    // Ayudas para las secciones (miniaturas, tiempo, botones)
    // ============================================
    // La huella de la patita (sin el <svg> de afuera) para dibujarla dentro de otras ilustraciones
    const PATA_DIBUJO = '<ellipse cx="5.5" cy="11" rx="2" ry="2.6"/><ellipse cx="9.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="14.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="18.5" cy="11" rx="2" ry="2.6"/><path d="M12 11c-3 0-5.5 3-5.5 5.7 0 2 1.6 2.8 3 2.8 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.4 0 3-.8 3-2.8C17.5 14 15 11 12 11z"/>';

    // Foto pequeña para las tablas (si no hay foto, un ícono gris)
    function thumb(ruta) {
        return ruta
            ? `<img class="ad-thumb" src="${esc(ruta)}" alt="">`
            : '<span class="ad-thumb ad-thumb-ph"><i class="bi bi-image"></i></span>';
    }

    // "hace 2 horas", "hace 3 días"...
    function hace(iso) {
        if (!iso) return '';
        const seg = (Date.now() - new Date(iso).getTime()) / 1000;
        if (isNaN(seg)) return '';
        if (seg < 60) return 'hace un momento';
        const min = Math.floor(seg / 60);
        if (min < 60) return 'hace ' + plural(min, 'minuto', 'minutos');
        const h = Math.floor(min / 60);
        if (h < 24) return 'hace ' + plural(h, 'hora', 'horas');
        const d = Math.floor(h / 24);
        if (d < 30) return 'hace ' + plural(d, 'día', 'días');
        const m = Math.floor(d / 30);
        if (m < 12) return 'hace ' + plural(m, 'mes', 'meses');
        return 'hace ' + plural(Math.floor(m / 12), 'año', 'años');
    }

    // Círculo con las iniciales de una persona
    function avatarIni(nombreCompleto, extra) {
        return `<span class="ad-av ${extra || ''}">${esc(iniciales(nombreCompleto))}</span>`;
    }

    // Cambia el texto de un botón sin perder su ícono
    function ponerBoton(id, icono, texto) {
        document.getElementById(id).innerHTML = `<i class="bi ${icono}"></i>${texto}`;
    }

    // Botones de la tabla (Editar / Eliminar)
    const btnEditar = fn => `<button type="button" class="ad-btn ad-btn-sm ad-btn-line" onclick="${fn}"><i class="bi bi-pencil"></i>Editar</button>`;
    const btnEliminar = fn => `<button type="button" class="ad-btn ad-btn-sm ad-btn-soft" onclick="${fn}"><i class="bi bi-trash"></i>Eliminar</button>`;

    // ============================================
    // Servicios: listar, crear, editar, eliminar (con foto)
    // ============================================
    let serviciosCache = {};   // guarda los servicios en memoria para editarlos sin meter datos en el HTML

    function cargarServicios() {
        fetch(`${API}/services/`).then(r => r.json()).then(servicios => {
            serviciosCache = {};
            servicios.forEach(s => { serviciosCache[s.id] = s; });
            document.getElementById('statServicios').textContent = servicios.length;
            document.getElementById('serviciosBody').innerHTML = servicios.length ? servicios.map((s, i) =>
                `<tr>
                    <td>${i + 1}</td>
                    <td><div class="ad-prod">${thumb(s.imagen)}<span>${esc(s.nombre)}</span></div></td>
                    <td>$${formatearPrecioCOP(s.precio)}</td>
                    <td><div class="ad-acciones">${btnEditar(`editarServicio('${s.id}')`)}${btnEliminar(`eliminarServicio('${s.id}')`)}</div></td>
                </tr>`
            ).join('') : '<tr><td colspan="4" class="ad-vacio-grande">Aún no hay servicios.</td></tr>';
        });
    }
    cargarServicios();

    function limpiarServicio() {
        document.getElementById('servicioForm').reset();
        document.getElementById('servId').value = '';
        ponerBoton('servSubmitBtn', 'bi-plus-circle', 'Agregar');
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
        ponerBoton('servSubmitBtn', 'bi-check-circle', 'Guardar cambios');
        document.getElementById('servCancelBtn').classList.remove('d-none');
        aviso('servMsg', 'Editando "' + servicio.nombre + '". Si eliges una foto, reemplaza la anterior.', true);
        document.querySelector('.ad-main').scrollTop = 0;
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
        const s = serviciosCache[id];
        if (!confirm('¿Eliminar el servicio "' + (s ? s.nombre : '') + '"?')) return;
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
    // Stock en píldora de color: verde (bien), amarillo (poco) o rojo (agotado)
    function pillStock(n) {
        if (n === 0) return '<span class="ad-pill ad-pill-red">Agotado</span>';
        if (n < STOCK_BAJO) return `<span class="ad-pill ad-pill-amber">${n}</span>`;
        return `<span class="ad-pill">${n}</span>`;
    }

    let productosCache = {};   // igual que arriba: los productos se guardan en memoria

    function cargarProductos() {
        fetch(`${API}/products/`).then(r => r.json()).then(productos => {
            productosCache = {};
            productos.forEach(p => { productosCache[p.id] = p; });
            document.getElementById('statProductos').textContent = productos.length;
            pintarAlertaStock(productos);
            actualizarStock(productos);
            document.getElementById('productosBody').innerHTML = productos.length ? productos.map(p =>
                `<tr>
                    <td><div class="ad-prod">${thumb(p.imagen)}<span>${esc(p.nombre)}</span></div></td>
                    <td>${pillStock(p.stock)}</td>
                    <td>$${formatearPrecioCOP(p.precio)}</td>
                    <td>
                        <div class="ad-repo">
                            <input type="number" min="1" value="1" id="add-${p.id}" aria-label="Unidades que entraron">
                            <button type="button" onclick="reponerStock('${p.id}')"><i class="bi bi-plus-lg"></i>Reponer</button>
                        </div>
                    </td>
                    <td><div class="ad-acciones">${btnEditar(`editarProducto('${p.id}')`)}${btnEliminar(`eliminarProducto('${p.id}')`)}</div></td>
                </tr>`
            ).join('') : '<tr><td colspan="5" class="ad-vacio-grande">Aún no hay productos.</td></tr>';
            if (typeof pintarPedidos === 'function') pintarPedidos();   // las fotos de los pedidos salen de aquí
        });
    }
    cargarProductos();

    function limpiarProducto() {
        document.getElementById('productoForm').reset();
        document.getElementById('prodId').value = '';
        ponerBoton('prodSubmitBtn', 'bi-plus-circle', 'Agregar');
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
        ponerBoton('prodSubmitBtn', 'bi-check-circle', 'Guardar cambios');
        document.getElementById('prodCancelBtn').classList.remove('d-none');
        aviso('prodMsg', 'Editando "' + producto.nombre + '". Si eliges una foto, reemplaza la anterior.', true);
        document.querySelector('.ad-main').scrollTop = 0;
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
        const p = productosCache[id];
        if (!confirm('¿Eliminar el producto "' + (p ? p.nombre : '') + '"?')) return;
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
    let pedidosLista = [];

    function cargarPedidos() {
        fetch(`${API}/orders/`, { headers }).then(r => r.json()).then(lista => {
            pedidosLista = Array.isArray(lista) ? lista : [];
            pintarPedidos();
        });
    }

    // La foto de un item sale del producto que tenga el mismo nombre
    function fotoDeProducto(nombreItem) {
        const p = Object.values(productosCache).find(x => x.nombre === nombreItem);
        return p ? p.imagen : '';
    }

    function pintarPedidos() {
        const cont = document.getElementById('pedidosContainer');
        if (!pedidosLista.length) {
            cont.innerHTML = '<div class="ad-vacio-grande"><i class="bi bi-cart fs-3 d-block mb-2"></i>Aún no hay pedidos.</div>';
            return;
        }
        const orden = document.getElementById('pedOrden').value;
        const lista = pedidosLista.slice().sort((a, b) => {
            const dif = new Date(b.creado_en) - new Date(a.creado_en);
            return orden === 'viejos' ? -dif : dif;
        });
        cont.innerHTML = lista.map(p => {
            const cancelado = p.estado === 'cancelado';
            const items = p.items.map(i => `
                <div class="ad-ped-item">${thumb(fotoDeProducto(i.nombre))}<span>${i.cantidad} × ${esc(i.nombre)}</span><b>${fmt(i.subtotal)}</b></div>`).join('');
            const estado = cancelado
                ? `<span class="ad-pill ad-pill-red ad-pill-dot">Cancelado</span><span class="small text-muted ms-2">Cancelado (el stock ya volvió al inventario)</span>`
                : `<div class="ad-ped-guardar">
                        <div class="ad-select"><select id="estado-${p.id}">${ESTADOS_PEDIDO.map(([v, t]) => `<option value="${v}" ${v === p.estado ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                        <button type="button" class="ad-btn ad-btn-green" onclick="guardarEstadoPedido(${p.id})"><i class="bi bi-floppy"></i>Guardar estado</button>
                   </div>`;
            return `
            <div class="ad-pedido ${cancelado ? 'cancelado' : ''}">
                <div class="ad-ped-main">
                    <div class="ad-ped-head">
                        <span class="ad-ped-ico"><i class="bi bi-bag"></i></span>
                        <div>
                            <div><b class="ad-ped-num">Pedido #${p.id}</b> <span class="ad-ped-fecha">${esc(new Date(p.creado_en).toLocaleString('es-CO'))}</span></div>
                            <div class="ad-ped-cli">${esc(p.cliente_nombre)} · ${esc(p.cliente_email)}</div>
                        </div>
                    </div>
                    <div class="ad-ped-items">${items}</div>
                </div>
                <div class="ad-ped-side">
                    <div class="ad-total"><span class="ad-total-ico"><i class="bi bi-currency-dollar"></i></span><div><small>Total del pedido</small><b>${fmt(p.total)}</b></div></div>
                    <p class="ad-ped-dir"><i class="bi bi-geo-alt"></i>${esc(p.direccion)}, ${esc(p.ciudad)} · ${esc(p.telefono)}</p>
                    ${p.notas ? `<p class="ad-ped-notas">${esc(p.notas)}</p>` : ''}
                    <div class="ad-ped-estado">${estado}</div>
                    <div id="pedMsg-${p.id}" class="small mt-1"></div>
                </div>
            </div>`;
        }).join('');
    }
    document.getElementById('pedOrden').addEventListener('change', pintarPedidos);

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
    let resenasCache = {};

    function estrellasHTML(n) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<i class="bi ${i <= n ? 'bi-star-fill' : 'bi-star'}"></i>`;
        }
        return html;
    }

    // "Nombre + insignia" de quien escribió la respuesta
    function quienRespondio(r) {
        const esAdiestrador = r.respondido_por_rol === 'adiestrador';
        return `<strong>${esc(r.respondido_por_nombre)}</strong>
                <span class="ad-tag ${esAdiestrador ? 'ad-tag-olive' : 'ad-tag-dark'}">${esAdiestrador ? 'Adiestrador' : 'Administrador'}</span>`;
    }

    // Respuesta ya publicada (con botón Editar)
    function bloqueRespuesta(r) {
        return `
            <div class="ad-res-row">
                <span class="ad-res-ok"><i class="bi bi-check-circle-fill"></i>Respondida por ${quienRespondio(r)}</span>
                <button type="button" class="ad-btn ad-btn-sm ad-btn-line" onclick="editarResena(${r.id})"><i class="bi bi-pencil"></i>Editar</button>
            </div>
            <div class="ad-quote"><i class="bi bi-chat-dots-fill"></i><div><b>Respuesta de EDUCAN</b><p>${esc(r.respuesta_admin)}</p></div></div>`;
    }

    // Casilla para escribir (o editar) la respuesta
    function formRespuesta(r, editando) {
        return `
            <div class="ad-res-form">
                <input class="ad-input" id="resp-${r.id}" maxlength="500" placeholder="Escribe una respuesta pública" value="${esc(r.respuesta_admin)}">
                <button type="button" class="ad-btn ad-btn-green ad-btn-sm" onclick="guardarResena(${r.id})"><i class="bi bi-send"></i>${editando ? 'Guardar' : 'Responder'}</button>
                ${editando ? `<button type="button" class="ad-btn ad-btn-line ad-btn-sm" onclick="cancelarResena(${r.id})">Cancelar</button>` : ''}
            </div>`;
    }

    function tarjetaResena(r) {
        return `
            <div class="ad-resena">
                <div class="ad-res-top">
                    ${avatarIni(r.cliente_nombre, 'ad-av-md')}
                    <div class="flex-grow-1"><b>${esc(r.cliente_nombre)}</b><span>${esc(r.servicio)}</span></div>
                    <div class="ad-stars">${estrellasHTML(r.estrellas)}</div>
                </div>
                <p class="ad-res-txt">${esc(r.comentario) || '<span class="text-muted">Sin comentario.</span>'}</p>
                <div id="respBox-${r.id}">${r.respuesta_admin ? bloqueRespuesta(r) : formRespuesta(r, false)}</div>
                <div id="respMsg-${r.id}" class="small mt-1"></div>
            </div>`;
    }

    function cargarResenas() {
        fetch(`${API}/reviews/`, { headers }).then(r => r.json()).then(resenas => {
            resenasCache = {};
            resenas.forEach(r => { resenasCache[r.id] = r; });
            document.getElementById('resenasContainer').innerHTML = resenas.length
                ? resenas.map(tarjetaResena).join('')
                : '<div class="ad-vacio-grande"><i class="bi bi-star fs-3 d-block mb-2"></i>Aún no hay reseñas.</div>';
        });
    }

    // Editar: la respuesta se convierte en una casilla para cambiarla
    window.editarResena = function (id) {
        const r = resenasCache[id];
        if (!r) return;
        document.getElementById('respBox-' + id).innerHTML = formRespuesta(r, true);
        document.getElementById('resp-' + id).focus();
    };
    window.cancelarResena = function (id) {
        const r = resenasCache[id];
        if (r) document.getElementById('respBox-' + id).innerHTML = r.respuesta_admin ? bloqueRespuesta(r) : formRespuesta(r, false);
    };
    window.guardarResena = async function (id) {
        const input = document.getElementById('resp-' + id);
        const msg = document.getElementById('respMsg-' + id);
        try {
            await enviar(`${API}/reviews/${id}/responder/`, 'POST', { respuesta: input.value.trim() });
            cargarResenas();   // se vuelve a dibujar con "Respondida por ..."
        } catch (err) {
            msg.className = 'small mt-1 text-danger';
            msg.textContent = err.message;
        }
    };

    // ============================================
    // Mensajes de contacto
    // ============================================
    // Ilustración para cuando todavía no hay mensajes: sobre con patita (todo dibujado con SVG)
    const ILUSTRACION_MENSAJES = `
        <svg viewBox="0 0 400 270" class="ad-ilus" aria-hidden="true">
            <circle cx="200" cy="130" r="105" fill="#f1f3e6"/>
            <g fill="#e9eddb"><g transform="translate(40 168) scale(2.6)">${PATA_DIBUJO}</g><g transform="translate(318 120) scale(3) rotate(12 12 12)">${PATA_DIBUJO}</g></g>
            <rect x="120" y="86" width="150" height="102" rx="12" fill="#a9bd8d"/>
            <path d="M126 98 L195 148 L264 98" stroke="#f1f3e6" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="268" cy="188" r="38" fill="#e3e8d3"/>
            <g fill="#6d8b45" transform="translate(246 166) scale(1.85)">${PATA_DIBUJO}</g>
            <g stroke="#6d8b45" stroke-width="6" stroke-linecap="round" opacity=".8"><path d="M96 110l16 8"/><path d="M92 138l16-6"/><path d="M296 82l-8 16"/><path d="M304 112l16-4"/></g>
        </svg>`;

    function cargarMensajes() {
        fetch(`${API}/contact/`, { headers }).then(r => r.json()).then(lista => {
            const contenedor = document.getElementById('mensajesContainer');
            if (!Array.isArray(lista) || !lista.length) {
                contenedor.innerHTML = `
                    <div class="ad-vacio-ilus">
                        ${ILUSTRACION_MENSAJES}
                        <span class="ad-pill ad-pill-soft"><i class="bi bi-envelope-fill"></i>Bandeja de contacto</span>
                        <h5>Aún no hay mensajes</h5>
                        <p>Cuando alguien se comunique con EDUCAN desde el formulario de contacto, sus mensajes aparecerán aquí.</p>
                    </div>`;
                return;
            }
            contenedor.innerHTML = lista.map(m => `
                <div class="ad-mensaje ${m.leido ? 'leido' : ''}">
                    <div class="ad-res-top">
                        ${avatarIni(m.nombre, 'ad-av-md')}
                        <div class="flex-grow-1"><b>${esc(m.nombre)}</b><span>${esc(m.email)}${m.telefono ? ' · ' + esc(m.telefono) : ''}</span></div>
                        <div>
                            <span class="ad-pill ad-pill-grey">${esc(m.motivo_texto)}</span>
                            ${m.leido ? '' : '<span class="ad-pill ad-pill-red ms-1">Nuevo</span>'}
                        </div>
                    </div>
                    <p class="ad-res-txt">${esc(m.mensaje)}</p>
                    <div class="ad-res-row">
                        <span class="ad-ped-fecha">${esc(new Date(m.creado_en).toLocaleString('es-CO'))} · ${esc(hace(m.creado_en))}</span>
                        ${m.leido
                            ? '<span class="ad-res-ok"><i class="bi bi-check-circle-fill"></i>Leído</span>'
                            : `<button type="button" class="ad-btn ad-btn-green ad-btn-sm" onclick="marcarLeido(${m.id})"><i class="bi bi-check2"></i>Marcar como leído</button>`}
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

    // Avatar del autor: su foto si tiene, si no sus iniciales
    function avatarAutor(autor) {
        return autor && autor.foto
            ? `<span class="ad-av"><img src="${esc(autor.foto)}" alt=""></span>`
            : avatarIni(autor ? autor.nombre : '?');
    }

    const msgTodoBien = txt => `<div class="ad-ok"><i class="bi bi-check-circle-fill"></i>${txt}</div>`;

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
            <div class="ad-cm-row bloqueado">
                ${avatarAutor(x.autor)}
                <div class="ad-cm-cuerpo">
                    <div class="ad-cm-meta">
                        <span class="ad-tag ad-tag-grey">${etiqueta}</span>
                        <strong>${esc(x.autor.nombre)}</strong>
                        <span class="text-muted">${esc(x.autor.email)} · ${esc(hace(x.creado_en))}</span>
                        <span class="ad-pill ad-pill-red">Palabra detectada: ${esc(x.palabra)}</span>
                    </div>
                    <div class="ad-cm-txt">${esc(x.texto)}</div>
                    ${contexto ? `<div class="ad-cm-ctx">En la publicación: "${esc(contexto)}..."</div>` : ''}
                    <div class="ad-acciones mt-2">
                        <button type="button" class="ad-btn ad-btn-sm ad-btn-green" onclick="moderarContenido('${tipo}', ${x.id}, 'restaurar')"><i class="bi bi-arrow-counterclockwise"></i>Restaurar (no es ofensivo)</button>
                        <button type="button" class="ad-btn ad-btn-sm ad-btn-soft" onclick="moderarContenido('${tipo}', ${x.id}, 'eliminar')"><i class="bi bi-trash"></i>Eliminar</button>
                        <button type="button" class="ad-btn ad-btn-sm ad-btn-line" onclick="moderarUsuario(${x.autor.id}, 'desactivar')"><i class="bi bi-person-slash"></i>Desactivar cuenta</button>
                    </div>
                </div>
            </div>`;
        const pendientes = d.comentarios_bloqueados.map(c => bloque('comments', 'Comentario', c, c.publicacion))
            .concat(d.publicaciones_bloqueadas.map(p => bloque('posts', 'Publicación', p, '')));
        document.getElementById('comPorRevisar').innerHTML = pendientes.join('') || msgTodoBien('No hay nada por revisar.');

        // ---- Cuentas suspendidas ----
        document.getElementById('comRestricciones').innerHTML = d.restricciones.map(r => `
            <div class="ad-cm-row">
                ${avatarAutor(r.usuario)}
                <div class="ad-cm-cuerpo">
                    <div class="ad-cm-meta"><strong>${esc(r.usuario.nombre)}</strong> <span class="text-muted">${esc(r.usuario.email)}</span></div>
                    <div class="small ${r.activa ? 'text-danger' : 'text-muted'}">${esc(r.motivo)} · ${esc(hastaTexto(r.hasta))}${r.activa ? '' : ' (ya venció)'}</div>
                </div>
                <button type="button" class="ad-btn ad-btn-sm ad-btn-green" onclick="moderarUsuario(${r.usuario.id}, 'reactivar')"><i class="bi bi-person-check"></i>Reactivar cuenta</button>
            </div>`).join('') || msgTodoBien('No hay cuentas suspendidas.');

        // ---- Recientes ----
        const botonesFila = (tipo, x) => `
            <div class="ad-acciones">
                <button type="button" class="ad-btn ad-btn-sm ad-btn-soft" onclick="borrarContenidoComunidad('${tipo}', ${x.id})"><i class="bi bi-trash"></i>Eliminar</button>
                <button type="button" class="ad-btn ad-btn-sm ad-btn-line" onclick="moderarUsuario(${x.autor.id}, 'desactivar')"><i class="bi bi-person-slash"></i>Desactivar cuenta</button>
            </div>`;
        const filaPub = p => `
            <div class="ad-cm-row">
                ${p.imagen ? `<img class="ad-thumb ad-thumb-cm" src="${esc(p.imagen)}" alt="">` : avatarAutor(p.autor)}
                <div class="ad-cm-cuerpo">
                    <div class="ad-cm-meta"><span class="ad-tag ad-tag-olive">Publicación</span><strong>${esc(p.autor.nombre)}</strong>${p.creado_en ? `<span class="text-muted">· ${esc(hace(p.creado_en))}</span>` : ''}</div>
                    <div class="ad-cm-txt">${esc(p.texto)}</div>
                </div>
                ${botonesFila('posts', p)}
            </div>`;
        const filaCom = c => `
            <div class="ad-cm-row">
                <span class="ad-av ad-av-pata"><svg viewBox="0 0 24 24" fill="#8a9a6c" aria-hidden="true">${PATA_DIBUJO}</svg></span>
                <div class="ad-cm-cuerpo">
                    <div class="ad-cm-meta"><span class="ad-tag ad-tag-grey">Comentario</span><strong>${esc(c.autor.nombre)}</strong>${c.creado_en ? `<span class="text-muted">· ${esc(hace(c.creado_en))}</span>` : ''}</div>
                    <div class="ad-cm-txt">${esc(c.texto)}</div>
                </div>
                ${botonesFila('comments', c)}
            </div>`;
        document.getElementById('comRecientes').innerHTML =
            d.recientes_publicaciones.map(filaPub).join('') + d.recientes_comentarios.map(filaCom).join('')
            || '<div class="ad-vacio-grande">Aún no hay publicaciones.</div>';
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
                <div class="ad-img-row">
                    ${i.imagen
                        ? `<img class="ad-img-prev" src="${esc(i.imagen)}" alt="">`
                        : '<span class="ad-img-prev ad-img-vacia"><i class="bi bi-image"></i></span>'}
                    <div class="ad-img-info">
                        <b>${esc(i.descripcion)}</b>
                        <span class="ad-pill ${i.imagen ? 'ad-pill-dot' : 'ad-pill-grey'}">${i.imagen ? 'Foto subida' : 'Sin foto todavía'}</span>
                        <div id="imgMsg-${i.clave}" class="small text-danger"></div>
                    </div>
                    <input type="file" class="ad-input ad-file" accept="image/png,image/jpeg,image/webp" id="imgFile-${i.clave}">
                    <div class="ad-img-botones">
                        <button type="button" class="ad-btn ad-btn-green ad-btn-sm" onclick="subirImagenSitio('${i.clave}')"><i class="bi bi-cloud-upload-fill"></i>Subir</button>
                        ${i.imagen ? `<button type="button" class="ad-btn ad-btn-soft ad-btn-sm" onclick="quitarImagenSitio('${i.clave}')"><i class="bi bi-trash"></i>Quitar</button>` : ''}
                    </div>
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