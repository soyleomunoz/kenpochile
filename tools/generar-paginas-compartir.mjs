// Genera, a partir de los datos de index.html, una página "para compartir" por cada modal
// con URL propia: entradas de blog, escuelas, maestros, cinturones de color y seminarios.
//
// Por qué existe: la landing abre cada modal con un deep-link por hash
// (kenpochile.cl/#blog=<id>), pero WhatsApp, Facebook, Telegram, etc. NO leen lo que va
// después del "#": siempre ven el index.html genérico. Estas páginas viven en una ruta
// real (kenpochile.cl/blog/<id>/), llevan las etiquetas Open Graph propias de cada
// contenido (título, resumen e imagen) y, para personas, redirigen al modal en la landing.
//
// Se ejecuta en el workflow de GitHub Pages justo antes de publicar (ver
// .github/workflows/pages.yml) y SE VERSIONAN sus resultados (blog/, escuela/, maestro/,
// cinturon/, seminario/, og/ y sitemap.xml): GitHub también lanza el despliegue clásico
// "pages build and deployment", que publica el repositorio tal cual y puede pisar al del
// workflow; versionarlos garantiza que las páginas existan gane el que gane.
// Las entradas de BLOG son la excepción: su página (kenpochile.cl/blog/<id>/) lleva el
// artículo COMPLETO (texto, afiches, galería y datos estructurados), sin redirigir, para que
// Google y los buscadores de IA lo indexen. En la landing la tarjeta enlaza a esa página y el
// clic se intercepta para abrir el modal. El script también genera robots.txt, llms.txt y
// og-image.jpg (imagen para compartir de la portada del sitio).
// Tras añadir o cambiar una entrada de blog, escuela, maestro, cinturón o seminario en
// index.html hay que volver a ejecutar el script y subir los archivos generados.
//
// Uso local:  cd tools && npm ci && node generar-paginas-compartir.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://kenpochile.cl';
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const IMG_RESPALDO = 'img/header/maestro.png';

// ── Lectura de los arreglos de datos de index.html ─────────────────────────────────────
// Se localiza `const NOMBRE = [ ... ];` contando llaves (respetando strings, plantillas y
// comentarios) y se evalúa en un contexto aislado. Los identificadores externos que
// algunos datos referencian (p. ej. ESCUELA_COMUNA_MUNICIPAL) se sustituyen por un stub
// vacío: aquí solo interesan los campos de texto.
function extraerLiteral(nombre) {
  const m = new RegExp(`^const ${nombre}\\s*=\\s*`, 'm').exec(SRC);
  if (!m) throw new Error(`No se encontró "const ${nombre}" en index.html`);
  const ini = m.index + m[0].length;
  const abre = SRC[ini];
  const cierra = abre === '[' ? ']' : '}';
  let prof = 0, str = null, esc = false;
  const plantillas = [];
  for (let j = ini; j < SRC.length; j++) {
    const c = SRC[j];
    if (str) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (str === '`' && c === '$' && SRC[j + 1] === '{') { plantillas.push(prof); prof++; j++; str = null; continue; }
      if (c === str) str = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; continue; }
    if (c === '/' && SRC[j + 1] === '/') { j = SRC.indexOf('\n', j); continue; }
    if (c === '/' && SRC[j + 1] === '*') { j = SRC.indexOf('*/', j) + 1; continue; }
    if (c === '{' || c === '[' || c === '(') prof++;
    if (c === '}' || c === ']' || c === ')') {
      prof--;
      if (c === '}' && plantillas.length && prof === plantillas[plantillas.length - 1]) { plantillas.pop(); str = '`'; continue; }
      if (prof === 0 && c === cierra) return SRC.slice(ini, j + 1);
    }
  }
  throw new Error(`No se pudo delimitar "const ${nombre}"`);
}

function leerDatos(nombre) {
  const literal = extraerLiteral(nombre);
  const ctx = { encodeURIComponent, CONFIG: {} };
  for (let i = 0; i < 80; i++) {
    try {
      const datos = vm.runInNewContext(`(${literal})`, ctx, { timeout: 3000 });
      if (!Array.isArray(datos) || !datos.length) throw new Error('vacío');
      return datos;
    } catch (e) {
      const falta = /^(\w+) is not defined/.exec(e.message);
      if (!falta) throw new Error(`No se pudo evaluar ${nombre}: ${e.message}`);
      ctx[falta[1]] = new Proxy(function () {}, { get: () => '', apply: () => '' });
    }
  }
  throw new Error(`Demasiados identificadores externos en ${nombre}`);
}

// ── Utilidades de texto ────────────────────────────────────────────────────────────────
const ENTIDADES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&laquo;': '«', '&raquo;': '»' };
function textoPlano(html = '') {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h\d|br)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, m => ENTIDADES[m.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function recortar(txt, max = 200) {
  if (txt.length <= max) return txt;
  const corte = txt.slice(0, max);
  const sp = corte.lastIndexOf(' ');
  return corte.slice(0, sp > max * 0.6 ? sp : max).replace(/[\s,;:.\-–—]+$/, '') + '…';
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Imagen de vista previa ─────────────────────────────────────────────────────────────
// Cada página lleva su propio JPG de 1200×630: WhatsApp descarta vistas previas con imágenes
// pesadas (> ~300 KB) y no siempre entiende WebP, y las insignias son cuadradas o
// transparentes. Se compone la imagen original centrada ("contain") sobre su propio
// desenfoque oscuro, así no se recorta ni deforma nada.
const W = 1200, H = 630;
async function crearImagenOG(origenRel, destinoRel) {
  const origen = path.join(ROOT, origenRel);
  if (!fs.existsSync(origen)) return null;
  const destino = path.join(ROOT, destinoRel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const fondo = await sharp(origen).resize(W, H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.45 })
    .flatten({ background: '#14100D' }).toBuffer();
  const frente = await sharp(origen).resize(W, H, { fit: 'inside', withoutEnlargement: false }).toBuffer();
  await sharp(fondo).composite([{ input: frente }]).jpeg({ quality: 84, progressive: true, mozjpeg: true }).toFile(destino);
  return `${SITE}/${destinoRel}`;
}

// ── Plantilla de cada página ───────────────────────────────────────────────────────────
function pagina({ tipo, id, hash, titulo, descripcion, imagen, alt, cuerpoTitulo, cuerpoTexto, boton }) {
  const url = `${SITE}/${tipo}/${id}/`;
  const destino = `/#${hash}`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Página generada por tools/generar-paginas-compartir.mjs — no editar a mano.
     Lleva las etiquetas Open Graph propias de este contenido (WhatsApp, Facebook y Google
     no leen lo que va después del # de la landing) y redirige al modal en la landing. -->
<title>${esc(titulo)} | KenpoChile.cl</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${tipo === 'blog' ? 'article' : 'website'}">
<meta property="og:site_name" content="KenpoChile.cl">
<meta property="og:locale" content="es_CL">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:image" content="${imagen}">
<meta property="og:image:secure_url" content="${imagen}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${W}">
<meta property="og:image:height" content="${H}">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(descripcion)}">
<meta name="twitter:image" content="${imagen}">
<meta name="theme-color" content="#14100D">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%2314100D' stroke='%23F5A623' stroke-width='3'/%3E%3Ctext x='32' y='42' font-family='Georgia,serif' font-size='26' font-weight='900' fill='%23F5A623' text-anchor='middle'%3EKC%3C/text%3E%3C/svg%3E">
<script>location.replace(${JSON.stringify(destino)});</script>
<noscript><meta http-equiv="refresh" content="0; url=${destino}"></noscript>
<style>
  body{margin:0;background:#14100D;color:#e8dccb;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
  main{max-width:720px;padding:24px;text-align:center}
  img{width:100%;height:auto;border-radius:10px}
  h1{color:#F5A623;font-size:1.5rem;line-height:1.3}
  a{display:inline-block;margin-top:12px;padding:12px 22px;background:#F5A623;color:#14100D;border-radius:8px;text-decoration:none;font-weight:bold}
</style>
</head>
<body>
<main>
  <img src="${imagen}" alt="${esc(alt)}" width="${W}" height="${H}">
  <h1>${esc(cuerpoTitulo)}</h1>
  <p>${esc(cuerpoTexto)}</p>
  <a href="${destino}">${esc(boton)}</a>
</main>
</body>
</html>
`;
}

// ── Página completa de cada entrada de blog ────────────────────────────────────────────
const FUENTES = (/<style id="local-fonts">[\s\S]*?<\/style>/.exec(SRC) || [''])[0].replace(/url\(assets\//g, 'url(/assets/');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = iso => { const [a, m, d] = String(iso).split('-').map(Number); return a && m && d ? `${d} de ${MESES[m - 1]} de ${a}` : ''; };
const abs = src => /^(https?:|\/|data:)/.test(src) ? src : '/' + src;
// Los enlaces internos del modal (botones con onclick) se convierten en enlaces reales.
function contenidoEstatico(html) {
  return String(html)
    .replace(/<button[^>]*onclick="[^"]*openEscuelaFicha\('([a-z0-9-]+)'\)[^"]*"[^>]*>([\s\S]*?)<\/button>/g, '<a href="/escuela/$1/">$2</a>')
    .replace(/<button[^>]*onclick="[^"]*openMaestroBio\('([a-z0-9-]+)'\)[^"]*"[^>]*>([\s\S]*?)<\/button>/g, '<a href="/maestro/$1/">$2</a>')
    .replace(/<button[^>]*onclick="[^"]*openBlogModal\('([a-z0-9-]+)'\)[^"]*"[^>]*>([\s\S]*?)<\/button>/g, '<a href="/blog/$1/">$2</a>')
    .replace(/<button[^>]*onclick="[^"]*openInstructorPorNombre\([^)]*\)[^"]*"[^>]*>([\s\S]*?)<\/button>/g, '<strong>$1</strong>')
    .replace(/<button[^>]*onclick="[^"]*"[^>]*>([\s\S]*?)<\/button>/g, '$1')
    .replace(/\s+onclick="[^"]*"/g, '')
    .replace(/href="#([a-z0-9-]*)"/g, 'href="/#$1"')
    .replace(/(src)="(?!https?:|\/|data:)([^"]+)"/g, '$1="/$2"');
}
function paginaBlog(p, todos, imagen) {
  const url = `${SITE}/blog/${p.id}/`;
  const cats = p.cats || [p.cat];
  const resumen = textoPlano(p.excerpt) || recortar(textoPlano(p.contenido), 200);
  const portada = abs(p.imgFull || p.img || IMG_RESPALDO);
  const afiches = (p.afiches || []).map((src, i) => `<img src="${abs(src)}" alt="Afiche ${i + 1}: ${esc(p.titulo)}" loading="lazy" decoding="async">`).join('');
  const galeria = (p.galeria || []).map((src, i) => `<a href="${abs(src)}" target="_blank" rel="noopener"><img src="${abs(src)}" alt="Foto ${i + 1} de ${esc(p.titulo)}" loading="lazy" decoding="async"></a>`).join('');
  const relacionados = todos.filter(x => x.id !== p.id && (x.cats || [x.cat]).some(c => cats.includes(c)))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 4);
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.titulo, description: recortar(resumen, 300),
    image: imagen, datePublished: p.fecha, dateModified: p.fecha, inLanguage: 'es-CL', mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'KenpoChile.cl', url: SITE + '/' },
    publisher: { '@type': 'Organization', name: 'KenpoChile.cl', url: SITE + '/' },
  };
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/#blogs' },
    { '@type': 'ListItem', position: 3, name: p.titulo, item: url }] };
  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Página generada por tools/generar-paginas-compartir.mjs a partir de BLOG_POSTS (index.html): no editar a mano. -->
<title>${esc(p.titulo)} | KenpoChile.cl</title>
<meta name="description" content="${esc(recortar(resumen, 200))}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="KenpoChile.cl">
<meta property="og:locale" content="es_CL">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(p.titulo)}">
<meta property="og:description" content="${esc(recortar(resumen, 200))}">
<meta property="og:image" content="${imagen}">
<meta property="og:image:secure_url" content="${imagen}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${W}">
<meta property="og:image:height" content="${H}">
<meta property="og:image:alt" content="${esc(p.titulo)}">
${p.fecha ? `<meta property="article:published_time" content="${p.fecha}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.titulo)}">
<meta name="twitter:description" content="${esc(recortar(resumen, 200))}">
<meta name="twitter:image" content="${imagen}">
<meta name="theme-color" content="#14100D">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%2314100D' stroke='%23F5A623' stroke-width='3'/%3E%3Ctext x='32' y='42' font-family='Georgia,serif' font-size='26' font-weight='900' fill='%23F5A623' text-anchor='middle'%3EKC%3C/text%3E%3C/svg%3E">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(bc)}</script>
${FUENTES}
<style>
:root{--bg:#14100D;--card:#241A14;--tx:#FFF7ED;--mu:#D9C4B4;--pr:#E4572E;--ac:#F5A623;--bd:rgba(228,87,46,.3)}
*{box-sizing:border-box}html,body{overflow-x:hidden}
body{margin:0;background:var(--bg);color:var(--tx);font-family:'Rajdhani',sans-serif;font-size:19px;line-height:1.7;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}a{color:var(--ac)}:focus-visible{outline:3px solid var(--ac);outline-offset:3px}
header{position:sticky;top:0;z-index:5;background:rgba(20,16,13,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}
.hd{max-width:1160px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--tx);font-family:'Cinzel',serif;font-weight:700;font-size:1.15rem}
.logo i{font-style:normal}.logo b{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;border:2px solid var(--ac);color:var(--ac);font-size:.9rem}.logo span{color:var(--pr)}
.hd nav{display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.hd nav a{color:var(--tx);text-decoration:none;font-weight:600;padding:6px 11px;border-radius:999px;font-size:1rem}
.hd nav a.cta{background:linear-gradient(135deg,var(--pr),var(--ac));color:#14100D}
@media(max-width:820px){.hd nav a:not(.cta){display:none}}
main{max-width:800px;margin:0 auto;padding:26px 20px 50px}
.crumbs{font-size:.95rem;color:var(--mu);margin-bottom:16px}.crumbs a{color:var(--mu)}
.cat{display:inline-block;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);border:1px solid var(--bd);background:var(--card);padding:4px 12px;border-radius:999px;margin-right:6px}
h1{font-family:'Cinzel',serif;font-size:clamp(1.6rem,4vw,2.3rem);line-height:1.25;color:var(--ac);margin:14px 0 8px}
.meta{color:var(--mu);font-size:1rem;margin:0 0 20px}.dek{font-size:1.15rem;color:var(--mu)}
.cover img{border-radius:16px;width:100%;margin-bottom:20px}
.afiches{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;margin:0 0 24px}.afiches strong{display:block;color:var(--ac);margin-bottom:10px}.afiches img{margin:0 auto 10px;border-radius:10px;max-height:900px;width:auto}
article h4{font-family:'Cinzel',serif;color:var(--ac);font-size:1.3rem;margin:30px 0 8px}article p{margin:0 0 16px}article ul{padding-left:22px}article strong{color:#fff}
.galeria h2{font-family:'Cinzel',serif;color:var(--ac);font-size:1.3rem;margin:34px 0 12px}.galeria div{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}.galeria img{aspect-ratio:1;object-fit:cover;border-radius:10px;width:100%}
.box{margin:36px 0 10px;border-radius:20px;padding:26px 24px;background:linear-gradient(135deg,var(--pr),var(--ac));color:#14100D}.box h2{font-family:'Cinzel',serif;margin:0 0 6px;font-size:1.35rem}.box p{margin:0 0 14px;font-weight:600}
.btn{display:inline-block;background:#14100D;color:var(--ac);font-weight:700;text-decoration:none;border-radius:999px;padding:11px 22px}
.more h2{font-family:'Cinzel',serif;color:var(--ac);font-size:1.15rem;margin-top:30px}.more li{margin-bottom:6px}
footer{border-top:1px solid var(--bd);color:var(--mu);font-size:.95rem;padding:24px 20px 40px}footer .in{max-width:1160px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}
</style>
</head>
<body>
<header><div class="hd">
  <a class="logo" href="/" aria-label="KenpoChile.cl, ir al inicio"><b>KC</b><i>Kenpo<span>Chile</span>.cl</i></a>
  <nav aria-label="Navegación principal"><a href="/#escuelas">Escuelas</a><a href="/#maestros">Maestros</a><a href="/#seminarios">Seminarios</a><a href="/#blogs">Blog</a><a href="/#contacto" class="cta">Inscríbete</a></nav>
</div></header>
<main>
  <nav class="crumbs" aria-label="Ruta de navegación"><a href="/">Inicio</a> / <a href="/#blogs">Blog</a> / ${esc(cats[0])}</nav>
  <article>
    ${cats.map(c => `<span class="cat">${esc(c)}</span>`).join('')}
    <h1>${esc(p.titulo)}</h1>
    <p class="meta">KenpoChile.cl${p.fecha ? ` · <time datetime="${p.fecha}">${fechaLarga(p.fecha)}</time>` : ''}</p>
    <figure class="cover" style="margin:0"><img src="${portada}" alt="${esc(p.titulo)}" fetchpriority="high"></figure>
    ${afiches ? `<div class="afiches"><strong>Afiches del evento</strong>${afiches}</div>` : ''}
    ${contenidoEstatico(p.contenido)}
  </article>
  ${galeria ? `<section class="galeria" aria-label="Galería"><h2>Galería</h2><div>${galeria}</div></section>` : ''}
  <section class="box" aria-label="Encuentra tu escuela"><h2>¿Quieres entrenar Kenpo?</h2><p>Hay escuelas de la federación a lo largo de Chile. Encuentra la más cercana y agenda tu clase.</p><a class="btn" href="/#escuelas">Ver escuelas</a></section>
  ${relacionados.length ? `<section class="more" aria-label="Más artículos"><h2>Más de ${esc(cats[0])}</h2><ul>${relacionados.map(x => `<li><a href="/blog/${x.id}/">${esc(x.titulo)}</a></li>`).join('')}</ul></section>` : ''}
  <p><a href="/#blogs">← Volver al blog</a></p>
</main>
<footer><div class="in"><span>© ${new Date().getFullYear()} KenpoChile.cl · International Vidal Kenpo Studio</span><span>Desarrollado por <a href="https://gestixpro.cl/" target="_blank" rel="noopener">GestixPro</a></span></div></footer>
</body>
</html>
`;
}

// ── Generación ─────────────────────────────────────────────────────────────────────────
const LIMPIAR = ['blog', 'escuela', 'maestro', 'cinturon', 'seminario', 'og'];
for (const d of LIMPIAR) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });

const entradas = []; // para el sitemap
let total = 0;

async function emitir(def, origenImg) {
  const og = (await crearImagenOG(origenImg, `og/${def.tipo}/${def.id}.jpg`))
    ?? (await crearImagenOG(IMG_RESPALDO, `og/${def.tipo}/${def.id}.jpg`));
  if (!og) throw new Error(`Sin imagen para ${def.tipo}/${def.id} (${origenImg})`);
  if (!fs.existsSync(path.join(ROOT, origenImg))) console.warn(`⚠ ${def.tipo}/${def.id}: falta ${origenImg}, se usa la imagen por defecto`);
  const dir = path.join(ROOT, def.tipo, def.id);
  fs.mkdirSync(dir, { recursive: true });
  const html = def.post ? paginaBlog(def.post, def.todos, og) : pagina({ ...def, hash: `${def.tipo}=${def.id}`, imagen: og });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  entradas.push({ loc: `${SITE}/${def.tipo}/${def.id}/`, lastmod: def.lastmod });
  total++;
}

const unicos = (lista, tipo) => {
  const vistos = new Set();
  for (const x of lista) {
    if (!x.id || !/^[a-z0-9-]+$/.test(x.id)) throw new Error(`${tipo}: id inválido "${x.id}"`);
    if (vistos.has(x.id)) throw new Error(`${tipo}: id repetido "${x.id}"`);
    vistos.add(x.id);
  }
  return lista;
};

// Blog (página completa del artículo)
const BLOG = unicos(leerDatos('BLOG_POSTS'), 'blog');
for (const p of BLOG) {
  const resumen = textoPlano(p.excerpt) || recortar(textoPlano(p.contenido), 200);
  await emitir({ post: p, todos: BLOG,
    tipo: 'blog', id: p.id, titulo: p.titulo, descripcion: recortar(resumen, 200), alt: p.titulo,
    cuerpoTitulo: p.titulo, cuerpoTexto: recortar(resumen, 400), boton: 'Leer la nota completa', lastmod: p.fecha,
  }, p.imgFull || p.img || IMG_RESPALDO);
}

// Escuelas
for (const e of unicos(leerDatos('ESCUELAS'), 'escuela')) {
  const lugar = [e.lugar || e.comuna, e.region].filter(Boolean).join(', ');
  const intro = recortar(textoPlano(e.historia), 160);
  const desc = [`Dirige ${e.director}.`, lugar ? `${lugar}.` : '', intro].filter(Boolean).join(' ');
  await emitir({
    tipo: 'escuela', id: e.id, titulo: e.nombre, descripcion: recortar(desc, 200), alt: `Insignia ${e.nombre}`,
    cuerpoTitulo: e.nombre, cuerpoTexto: recortar(desc, 400), boton: 'Ver la ficha de la escuela',
  }, `img/escuelas-insignias/${e.insignia}`);
}

// Maestros
for (const m of unicos(leerDatos('MAESTROS_BIO'), 'maestro')) {
  const desc = [m.grado ? `${m.grado}.` : '', recortar(textoPlano(m.bio), 150)].filter(Boolean).join(' ');
  await emitir({
    tipo: 'maestro', id: m.id, titulo: m.nombre, descripcion: recortar(desc, 200), alt: m.nombre,
    cuerpoTitulo: m.nombre, cuerpoTexto: recortar(desc, 400), boton: 'Leer la biografía',
  }, m.portada);
}

// Seminarios internacionales (el id es el número del seminario)
for (const x of unicos(leerDatos('SEMINARIOS').map(x => ({ ...x, id: String(x.n) })), 'seminario')) {
  const desc = [x.fecha ? `${x.fecha}.` : '', x.lugar ? `${x.lugar}.` : '', x.maestros ? `Con ${x.maestros}.` : '', recortar(textoPlano(x.desc || x.descHtml), 120)].filter(Boolean).join(' ');
  await emitir({
    tipo: 'seminario', id: x.id, titulo: x.titulo, descripcion: recortar(desc, 200), alt: x.titulo,
    cuerpoTitulo: x.titulo, cuerpoTexto: recortar(desc, 400), boton: 'Ver el seminario',
  }, `img/seminarios/${String(x.n).padStart(2, '0')}/${x.img || 'portada.webp'}`);
}

// Cinturones (de color y negros)
for (const g of unicos(leerDatos('PROGRAMA_TECNICO'), 'cinturon')) {
  const desc = `Programa técnico de Kenpo Karate: ${g.grado}${g.tiempo ? `, ${g.tiempo}` : ''}${g.badge ? ` · ${g.badge}` : ''}. Técnicas, sets y teoría.`;
  await emitir({
    tipo: 'cinturon', id: g.id, titulo: g.nombre, descripcion: desc, alt: g.nombre,
    cuerpoTitulo: g.nombre, cuerpoTexto: desc, boton: 'Ver el programa técnico',
  }, g.img);
}

// Sitemap: la landing + todas las páginas generadas.
const urls = [{ loc: `${SITE}/` }, ...entradas.sort((a, b) => a.loc.localeCompare(b.loc))];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>\n`).join('') +
  `</urlset>\n`);

console.log(`✔ ${total} páginas para compartir generadas (blog, escuelas, maestros, cinturones y seminarios).`);

// Imagen para compartir de la portada del sitio (og-image.jpg).
await crearImagenOG(IMG_RESPALDO, 'og-image.jpg');

// robots.txt: permite buscadores y asistentes de IA.
const BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Google-Extended', 'PerplexityBot', 'Bingbot'];
fs.writeFileSync(path.join(ROOT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# Buscadores y asistentes de IA\n${BOTS.map(b => `User-agent: ${b}\nAllow: /`).join('\n')}\n\nSitemap: ${SITE}/sitemap.xml\n`);

// llms.txt: resumen del sitio para buscadores de IA.
const porFecha = [...BLOG].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
fs.writeFileSync(path.join(ROOT, 'llms.txt'), [
  '# KenpoChile.cl', '',
  '> KenpoChile.cl es el sitio de la federación de Kenpo Karate del International Vidal Kenpo Studio (IVKS) en Chile, dirigida por el maestro Roberto Vidal. Reúne las escuelas afiliadas a lo largo de Chile (y Argentina) con su director, horarios y contacto, el programa técnico por cinturón, la historia de los maestros, los seminarios internacionales y las noticias y actividades de cada escuela.', '',
  '## Páginas principales', '',
  `- [Inicio](${SITE}/): escuelas, members, maestros, seminarios, blog, programa técnico, preguntas frecuentes y contacto`,
  ...leerDatos('ESCUELAS').map(e => `- [${e.nombre}](${SITE}/escuela/${e.id}/): escuela dirigida por ${e.director}${e.comuna || e.lugar ? `, ${e.lugar || e.comuna}` : ''}`),
  '', '## Blog', '',
  ...porFecha.map(p => `- [${p.titulo}](${SITE}/blog/${p.id}/): ${recortar(textoPlano(p.excerpt) || textoPlano(p.contenido), 220)}`),
  ''].join('\n'));
console.log('✔ og-image.jpg, robots.txt y llms.txt actualizados.');
