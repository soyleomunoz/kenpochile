#!/usr/bin/env python3
"""Avisa a los buscadores (IndexNow: Bing, Yandex, Seznam, Naver...) qué URLs
cambiaron, para que las vuelvan a leer sin esperar al rastreo normal.
Bing alimenta también a ChatGPT, Copilot, DuckDuckGo y Yahoo.

Uso (lo ejecuta .github/workflows/indexnow.yml en cada push a main):
    python3 tools/indexnow.py --desde <sha>   # solo lo que cambió desde ese commit
    python3 tools/indexnow.py --todas         # todas las URLs del sitemap

La clave es el archivo <clave>.txt de la raíz (32 caracteres hex, con la misma
clave como contenido). Google no usa IndexNow: para Google basta el sitemap.
"""
import argparse, glob, json, os, re, subprocess, sys, time, urllib.request
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
ENDPOINT = "https://api.indexnow.org/indexnow"


def leer_sitemap(xml):
    """Devuelve {url: lastmod} de un sitemap (texto)."""
    if not xml:
        return {}
    raiz = ET.fromstring(xml)
    return {
        u.findtext("s:loc", "", NS).strip(): u.findtext("s:lastmod", "", NS).strip()
        for u in raiz.findall("s:url", NS)
    }


def git(*args):
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


def clave():
    for p in glob.glob(os.path.join(RAIZ, "*.txt")):
        nombre = os.path.basename(p)[:-4]
        if re.fullmatch(r"[a-f0-9]{32}", nombre):
            return nombre
    sys.exit("No hay archivo de clave IndexNow (<32 hex>.txt) en la raíz.")


def url_de_archivo(ruta, base):
    """blog/x.html -> base/blog/x.html ; index.html -> base/ ; a/index.html -> base/a/"""
    if not ruta.endswith(".html") or ruta.startswith(("tools/", ".")) or ruta == "404.html":
        return None
    if ruta == "index.html":
        return base
    if ruta.endswith("/index.html"):
        return base + ruta[: -len("index.html")]
    return base + ruta


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--desde", help="commit anterior (github.event.before)")
    g.add_argument("--todas", action="store_true")
    ap.add_argument("--simular", action="store_true", help="solo muestra las URLs")
    ap.add_argument("--esperar", type=int, default=300,
                    help="segundos máximos esperando que la clave esté publicada")
    a = ap.parse_args()

    actual = leer_sitemap(open(os.path.join(RAIZ, "sitemap.xml"), encoding="utf-8").read())
    if not actual:
        sys.exit("sitemap.xml vacío.")
    primera = next(iter(actual))
    m = re.match(r"(https?://[^/]+)/", primera)
    base, host = m.group(1) + "/", m.group(1).split("//")[1]

    k = clave()
    cambiados = [] if a.todas or not a.desde or set(a.desde) == {"0"} else \
        git("diff", "--name-only", a.desde, "HEAD").split()
    # Primer aviso (recién se agregó la clave) o pedido explícito: todo el sitemap.
    if a.todas or not cambiados and (not a.desde or set(a.desde) == {"0"}) or f"{k}.txt" in cambiados:
        urls = list(actual)
    else:
        anterior = leer_sitemap(git("show", f"{a.desde}:sitemap.xml"))
        urls = [u for u, lm in actual.items() if anterior.get(u, None) != lm]
        for ruta in cambiados:
            u = url_de_archivo(ruta, base)
            if u and (u in actual or u == base) and u not in urls:
                urls.append(u)
    if not urls:
        print("IndexNow: no hay URLs nuevas o modificadas.")
        return

    if a.simular:
        print(f"{host} ({len(urls)}):", *urls, sep="\n  ")
        return
    ubicacion = f"{base}{k}.txt"
    # La clave tiene que estar publicada antes de avisar: Bing la descarga para validar.
    fin = time.time() + a.esperar
    while True:
        try:
            with urllib.request.urlopen(ubicacion + f"?t={int(time.time())}", timeout=20) as r:
                if r.read().decode().strip() == k:
                    break
        except Exception:
            pass
        if time.time() > fin:
            sys.exit(f"La clave aún no responde en {ubicacion}; reintenta luego.")
        time.sleep(15)
    # Margen para que GitHub Pages termine de publicar las páginas nuevas.
    time.sleep(30)

    cuerpo = json.dumps({"host": host, "key": k, "keyLocation": ubicacion,
                         "urlList": urls[:10000]}).encode()
    req = urllib.request.Request(ENDPOINT, data=cuerpo, method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            estado = r.status
    except urllib.error.HTTPError as e:
        estado = e.code
    print(f"IndexNow {host}: {len(urls)} URL(s) -> HTTP {estado}")
    for u in urls[:50]:
        print("  ", u)
    if estado not in (200, 202):
        sys.exit(1)


if __name__ == "__main__":
    main()
