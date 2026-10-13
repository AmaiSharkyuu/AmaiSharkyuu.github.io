"""Recopie l'en-tête et le pied de page communs dans toutes les pages d'AmaiCraft.

Les gabarits sont dans layout/header.html et layout/footer.html. Dans chaque page, ils
sont placés entre des marqueurs <!-- ac:header --> ... <!-- /ac:header --> (pareil pour
footer et head). Après avoir modifié un gabarit, relancer :

    python tools/sync-layout.py
"""
from pathlib import Path
import re
import sys

SITE = Path(__file__).resolve().parent.parent

# page -> (chemin vers la racine du site, image de Steve dans le pied de page)
PAGES = {
    'index.html': ('', 'steverunning.gif'),
    'mentions-legales.html': ('', 'steverunning.gif'),
    'recipecraft/index.html': ('../', 'steverunning.gif'),
    'commands/index.html': ('../', 'steverunning.gif'),
    'music/index.html': ('../', 'steverunning.gif'),
    'Mobs/index.html': ('../', 'steverunning.gif'),
    'Game/index.html': ('../', 'Game/Steve_Chair.gif'),
    'Capes/index.html': ('../', 'steverunning.gif'),
}

HEAD = '''<link rel="preload" href="{root}Minecraftia.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="{root}site.css">
<script src="{root}site.js" defer></script>
'''


def render(template, root, steve):
    return template.replace('{root}', root).replace('{steve}', steve)


def put(html, name, content):
    """Remplace le contenu entre les marqueurs <!-- ac:name --> et <!-- /ac:name -->."""
    pattern = re.compile(r'(<!-- ac:%s -->\n).*?(<!-- /ac:%s -->)' % (name, name), re.S)
    if not pattern.search(html):
        raise ValueError('marqueurs ac:%s introuvables' % name)
    return pattern.sub(lambda m: m.group(1) + content + m.group(2), html, count=1)


def main():
    header = (SITE / 'layout' / 'header.html').read_text(encoding='utf-8')
    footer = (SITE / 'layout' / 'footer.html').read_text(encoding='utf-8')
    for page, (root, steve) in PAGES.items():
        path = SITE / page
        html = path.read_text(encoding='utf-8')
        new = put(html, 'head', render(HEAD, root, steve))
        new = put(new, 'header', render(header, root, steve))
        new = put(new, 'footer', render(footer, root, steve))
        if new != html:
            path.write_text(new, encoding='utf-8')
            print('mis à jour :', page)
        else:
            print('déjà à jour :', page)


if __name__ == '__main__':
    sys.exit(main())
