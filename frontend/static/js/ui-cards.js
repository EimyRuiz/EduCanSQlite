(function () {
    'use strict';

    // Escapa texto del usuario antes de ponerlo en el HTML
    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Huella dibujada en SVG (Bootstrap Icons no trae una)
    const PAW_SVG = '<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">' +
        '<ellipse cx="12" cy="28" rx="6" ry="9" transform="rotate(-20 12 28)"/>' +
        '<ellipse cx="26" cy="14" rx="6.5" ry="10"/><ellipse cx="42" cy="14" rx="6.5" ry="10"/>' +
        '<ellipse cx="54" cy="28" rx="6" ry="9" transform="rotate(20 54 28)"/>' +
        '<path d="M32 30c-9 0-18 10-18 18 0 6 5 9 10 8 3-.6 5-2 8-2s5 1.4 8 2c5 1 10-2 10-8 0-8-9-18-18-18z"/></svg>';

    // Tarjeta simple: ícono + etiqueta + valor
    function tile(icon, label, value, extraClass) {
        return `
            <div class="pet-tile">
                <span class="pet-tile-icon"><i class="bi ${icon}"></i></span>
                <div>
                    <div class="pet-tile-label">${esc(label)}</div>
                    <div class="pet-tile-value ${extraClass || ''}">${esc(value)}</div>
                </div>
            </div>`;
    }

    // Tarjeta con etiqueta "Sí" / "No" a la derecha
    function tileYesNo(icon, label, yes) {
        return `
            <div class="pet-tile">
                <span class="pet-tile-icon"><i class="bi ${icon}"></i></span>
                <span class="pet-tile-label" style="font-size:0.85rem">${esc(label)}</span>
                <span class="pet-badge ${yes ? '' : 'no'}">${yes ? 'Sí' : 'No'}</span>
            </div>`;
    }

    window.renderPetCard = function (d, extras) {
        const sexo = String(d.sexo || '').toLowerCase();
        const edad = d.edad != null && d.edad !== '' ? `${d.edad} ${Number(d.edad) === 1 ? 'año' : 'años'}` : '—';
        const peso = d.peso != null && d.peso !== '' ? `${d.peso} kg` : '—';

        const foto = d.foto
            ? `<img class="pet-photo" src="${esc(d.foto)}" alt="${esc(d.nombre)}">`
            : `<div class="pet-photo pet-photo-empty">${PAW_SVG}</div>`;

        // Tarjetas extra (datos del servicio, por ejemplo) arriba de las de la mascota
        const extraHtml = (extras && extras.length)
            ? `<div class="pet-tiles pet-tiles-${Math.min(extras.length, 3)}">` +
              extras.map(x => tile(x.icon, x.label, x.value, 'pet-tile-text')).join('') + '</div>'
            : '';

        return `
            <div class="pet-card">
                <span class="pet-watermark">${PAW_SVG}</span>

                <div class="pet-card-top">
                    <div class="pet-photo-wrap">
                        ${foto}
                        <span class="pet-photo-badge"><i class="bi bi-heart"></i></span>
                    </div>
                    <div class="pet-title">
                        <h2>${esc(d.nombre)}</h2>
                        <p>${esc(d.raza)}</p>
                        <div class="pet-title-line"><span></span>${PAW_SVG}</div>
                    </div>
                </div>

                ${extraHtml}

                <div class="pet-tiles pet-tiles-3">
                    ${tile('bi-calendar-event', 'Edad', edad)}
                    ${tile('bi-bag', 'Peso', peso)}
                    ${tile(sexo === 'macho' ? 'bi-gender-male' : 'bi-gender-female', 'Sexo', sexo || '—')}
                </div>
                <div class="pet-tiles pet-tiles-2">
                    ${tileYesNo('bi-shield-plus', 'Vacunas al día', !!d.vacunas_al_dia)}
                    ${tileYesNo('bi-scissors', 'Esterilizado', !!d.esterilizado)}
                </div>
                <div class="pet-tiles pet-tiles-1">
                    ${tile('bi-emoji-smile', 'Conducta', d.conducta || 'Sin observaciones', 'pet-tile-text')}
                    ${tile('bi-heart-pulse', 'Salud', d.salud || 'Sin observaciones', 'pet-tile-text')}
                </div>
            </div>`;
    };
})();