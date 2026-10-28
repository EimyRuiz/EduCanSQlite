"""
apps/community/words.py
Filtro de vocabulario de la comunidad.

Cómo funciona (para que se pueda explicar):
  1. Se "limpia" el texto: minúsculas, sin tildes, números parecidos a letras (h1j0 -> hijo)
     y letras repetidas (hijueputaaaa -> hijueputa).
  2. Palabras sueltas: se compara cada palabra COMPLETA con la lista (así "perra", que es una
     palabra normal en un sitio de perros, o "disputa" no se bloquean por error).
  3. Insultos largos: también se buscan aunque los separen con puntos o espacios (h.i.j.u.e.p.u.t.a).

Para agregar o quitar palabras solo edita las dos listas de abajo (en minúscula y sin tildes).
"""
import re
import unicodedata

# Palabras completas (se comparan con la palabra entera, también en plural)
PALABRAS = {
    'hp', 'hdp', 'hpta', 'ptm', 'gpt',
    'hijueputa', 'hijoputa', 'hijuepucha', 'hijuemadre',
    'puta', 'puto', 'marica', 'maricon', 'malparido', 'malparida', 'gonorrea', 'mierda',
    'idiota', 'estupido', 'estupida', 'imbecil', 'pendejo', 'pendeja', 'cabron', 'zorra',
    'tarado', 'tarada', 'retrasado', 'retrasada', 'subnormal', 'maldito', 'maldita',
    'verga', 'carajo', 'culo', 'joder', 'pirobo', 'lameculos',
    'muerto', 'muerta', 'asesino', 'asesina',
}

# Insultos largos y claros: se buscan incluso si los escriben separados (i d i o t a)
LARGAS = [
    'hijueputa', 'hijoputa', 'hijodeputa', 'hijuepucha', 'malparido', 'gonorrea',
    'estupido', 'imbecil', 'idiota', 'pirobo', 'lameculos',
]

_LEET = str.maketrans({'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
                       '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i'})


def limpiar(texto):
    """Minúsculas, sin tildes, números->letras y letras repetidas reducidas a una."""
    texto = unicodedata.normalize('NFD', str(texto).lower())
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    texto = texto.translate(_LEET)
    return re.sub(r'(.)\1{2,}', r'\1', texto)    # "hijueputaaaa" -> "hijueputa"


def revisar_texto(texto):
    """Devuelve la palabra prohibida encontrada, o None si el texto está limpio."""
    limpio = limpiar(texto)

    # 1) palabras completas (con plural)
    for palabra in re.findall(r'[a-z]+', limpio):
        if palabra in PALABRAS:
            return palabra
        if palabra.endswith('s') and palabra[:-1] in PALABRAS:
            return palabra[:-1]
        if palabra.endswith('es') and palabra[:-2] in PALABRAS:
            return palabra[:-2]

    # 2) insultos largos aunque estén separados por puntos, guiones o espacios
    pegado = re.sub(r'[^a-z]', '', limpio)
    for palabra in LARGAS:
        if palabra in pegado:
            return palabra
    return None