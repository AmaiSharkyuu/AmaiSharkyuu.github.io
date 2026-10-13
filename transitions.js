/* AmaiCraft : transitions entre les pages
   - liens internes : on passe dans un portail du Nether (la page ondule, le violet monte),
     et la page suivante sort du portail
   - HOME depuis une autre page : la page part dans le siphon, l'accueil tombe du ciel
   - WIKI : un enchaînement absurde ; GUIDES : une ouverture sobre
   - Buy me a Coffee : une petite scène avec Steve, un villageois et une blague
   - Mentions légales : une bande-annonce de film beaucoup trop épique pour ce que c'est
   - lien data-transition="void" (les Archives ARG) : la page bugue et se fait corrompre */
(function () {
    const base = new URL('.', document.currentScript.src);
    const asset = (path) => new URL(path, base).href;
    const KEY = 'amai-transition';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 'portal' ou 'goofy' : la transition par laquelle on arrive sur cette page
    let arriving = null;
    try {
        arriving = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
    } catch (e) {}

    // petites textures en pixel art dessinées ici ; rows = lignes de caractères, colors = couleur par caractère
    function pixelArt(rows, colors) {
        const canvas = document.createElement('canvas');
        canvas.width = rows[0].length;
        canvas.height = rows.length;
        const ctx = canvas.getContext('2d');
        rows.forEach((row, y) => [...row].forEach((char, x) => {
            if (!colors[char]) return;
            ctx.fillStyle = colors[char];
            ctx.fillRect(x, y, 1, 1);
        }));
        return canvas.toDataURL();
    }

    // texture 16x16 générée par une fonction (x, y) -> couleur
    function texture(colorAt) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 16;
        const ctx = canvas.getContext('2d');
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = colorAt(x, y);
                ctx.fillRect(x, y, 1, 1);
            }
        }
        return canvas.toDataURL();
    }

    let seed = 1337;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };

    const dirtColors = ['#593d29', '#6c4a32', '#79553a', '#79553a', '#866043', '#866043', '#866043', '#966c4a', '#966c4a', '#b9855c'];
    const dirt = texture(() => dirtColors[Math.floor(rand() * dirtColors.length)]);

    // tourbillon violet façon portail du Nether
    const portalColors = ['#1e0450', '#2c0670', '#3f0a8a', '#5b13b5', '#7a2bd8', '#a352ff'];
    const portal = texture((x, y) => {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const swirl = Math.sin(Math.hypot(dx, dy) * 1.3 + Math.atan2(dy, dx) * 2) * 0.5 + 0.5;
        const i = Math.min(portalColors.length - 1, Math.floor((swirl * 0.8 + rand() * 0.35) * portalColors.length));
        return portalColors[i];
    });

    const cup = pixelArt([
        '...s..s.....',
        '....s..s....',
        '...s..s.....',
        '............',
        'oooooooooo..',
        'owwwwwwwwo..',
        'obbbbbbbbooo',
        'owwwwwwwwo.o',
        'owwwwwwwwo.o',
        'owwwwwwwwooo',
        '.owwwwwwo...',
        '..oooooo....'
    ], { s: 'rgba(255,255,255,0.7)', o: '#2b1a0e', w: '#f4f4f4', b: '#5a3a22' });

    // la page d'accueil = le dossier où se trouve ce script
    const isHome = (url) => url.pathname === base.pathname || url.pathname === base.pathname + 'index.html';

    const style = document.createElement('style');
    style.textContent = `
@font-face {
    font-family: 'Minecraftia';
    src: local('Minecraftia'), url('${asset('Minecraftia.woff')}') format('woff');
}

/* cache la page dès le début quand on arrive par le portail */
html.pt-cover::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: url('${portal}') 0 0 / 96px 96px, #3f0a8a;
    image-rendering: pixelated;
}

.pt-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    overflow: hidden;
    pointer-events: auto;
}

/* ---------- PORTAIL ---------- */
.pt-portal {
    position: fixed;
    inset: 0;
    z-index: 10000;
    overflow: hidden;
    pointer-events: auto;
    image-rendering: pixelated;
    background: url('${portal}') 0 0 / 96px 96px, #2c0670;
    animation: pt-flow 1.6s linear infinite;
}

/* deuxième couche qui coule dans l'autre sens, et bords plus sombres */
.pt-portal::before, .pt-portal::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.pt-portal::before {
    background: url('${portal}') 0 0 / 150px 150px;
    image-rendering: pixelated;
    mix-blend-mode: screen;
    opacity: 0.35;
    animation: pt-flow-back 2.2s linear infinite;
}

.pt-portal::after {
    background: radial-gradient(ellipse at center, transparent 35%, rgba(10, 0, 30, 0.75) 100%);
}

@keyframes pt-flow { to { background-position: 96px -96px, 0 0; } }
@keyframes pt-flow-back { to { background-position: -150px 150px; } }

.pt-particle {
    position: absolute;
    width: var(--p);
    height: var(--p);
    background: var(--c);
    box-shadow: 0 0 6px var(--c);
}

.pt-portal-text {
    position: absolute;
    left: 50%;
    bottom: 16%;
    transform: translateX(-50%);
    font-family: 'Minecraftia', monospace;
    font-size: clamp(14px, 2.6vw, 24px);
    color: #fff;
    text-shadow: 2px 2px 0 #2a0055;
    white-space: nowrap;
    text-align: center;
    z-index: 1;
    padding: 10px 22px;
    background: rgba(10, 0, 30, 0.6);
}

.pt-portal-text b {
    display: block;
    font-weight: normal;
    font-size: 1.8em;
    color: #e6c8ff;
}

/* ---------- COFFEE ---------- */
.pt-coffee {
    position: fixed;
    inset: 0;
    z-index: 10000;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
    background: repeating-conic-gradient(from var(--pt-a) at 50% 62%, #6f4e37 0 12deg, #c8a27a 12deg 24deg);
    animation: pt-coffee-spin 1.2s linear infinite;
}

@keyframes pt-coffee-spin { to { --pt-a: 24deg; } }

.pt-floor {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 22vh;
    background:
        linear-gradient(#6aa83a 0 14px, #4f8a2a 14px 22px, transparent 22px),
        url('${dirt}') 0 0 / 64px 64px;
    image-rendering: pixelated;
    border-top: 4px solid #2f5a17;
}

.pt-cup-x {
    position: absolute;
    left: 0;
    top: 0;
    animation: pt-bounce-x var(--dx) linear infinite alternate;
}

.pt-cup-x img {
    display: block;
    width: var(--s);
    image-rendering: pixelated;
    animation: pt-bounce-y var(--dy) linear infinite alternate, pt-tilt 0.6s ease-in-out infinite alternate;
}

@keyframes pt-bounce-x { to { transform: translateX(calc(100vw - var(--s))); } }
@keyframes pt-bounce-y { to { transform: translateY(calc(78vh - var(--s))); } }
@keyframes pt-tilt { from { rotate: -12deg; } to { rotate: 12deg; } }

.pt-actor {
    position: absolute;
    bottom: var(--ground, 22vh);
    image-rendering: pixelated;
}

.pt-chat {
    position: absolute;
    bottom: calc(var(--ground, 22vh) + var(--h) + 14px);
    max-width: 42vw;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.72);
    font-family: 'Minecraftia', monospace;
    font-size: clamp(11px, 1.6vw, 17px);
    line-height: 1.5;
    color: #fff;
}

.pt-chat i {
    font-style: normal;
    color: #ffff55;
}

.pt-coffee-title {
    position: absolute;
    left: 50%;
    top: 12%;
    transform: translateX(-50%);
    font-family: 'Minecraftia', monospace;
    font-size: clamp(22px, 5.5vw, 60px);
    color: #fff;
    text-shadow: 4px 4px 0 #3a2414;
    white-space: nowrap;
    text-align: center;
}

.pt-coffee-title small {
    display: block;
    font-size: 0.35em;
    color: #ffe9c9;
}

.pt-skip {
    position: absolute;
    right: 12px;
    top: 10px;
    font-family: 'Minecraftia', monospace;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.75);
}

/* ---------- MENTIONS LÉGALES (cinématique) ---------- */
html.pt-cover-cinema::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: #000;
}

.pt-cinema {
    --ground: 14vh;
    position: fixed;
    inset: 0;
    z-index: 10000;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
}

.pt-cinema-black {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 55%, #1a1408 0%, #000 70%);
    opacity: 0;
}

.pt-bar-top, .pt-bar-bottom {
    position: absolute;
    left: 0;
    right: 0;
    height: 12vh;
    background: #000;
    z-index: 3;
}

.pt-bar-top    { top: 0; }
.pt-bar-bottom { bottom: 0; }

.pt-card {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    font-family: 'Minecraftia', monospace;
    font-size: clamp(16px, 3.4vw, 38px);
    letter-spacing: 0.35em;
    text-align: center;
    color: #f3e3c0;
    text-shadow: 0 0 18px rgba(255, 170, 60, 0.55);
    z-index: 2;
}

.pt-title {
    font-size: clamp(30px, 7.5vw, 92px);
    letter-spacing: 0.12em;
    background: linear-gradient(180deg, #fff6d8 0%, #ffd36b 45%, #b8741a 55%, #ffe39a 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: none;
    filter: drop-shadow(0 0 22px rgba(255, 160, 40, 0.6));
}

.pt-title small {
    display: block;
    margin-top: 10px;
    font-size: 0.22em;
    letter-spacing: 0.6em;
    color: #c9b48a;
    -webkit-text-fill-color: #c9b48a;
}

.pt-flare {
    position: absolute;
    left: -60%;
    top: 50%;
    width: 220%;
    height: 3px;
    background: linear-gradient(90deg, transparent 30%, rgba(255, 230, 170, 0.95) 50%, transparent 70%);
    box-shadow: 0 0 30px 8px rgba(255, 190, 90, 0.35);
    z-index: 2;
}

.pt-ember {
    position: absolute;
    width: var(--p);
    height: var(--p);
    background: #ffae3b;
    box-shadow: 0 0 8px #ff7b00;
    z-index: 1;
}

.pt-spot {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse 30% 55% at 30% 100%, rgba(255, 240, 200, 0.22), transparent 70%),
        radial-gradient(ellipse 30% 55% at 70% 100%, rgba(255, 240, 200, 0.22), transparent 70%);
    opacity: 0;
}

.pt-nametag {
    position: absolute;
    bottom: calc(var(--ground) + var(--h) + 8px);
    transform: translateX(-50%);
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.55);
    font-family: 'Minecraftia', monospace;
    font-size: clamp(11px, 1.5vw, 16px);
    color: #fff;
    white-space: nowrap;
}

.pt-coffee-open {
    position: absolute;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    padding: 12px 22px;
    font-family: 'Minecraftia', monospace;
    font-size: 18px;
    color: #fff;
    background: #8b8b8b;
    border: 3px solid #000;
    box-shadow: inset 3px 3px 0 #dbdbdb, inset -3px -3px 0 #555;
    cursor: pointer;
}

/* ---------- VOID (ARG) ---------- */
.pt-cell {
    opacity: 0;
    background: var(--c);
    animation: pt-cell 0.16s steps(2) var(--d) forwards;
}

@keyframes pt-cell {
    0%   { opacity: 0; }
    50%  { opacity: 1; background: #ff2020; }
    100% { opacity: 1; }
}

.pt-scan, .pt-grain {
    position: absolute;
    inset: 0;
    opacity: 0;
}

.pt-scan {
    background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 3px);
    transition: opacity 0.3s 0.3s;
}

.pt-grain {
    inset: -40px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: pt-grain 0.4s steps(4) infinite;
    transition: opacity 0.3s 0.5s;
}

.pt-void.pt-on .pt-scan  { opacity: 1; }
.pt-void.pt-on .pt-grain { opacity: 0.12; }

@keyframes pt-grain {
    0%   { transform: translate(0, 0); }
    25%  { transform: translate(-30px, 20px); }
    50%  { transform: translate(20px, -35px); }
    75%  { transform: translate(-10px, 30px); }
    100% { transform: translate(0, 0); }
}

.pt-text {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Minecraftia', monospace;
    font-size: clamp(18px, 5vw, 46px);
    color: #ff3b3b;
    text-shadow: 3px 3px 0 #3f0000;
    white-space: nowrap;
    letter-spacing: 2px;
    opacity: 0;
    animation: pt-text-in 0.5s steps(5) 0.75s forwards;
}

.pt-text small {
    display: block;
    margin-top: 10px;
    font-size: 0.32em;
    color: #8a8a8a;
    text-shadow: none;
    text-align: center;
    letter-spacing: 4px;
}

.pt-text::before, .pt-text::after {
    content: attr(data-text);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    text-shadow: none;
}

.pt-text::before { color: #00ffff; mix-blend-mode: screen; animation: pt-split 0.3s steps(2) infinite; }
.pt-text::after  { color: #ff00ff; mix-blend-mode: screen; animation: pt-split 0.25s steps(2) infinite reverse; }

@keyframes pt-text-in {
    0%   { opacity: 0; }
    20%  { opacity: 1; }
    40%  { opacity: 0; }
    60%  { opacity: 1; }
    80%  { opacity: 0.4; }
    100% { opacity: 1; }
}

@keyframes pt-split {
    0%   { transform: translate(-4px, 0);    clip-path: inset(0 0 60% 0); }
    50%  { transform: translate(4px, 2px);   clip-path: inset(45% 0 10% 0); }
    100% { transform: translate(-2px, -2px); clip-path: inset(20% 0 40% 0); }
}

/* le reste de la page tremble et se décale avant d'être recouvert */
body.pt-glitching > :not(.pt-overlay):not(.steve-animation):not(script):not(style) {
    animation: pt-glitch 0.6s steps(1) forwards;
}

@keyframes pt-glitch {
    0%   { transform: none; filter: none; }
    12%  { transform: translate(-8px, 3px) skewX(6deg); filter: hue-rotate(140deg) saturate(3); }
    24%  { transform: translate(6px, -2px); filter: invert(1) contrast(1.5); }
    36%  { transform: translate(-3px, 0); clip-path: inset(15% 0 45% 0); filter: none; }
    48%  { transform: translate(10px, 4px) skewX(-8deg); clip-path: none; filter: saturate(0) brightness(1.6); }
    60%  { transform: translate(-5px, -3px); filter: hue-rotate(-90deg) contrast(2); }
    72%  { transform: translate(3px, 0); clip-path: inset(55% 0 5% 0); filter: brightness(0.6) sepia(1) hue-rotate(-40deg) saturate(5); }
    86%  { transform: none; clip-path: none; filter: brightness(0.4) sepia(1) hue-rotate(-40deg) saturate(6); }
    100% { transform: none; filter: brightness(0.25) sepia(1) hue-rotate(-40deg) saturate(6); }
}

/* ---------- HOME (goofy) ---------- */
@property --pt-a {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
}

html.pt-sun {
    background: repeating-conic-gradient(from var(--pt-a) at 50% 50%, #ffe14d 0 10deg, #ff7ad9 10deg 20deg) fixed;
    animation: pt-sunspin 0.5s linear infinite;
    overflow: hidden;
}

html.pt-cover-goofy::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: repeating-conic-gradient(at 50% 50%, #ffe14d 0 10deg, #ff7ad9 10deg 20deg);
}

@keyframes pt-sunspin { to { --pt-a: 20deg; } }

/* pendant qu'on la déforme, la page doit remplir l'écran, sinon le pied de page
   (fixe) se recolle au bas du contenu et la page ne touche pas le sol */
body.pt-flush, body.pt-boing, body.pt-full {
    min-height: 100vh;
}

/* la page fait la gelée puis part dans le siphon */
body.pt-flush {
    animation: pt-flush 1.25s forwards;
}

@keyframes pt-flush {
    /* mêmes fonctions à chaque étape, sinon les 4 tours s'annulent dans l'interpolation */
    0%   { transform: rotate(0deg) scale(1, 1); animation-timing-function: ease-out; }
    10%  { transform: rotate(0deg) scale(1.18, 0.82); }
    20%  { transform: rotate(0deg) scale(0.84, 1.16); }
    30%  { transform: rotate(0deg) scale(1.08, 0.92); }
    40%  { transform: rotate(0deg) scale(1, 1); animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.6); }
    100% { transform: rotate(1440deg) scale(0, 0); }
}

/* l'accueil tombe du ciel et s'écrase */
body.pt-boing {
    animation: pt-boing 0.95s;
}

@keyframes pt-boing {
    0%   { transform: translateY(-110vh) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }
    45%  { transform: translateY(0) scale(1.25, 0.7); animation-timing-function: ease-out; }
    60%  { transform: translateY(-6vh) scale(0.88, 1.14); animation-timing-function: ease-in; }
    75%  { transform: translateY(0) scale(1.1, 0.9); }
    88%  { transform: translateY(0) scale(0.97, 1.03); }
    100% { transform: translateY(0) scale(1, 1); }
}

.pt-goofy-layer {
    position: fixed;
    inset: 0;
    z-index: 10000;
    overflow: hidden;
    pointer-events: auto;
}

.pt-parrot {
    position: absolute;
    top: 0;
    left: var(--x);
    width: var(--s);
    image-rendering: pixelated;
    transform: translateY(-150%);
    animation: pt-drop 1.1s var(--d) forwards;
}

@keyframes pt-drop {
    0%   { transform: translateY(-150%) rotate(0); animation-timing-function: ease-in; }
    45%  { transform: translateY(calc(100vh - var(--s))) rotate(calc(var(--r) * 0.5)); animation-timing-function: ease-out; }
    65%  { transform: translateY(55vh) rotate(calc(var(--r) * 0.8)); animation-timing-function: ease-in; }
    82%  { transform: translateY(calc(100vh - var(--s))) rotate(var(--r)); animation-timing-function: ease-out; }
    91%  { transform: translateY(calc(85vh - var(--s))) rotate(var(--r)); animation-timing-function: ease-in; }
    100% { transform: translateY(calc(100vh - var(--s))) rotate(var(--r)); }
}

.pt-home {
    position: absolute;
    left: 50%;
    top: 40%;
    font-family: 'Minecraftia', monospace;
    font-size: clamp(28px, 8vw, 88px);
    white-space: nowrap;
    transform: translate(-50%, -50%) scale(0);
    animation: pt-pop 0.5s cubic-bezier(0.3, 1.8, 0.5, 1) 0.55s forwards;
}

.pt-home span {
    display: inline-block;
    text-shadow: 4px 4px 0 #000;
    animation: pt-wave 0.5s ease-in-out calc(var(--i) * -0.06s) infinite alternate;
}

@keyframes pt-pop {
    0%   { transform: translate(-50%, -50%) scale(0) rotate(-30deg); }
    100% { transform: translate(-50%, -50%) scale(1) rotate(-6deg); }
}

@keyframes pt-wave {
    from { transform: translateY(-12px) rotate(-8deg); }
    to   { transform: translateY(12px) rotate(8deg); }
}

/* ---------- WIKI (n'importe quoi) ---------- */
body.pt-comic, body.pt-comic * {
    font-family: 'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', cursive !important;
}

body.pt-comic {
    animation: pt-hue 0.5s linear infinite;
}

@keyframes pt-hue { to { filter: hue-rotate(360deg) saturate(2); } }

.pt-caption {
    position: absolute;
    left: 50%;
    top: 14%;
    transform: translateX(-50%);
    font-family: 'Minecraftia', monospace;
    font-size: clamp(20px, 5vw, 54px);
    color: #fff;
    text-shadow: 4px 4px 0 #000;
    white-space: nowrap;
}

.pt-mob {
    position: absolute;
    image-rendering: pixelated;
}

.pt-bubble {
    position: absolute;
    background: #fff;
    color: #000;
    border: 4px solid #000;
    padding: 6px 16px;
    font-family: 'Comic Sans MS', 'Comic Sans', cursive;
    font-size: clamp(18px, 3.5vw, 34px);
    font-weight: bold;
    white-space: nowrap;
}

.pt-bubble::after {
    content: '';
    position: absolute;
    left: 24px;
    bottom: -20px;
    border: 10px solid transparent;
    border-top-color: #000;
}

.pt-wikibar {
    position: absolute;
    left: 50%;
    top: 62%;
    transform: translateX(-50%);
    width: min(420px, 80vw);
    height: 14px;
    background: #808080;
    border: 3px solid #000;
}

.pt-wikibar span {
    display: block;
    height: 100%;
    background: #80ff20;
}

/* ---------- GUIDES (sobre) ---------- */
.pt-guide {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(18, 18, 18, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
}

.pt-guide-panel {
    background: #c6c6c6;
    border: 4px solid #000;
    box-shadow: inset 4px 4px 0 #fff, inset -4px -4px 0 #555;
    padding: 22px 30px;
    min-width: min(360px, 84vw);
    font-family: 'Minecraftia', monospace;
    color: #3f3f3f;
    text-align: center;
}

.pt-guide-panel strong {
    display: block;
    font-size: 18px;
    color: #1d1d1d;
}

.pt-guide-panel small {
    display: block;
    margin: 6px 0 14px;
    font-size: 11px;
    color: #555;
}

.pt-guide-panel .pt-bar {
    height: 8px;
    background: #808080;
    border: 2px solid #000;
}

.pt-guide-panel .pt-bar span {
    display: block;
    width: 0;
    height: 100%;
    background: #80ff20;
}

@media (prefers-reduced-motion: reduce) {
    body.pt-glitching > * { animation: none !important; }
    .pt-cell { animation: none; opacity: 1; }
    .pt-text, .pt-text::before, .pt-text::after, .pt-grain { animation: none; opacity: 1; }
}
`;
    document.head.appendChild(style);

    const root = document.documentElement;
    if (!['goofy', 'portal', 'cinema'].includes(arriving)) arriving = null;
    if (arriving && !reduced) {
        root.classList.add({ goofy: 'pt-cover-goofy', cinema: 'pt-cover-cinema', portal: 'pt-cover' }[arriving]);
        // filet de sécurité : la page ne reste jamais cachée
        setTimeout(() => root.classList.remove('pt-cover', 'pt-cover-goofy', 'pt-cover-cinema'), 4000);
    }

    // grille de cases qui couvre l'écran, avec un délai par case selon la distance à "origin"
    function grid(className, size, origin, spread, jitter, fill) {
        const overlay = document.createElement('div');
        overlay.className = 'pt-overlay ' + className;
        overlay.setAttribute('aria-hidden', 'true');
        const cols = Math.ceil(window.innerWidth / size);
        const rows = Math.ceil(window.innerHeight / size);
        const maxDist = Math.hypot(window.innerWidth, window.innerHeight);
        overlay.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
        overlay.style.gridAutoRows = size + 'px';

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const cell = document.createElement('div');
                const dist = Math.hypot(x * size + size / 2 - origin.x, y * size + size / 2 - origin.y);
                const delay = spread[0] + (dist / maxDist) * spread[1] + Math.random() * jitter;
                cell.style.setProperty('--d', delay.toFixed(3) + 's');
                fill(cell);
                overlay.appendChild(cell);
            }
        }
        document.body.appendChild(overlay);
        return overlay;
    }

    // effet "nausée" du jeu : une carte de déplacement SVG appliquée à <html>
    // (sur la racine, un filtre ne décroche pas les éléments en position: fixed)
    function nausea(from, to, duration) {
        let svg = document.getElementById('pt-nausea-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'pt-nausea-svg';
            svg.setAttribute('width', '0');
            svg.setAttribute('height', '0');
            svg.setAttribute('aria-hidden', 'true');
            svg.style.position = 'absolute';
            svg.innerHTML = '<filter id="pt-nausea" x="-10%" y="-10%" width="120%" height="120%">'
                + '<feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7"/>'
                + '<feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/>'
                + '</filter>';
            document.body.appendChild(svg);
        }
        const turbulence = svg.querySelector('feTurbulence');
        const map = svg.querySelector('feDisplacementMap');
        root.style.filter = 'url(#pt-nausea)';
        root.style.backgroundColor = '#2c0670';
        const t0 = performance.now();
        const step = (now) => {
            const k = Math.min(1, (now - t0) / duration);
            map.setAttribute('scale', (from + (to - from) * k).toFixed(1));
            turbulence.setAttribute('baseFrequency', `${(0.006 + 0.002 * Math.sin(now / 90)).toFixed(4)} ${(0.012 + 0.004 * Math.cos(now / 120)).toFixed(4)}`);
            if (k < 1) {
                requestAnimationFrame(step);
            } else if (to === 0) {
                root.style.filter = '';
                root.style.backgroundColor = '';
            }
        };
        requestAnimationFrame(step);
        // si l'onglet passe en arrière-plan, requestAnimationFrame s'arrête : on retire quand même le filtre
        if (to === 0) {
            setTimeout(() => {
                root.style.filter = '';
                root.style.backgroundColor = '';
            }, duration + 400);
        }
    }

    function portalParticles(layer, count, inward) {
        const colors = ['#c58bff', '#a352ff', '#e6c8ff', '#7a2bd8'];
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        for (let i = 0; i < count; i++) {
            const dot = el('div', 'pt-particle', layer);
            dot.style.setProperty('--p', Math.round(4 + rand() * 7) + 'px');
            dot.style.setProperty('--c', colors[i % colors.length]);
            const x = rand() * window.innerWidth;
            const y = rand() * window.innerHeight;
            const swirl = (rand() - 0.5) * 240;
            const near = `translate(${cx + swirl}px, ${cy + swirl * 0.5}px) scale(0.3)`;
            const far = `translate(${x}px, ${y}px) scale(1)`;
            dot.animate(
                [{ transform: inward ? far : near, opacity: inward ? 0 : 1 }, { transform: inward ? near : far, opacity: inward ? 1 : 0 }],
                { duration: 700 + rand() * 500, delay: rand() * 250, easing: 'ease-in-out', fill: 'both' }
            );
        }
    }

    function portalLeave(link) {
        const card = link.querySelector('strong');
        const name = (card ? card.textContent : link.textContent).trim();
        const layer = el('div', 'pt-portal');
        layer.setAttribute('aria-hidden', 'true');
        const label = el('div', 'pt-portal-text', layer);
        label.innerHTML = 'Travelling to<b></b>';
        label.querySelector('b').textContent = name;
        root.appendChild(layer);
        portalParticles(layer, 34, true);

        layer.animate([{ opacity: 0 }, { opacity: 0.35, offset: 0.45 }, { opacity: 1 }], { duration: 850, easing: 'ease-in', fill: 'forwards' });
        label.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(10px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 300, delay: 350, fill: 'both' });
        document.body.classList.add('pt-full');
        document.body.style.transformOrigin = `${window.scrollX + window.innerWidth / 2}px ${window.scrollY + window.innerHeight / 2}px`;
        document.body.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }], { duration: 950, easing: 'ease-in', fill: 'forwards' });
        nausea(0, 45, 900);

        // le bourdonnement du portail
        const tone = makeSfx(2000);
        tone('sawtooth', 0, 1.1, 70, 140, 0.06, 6);
        tone('triangle', 0.1, 1, 260, 820, 0.05, 12);
    }

    function portalArrive() {
        const layer = el('div', 'pt-portal');
        layer.setAttribute('aria-hidden', 'true');
        root.appendChild(layer);
        root.classList.remove('pt-cover');
        portalParticles(layer, 24, false);
        layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: 80, easing: 'ease-out', fill: 'forwards' });
        nausea(40, 0, 800);
        setTimeout(() => layer.remove(), 900);
    }

    function voidLeave(origin) {
        const colors = ['#000', '#000', '#070000', '#140000', '#250000', '#3f0000', '#5a0000'];
        const size = Math.max(36, Math.round(window.innerWidth / 28));
        const overlay = grid('pt-void', size, origin, [0.12, 0.6], 0.22, (cell) => {
            cell.className = 'pt-cell';
            cell.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
        });
        const scan = document.createElement('div');
        scan.className = 'pt-scan';
        const grain = document.createElement('div');
        grain.className = 'pt-grain';
        const text = document.createElement('div');
        text.className = 'pt-text';
        text.dataset.text = 'ENTERING THE VOID';
        text.innerHTML = 'ENTERING THE VOID<small>[ERR] signal lost</small>';
        overlay.append(scan, grain, text);
        void overlay.offsetWidth;
        overlay.classList.add('pt-on');
        document.body.classList.add('pt-glitching');
    }

    // petits sons synthétisés (pas de fichier son)
    // tone(type, dans combien de secondes, durée, fréquence de départ, fréquence d'arrivée, volume, vibrato)
    function makeSfx(lifetime) {
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            setTimeout(() => ac.close(), lifetime);
            return (type, start, dur, from, to, vol, wobble) => {
                const t = ac.currentTime + start;
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(from, t);
                osc.frequency.exponentialRampToValueAtTime(to, t + dur);
                if (wobble) {
                    const lfo = ac.createOscillator();
                    const depth = ac.createGain();
                    lfo.frequency.value = 22;
                    depth.gain.value = wobble;
                    lfo.connect(depth).connect(osc.frequency);
                    lfo.start(t);
                    lfo.stop(t + dur);
                }
                gain.gain.setValueAtTime(vol, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
                osc.connect(gain).connect(ac.destination);
                osc.start(t);
                osc.stop(t + dur);
            };
        } catch (e) {
            return () => {};
        }
    }

    // boing + sifflet de dessin animé
    function goofySounds() {
        const tone = makeSfx(2500);
        tone('sine', 0, 0.45, 110, 520, 0.25, 60);
        tone('triangle', 0.5, 0.75, 1500, 160, 0.12);
        tone('square', 1.3, 0.12, 900, 1400, 0.05);
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // nouvel onglet comme le lien d'origine ; si le navigateur le bloque, on ouvre ici
    function openTab(href) {
        const tab = window.open(href, '_blank');
        if (tab) {
            try { tab.opener = null; } catch (e) {}
        } else {
            window.location.href = href;
        }
    }

    // remet la page dans son état normal (on reste sur cet onglet après WIKI et GUIDES)
    function cleanup() {
        const body = document.body;
        body.getAnimations().forEach((a) => a.cancel());
        body.classList.remove('pt-glitching', 'pt-flush', 'pt-boing', 'pt-full', 'pt-comic');
        body.style.transformOrigin = '';
        root.classList.remove('pt-cover', 'pt-cover-goofy', 'pt-cover-cinema', 'pt-sun');
        root.getAnimations().forEach((a) => a.cancel());
        root.style.filter = '';
        root.style.backgroundColor = '';
        document.querySelectorAll('.pt-overlay, .pt-goofy-layer, .pt-guide, .pt-portal, .pt-coffee, .pt-cinema').forEach((el) => el.remove());
        leaving = false;
    }

    function el(tag, className, parent) {
        const node = document.createElement(tag);
        node.className = className;
        if (parent) parent.appendChild(node);
        return node;
    }

    // apparition qui rebondit, ajoutée par-dessus la position déjà en place
    function pop(node) {
        node.animate([
            { transform: 'scale(0) rotate(-20deg)' },
            { transform: 'scale(1.2) rotate(6deg)', offset: 0.7 },
            { transform: 'scale(1) rotate(0deg)' }
        ], { duration: 280, easing: 'ease-out', composite: 'add' });
    }

    // WIKI : un enchaînement de trucs qui n'ont aucun sens, puis le wiki s'ouvre
    async function wikiChaos(href) {
        const body = document.body;
        const tone = makeSfx(6000);
        const layer = el('div', 'pt-goofy-layer');
        layer.setAttribute('aria-hidden', 'true');
        root.appendChild(layer);
        body.classList.add('pt-full');
        body.style.transformOrigin = `${window.scrollX + window.innerWidth / 2}px ${window.scrollY + window.innerHeight / 2}px`;

        const caption = el('div', 'pt-caption', layer);
        const say = (text) => {
            caption.textContent = text;
            pop(caption);
        };
        const spin = (from, to, duration, easing) => body.animate(
            [{ transform: from }, { transform: to }],
            { duration, easing, fill: 'forwards' }
        );

        // 1. la page se retourne
        tone('sine', 0, 0.3, 300, 900, 0.2);
        spin('rotate(0deg) scale(1, 1)', 'rotate(180deg) scale(1, 1)', 380, 'cubic-bezier(0.3, 1.8, 0.5, 1)');
        say('oops wrong way');
        await sleep(600);

        // 2. on la "répare"... en miroir
        tone('sine', 0, 0.3, 900, 300, 0.2);
        spin('rotate(180deg) scale(1, 1)', 'rotate(360deg) scale(-1, 1)', 380, 'cubic-bezier(0.3, 1.8, 0.5, 1)');
        say('fixed it');
        await sleep(550);

        // 3. livraison de cochon
        say('PIG DELIVERY');
        tone('square', 0, 0.18, 220, 200, 0.08);
        tone('square', 0.22, 0.18, 220, 200, 0.08);
        const pig = el('img', 'pt-mob', layer);
        pig.src = asset('Mobs/mob/passive/pig.png');
        pig.alt = '';
        pig.style.width = '34vmin';
        pig.style.top = '40%';
        pig.style.left = '0';
        pig.animate([
            { transform: 'translateX(-40vmin) rotate(0deg)' },
            { transform: `translateX(${window.innerWidth / 2}px) translateY(-8vh) rotate(-15deg)`, offset: 0.5 },
            { transform: `translateX(${window.innerWidth + 50}px) rotate(20deg)` }
        ], { duration: 700, easing: 'linear', fill: 'forwards' });
        await sleep(650);

        // 4. tout passe en Comic Sans arc-en-ciel
        say('comic sans mode: ON');
        tone('triangle', 0, 0.12, 600, 1200, 0.12);
        tone('triangle', 0.12, 0.12, 900, 1800, 0.12);
        body.classList.add('pt-comic');
        await sleep(600);

        // 5. la poule fait meuh, la vache fait cot cot
        say('');
        const chicken = el('img', 'pt-mob', layer);
        chicken.src = asset('Mobs/mob/passive/chicken.png');
        chicken.alt = '';
        chicken.style.cssText = 'width: 22vmin; left: 14%; bottom: 8%;';
        pop(chicken);
        const moo = el('div', 'pt-bubble', layer);
        moo.textContent = 'moo.';
        moo.style.cssText = 'left: 14%; bottom: calc(8% + 25vmin);';
        pop(moo);
        tone('sawtooth', 0, 0.6, 140, 95, 0.12, 8);
        await sleep(450);

        const cow = el('img', 'pt-mob', layer);
        cow.src = asset('Mobs/mob/passive/cow.png');
        cow.alt = '';
        cow.style.cssText = 'width: 26vmin; right: 12%; bottom: 8%;';
        pop(cow);
        const cluck = el('div', 'pt-bubble', layer);
        cluck.textContent = 'cluck cluck';
        cluck.style.cssText = 'right: 12%; bottom: calc(8% + 29vmin);';
        pop(cluck);
        tone('square', 0, 0.07, 1200, 900, 0.06);
        tone('square', 0.12, 0.07, 1300, 950, 0.06);
        await sleep(550);

        // 6. la page part en spirale, chargement du wiki... à reculons
        root.classList.add('pt-sun');
        spin('rotate(360deg) scale(-1, 1)', 'rotate(1440deg) scale(0, 0)', 700, 'cubic-bezier(0.6, 0, 0.9, 0.6)');
        tone('triangle', 0, 0.7, 1500, 150, 0.12);
        [chicken, cow, moo, cluck].forEach((node) => node.animate(
            [{ transform: 'translateY(0)' }, { transform: 'translateY(-120vh) rotate(720deg)' }],
            { duration: 600, easing: 'ease-in', fill: 'forwards' }
        ));
        say('LOADING WIKI.EXE');
        const bar = el('div', 'pt-wikibar', layer);
        const fill = el('span', '', bar);
        fill.animate([{ width: '100%' }, { width: '70%' }, { width: '12%' }, { width: '0%' }], { duration: 650, fill: 'forwards', easing: 'steps(6)' });
        await sleep(750);

        say('ok fine. here.');
        tone('sine', 0, 0.1, 880, 880, 0.15);
        bar.remove();
        await sleep(350);

        openTab(href);
        cleanup();
    }

    // GUIDES : ouverture sobre, un cercle qui part du lien et une fenêtre Minecraft
    async function guideOpen(href, origin) {
        const overlay = el('div', 'pt-guide', document.body);
        overlay.setAttribute('aria-hidden', 'true');
        const panel = el('div', 'pt-guide-panel', overlay);
        panel.innerHTML = '<strong>Minecraft Guides</strong><small>opening minecraft.net in a new tab</small><div class="pt-bar"><span></span></div>';
        const at = `at ${origin.x}px ${origin.y}px`;
        const reveal = overlay.animate(
            [{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(150vmax ${at})` }],
            { duration: 450, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }
        );
        panel.animate([{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: 250, fill: 'backwards' });
        panel.querySelector('.pt-bar span').animate([{ width: '0%' }, { width: '100%' }], { duration: 450, delay: 350, easing: 'steps(10)', fill: 'forwards' });
        await sleep(850);
        openTab(href);
        reveal.reverse();
        await reveal.finished.catch(() => {});
        cleanup();
    }

    // un petit bonhomme posé au sol de la scène
    function sceneActor(layer, src, height, side, offset) {
        const img = el('img', 'pt-actor', layer);
        img.src = src;
        img.alt = '';
        img.style.height = height;
        img.style[side] = offset;
        return img;
    }

    // bulle de chat Minecraft qui s'écrit lettre par lettre ; isDone() arrête l'écriture si on passe la scène
    function sceneChat(layer, tone, isDone, who, text, side, offset, height) {
        const bubble = el('div', 'pt-chat', layer);
        bubble.style.setProperty('--h', height);
        bubble.style[side] = offset;
        bubble.innerHTML = '<i></i> ';
        bubble.querySelector('i').textContent = `<${who}>`;
        const line = document.createTextNode('');
        bubble.appendChild(line);
        pop(bubble);
        let n = 0;
        const timer = setInterval(() => {
            if (isDone() || n >= text.length) {
                clearInterval(timer);
                return;
            }
            line.data = text.slice(0, ++n);
            if (n % 3 === 0) tone('square', 0, 0.03, 700 + rand() * 300, 600, 0.03);
        }, 22);
        return bubble;
    }

    // Buy me a Coffee : Steve raconte une blague au villageois, un creeper s'incruste
    function coffeeScene(href) {
        const layer = el('div', 'pt-coffee');
        layer.setAttribute('aria-hidden', 'true');
        root.appendChild(layer);
        const tone = makeSfx(8000);
        let done = false;

        // fin de la scène : ouvre Ko-fi ; si le navigateur bloque l'onglet (la scène a duré trop
        // longtemps après le clic), un bouton prend le relais
        const finish = () => {
            if (done) return;
            done = true;
            const tab = window.open(href, '_blank');
            if (tab) {
                try { tab.opener = null; } catch (e) {}
                cleanup();
                return;
            }
            const button = el('button', 'pt-coffee-open', layer);
            button.type = 'button';
            button.textContent = 'Open Ko-fi';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                openTab(href);
                cleanup();
            });
            layer.addEventListener('click', () => cleanup(), { once: true });
        };
        // un clic pendant la scène la passe
        layer.addEventListener('click', finish);
        const wait = (ms) => sleep(ms).then(() => done);

        el('div', 'pt-skip', layer).textContent = 'click to skip';

        for (let i = 0; i < 5; i++) {
            const box = el('div', 'pt-cup-x', layer);
            const size = Math.round(40 + rand() * 40);
            box.style.setProperty('--s', size + 'px');
            box.style.setProperty('--dx', (1.1 + rand() * 1.4).toFixed(2) + 's');
            box.style.setProperty('--dy', (0.8 + rand() * 1.2).toFixed(2) + 's');
            box.style.animationDelay = (-rand() * 2).toFixed(2) + 's';
            const img = el('img', '', box);
            img.src = cup;
            img.alt = '';
        }

        const floor = el('div', 'pt-floor', layer);
        layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        floor.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.3, 1.5, 0.6, 1)' });

        const actor = (...args) => sceneActor(layer, ...args);
        const steve = actor(asset('steverunning.gif'), '24vmin', 'left', '16%');
        const villager = actor(asset('Mobs/mob/passive/villager.png'), '28vmin', 'right', '18%');
        steve.animate([{ transform: 'translateX(-60vw) scaleX(-1)' }, { transform: 'translateX(0) scaleX(-1)' }], { duration: 550, easing: 'ease-out', fill: 'forwards' });
        villager.animate([
            { transform: 'translateY(-60vh)' },
            { transform: 'translateY(0) scale(1.15, 0.85)', offset: 0.7 },
            { transform: 'translateY(0) scale(1, 1)' }
        ], { duration: 550, easing: 'ease-in', fill: 'forwards' });
        tone('sine', 0.35, 0.12, 300, 120, 0.15);

        const chat = (...args) => sceneChat(layer, tone, () => done, ...args);

        (async () => {
            if (await wait(550)) return;
            const line1 = chat('Steve', 'Why do I never put milk in my coffee?', 'left', '10%', '24vmin');
            if (await wait(1050)) return;

            const hmm = chat('Villager', 'Hrmm?', 'right', '14%', '28vmin');
            try {
                const voice = new Audio(asset('Mobs/mob/sounds/Villager_hurt1.mp3'));
                voice.volume = 0.5;
                voice.play().catch(() => {});
            } catch (e) {}
            villager.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 400 });

            // un creeper arrive discrètement derrière
            const creeper = actor(asset('Mobs/mob/hostile/creeper.png'), '26vmin', 'right', '2%');
            creeper.style.zIndex = '-1';
            creeper.animate([{ transform: 'translateX(40vw)' }, { transform: 'translateX(0)' }], { duration: 1500, easing: 'linear', fill: 'forwards' });
            if (await wait(500)) return;

            line1.remove();
            hmm.remove();
            chat('Steve', 'Milk would clear my Speed II.', 'left', '10%', '24vmin');
            if (await wait(950)) return;

            // ba dum tss + le creeper trouve ça nul
            tone('sine', 0, 0.12, 180, 90, 0.3);
            tone('sine', 0.14, 0.12, 160, 80, 0.3);
            tone('square', 0.32, 0.35, 5000, 3000, 0.04, 2000);
            creeper.src = asset('Mobs/mob/fools/smiling_creeper.png');
            pop(creeper);
            chat('Creeper', 'sss... that was bad.', 'right', '3%', '26vmin');
            layer.animate([{ filter: 'brightness(2.5)' }, { filter: 'none' }], { duration: 250 });
            const title = el('div', 'pt-coffee-title', layer);
            title.innerHTML = 'BA DUM TSS<small>buy me a coffee (no milk)</small>';
            pop(title);
            if (await wait(1050)) return;

            finish();
        })();
    }

    // Mentions légales : bande-annonce épique, puis Steve demande pourquoi et le Producer n'en sait rien
    function legalCinematic(href) {
        const layer = el('div', 'pt-cinema');
        layer.setAttribute('aria-hidden', 'true');
        root.appendChild(layer);
        const tone = makeSfx(16000);
        let done = false;

        const go = () => {
            if (done) return;
            done = true;
            try { sessionStorage.setItem(KEY, 'cinema'); } catch (e) {}
            window.location.href = href;
        };
        layer.addEventListener('click', go);
        const wait = (ms) => sleep(ms).then(() => done);

        const black = el('div', 'pt-cinema-black', layer);
        const top = el('div', 'pt-bar-top', layer);
        const bottom = el('div', 'pt-bar-bottom', layer);
        el('div', 'pt-skip', layer).textContent = 'click to skip';
        top.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 600, easing: 'ease-out', fill: 'both' });
        bottom.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 600, easing: 'ease-out', fill: 'both' });
        black.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 200, easing: 'ease-in', fill: 'forwards' });

        // BRAAAM
        const braam = (at, gain) => {
            tone('sawtooth', at, 2.2, 55, 49, 0.11 * gain);
            tone('sawtooth', at, 2.2, 82.5, 74, 0.08 * gain);
            tone('square', at, 2.2, 110, 98, 0.035 * gain);
            tone('sine', at, 0.6, 90, 35, 0.4 * gain);
        };
        const hit = (at) => tone('sine', at, 0.45, 130, 38, 0.45);

        const embers = () => {
            for (let i = 0; i < 26; i++) {
                const ember = el('div', 'pt-ember', layer);
                ember.style.setProperty('--p', Math.round(2 + rand() * 4) + 'px');
                ember.style.left = (rand() * 100).toFixed(1) + '%';
                ember.style.top = '92%';
                ember.animate([
                    { transform: 'translate(0, 0)', opacity: 0 },
                    { opacity: 1, offset: 0.2 },
                    { transform: `translate(${Math.round((rand() - 0.5) * 120)}px, -${Math.round(50 + rand() * 40)}vh)`, opacity: 0 }
                ], { duration: 2200 + rand() * 1600, delay: rand() * 1200, easing: 'ease-out', fill: 'both' });
            }
        };

        // carton de texte : apparaît en fondu en grossissant doucement, puis disparaît
        const card = (html, hold, className) => {
            const node = el('div', 'pt-card' + (className ? ' ' + className : ''), layer);
            node.innerHTML = html;
            node.animate([
                { opacity: 0, transform: 'translate(-50%, -50%) scale(1.15)', filter: 'blur(6px)' },
                { opacity: 1, transform: 'translate(-50%, -50%) scale(1.03)', filter: 'blur(0)', offset: 0.25 },
                { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', filter: 'blur(0)', offset: 0.8 },
                { opacity: 0, transform: 'translate(-50%, -50%) scale(0.98)', filter: 'blur(4px)' }
            ], { duration: hold, easing: 'ease-out', fill: 'forwards' });
            return node;
        };

        (async () => {
            braam(0.25, 1);
            if (await wait(1100)) return;

            card('THIS FALL', 1300);
            hit(0);
            if (await wait(1150)) return;

            card('ONE FOOTER LINK', 1300);
            hit(0);
            if (await wait(1150)) return;

            card('WILL CHANGE THE LAW<br>FOREVER', 1500);
            hit(0);
            tone('sawtooth', 0.4, 1.1, 180, 1400, 0.035);
            if (await wait(1450)) return;

            // le titre, avec reflet et braises
            braam(0, 1.3);
            embers();
            card('MENTIONS LÉGALES<small>THE MOVIE</small>', 2600, 'pt-title');
            const flare = el('div', 'pt-flare', layer);
            flare.animate([
                { transform: 'translateX(-30%)', opacity: 0 },
                { opacity: 1, offset: 0.3 },
                { transform: 'translateX(30%)', opacity: 0 }
            ], { duration: 1600, delay: 250, easing: 'ease-in-out', fill: 'both' });
            if (await wait(2500)) return;

            // ...et là, quelqu'un pose la question
            const spot = el('div', 'pt-spot', layer);
            spot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'forwards' });
            const steve = sceneActor(layer, asset('steverunning.gif'), '24vmin', 'left', '22%');
            steve.animate([{ transform: 'translateX(-50vw) scaleX(-1)' }, { transform: 'translateX(0) scaleX(-1)' }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
            if (await wait(750)) return;

            const question = sceneChat(layer, tone, () => done, 'Steve', 'Wait. Why is there a movie trailer for the legal notice?', 'left', '10%', '24vmin');
            if (await wait(1900)) return;

            const producer = sceneActor(layer, asset('Mobs/mob/passive/wandering_trader.png'), '28vmin', 'right', '22%');
            producer.animate([{ transform: 'translateX(50vw)' }, { transform: 'translateX(0)' }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
            const tag = el('div', 'pt-nametag', layer);
            tag.textContent = 'Producer';
            tag.style.setProperty('--h', '28vmin');
            tag.style.right = 'calc(22% + 7vmin)';
            tag.style.transform = 'translateX(50%)';
            tag.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 450, fill: 'both' });
            if (await wait(650)) return;

            question.remove();
            sceneChat(layer, tone, () => done, 'Producer', "...I don't know. We had budget left.", 'right', '8%', '28vmin + 30px');
            if (await wait(2100)) return;

            layer.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(0)' }], { duration: 450, fill: 'forwards' });
            if (await wait(450)) return;
            go();
        })();
    }

    // à l'arrivée : on sort du noir et les bandes du film se retirent
    function cinemaArrive() {
        const layer = el('div', 'pt-cinema');
        layer.setAttribute('aria-hidden', 'true');
        layer.style.pointerEvents = 'none';
        const black = el('div', 'pt-cinema-black', layer);
        black.style.background = '#000';
        black.style.opacity = '1';
        const top = el('div', 'pt-bar-top', layer);
        const bottom = el('div', 'pt-bar-bottom', layer);
        root.appendChild(layer);
        root.classList.remove('pt-cover-cinema');
        black.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
        top.animate([{ transform: 'none' }, { transform: 'translateY(-100%)' }], { duration: 600, delay: 500, easing: 'ease-in', fill: 'forwards' });
        bottom.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 600, delay: 500, easing: 'ease-in', fill: 'forwards' });
        setTimeout(() => layer.remove(), 1200);
    }

    function goofyLeave() {
        const body = document.body;
        const layer = document.createElement('div');
        layer.className = 'pt-goofy-layer';
        layer.setAttribute('aria-hidden', 'true');

        for (let i = 0; i < 16; i++) {
            const parrot = document.createElement('img');
            parrot.className = 'pt-parrot';
            parrot.src = asset('parrotparty.gif');
            parrot.alt = '';
            const size = Math.round(40 + Math.random() * 80);
            parrot.style.setProperty('--s', size + 'px');
            parrot.style.setProperty('--x', Math.round(Math.random() * (window.innerWidth - size)) + 'px');
            parrot.style.setProperty('--d', (Math.random() * 0.6).toFixed(2) + 's');
            parrot.style.setProperty('--r', Math.round(Math.random() * 1080 - 540) + 'deg');
            layer.appendChild(parrot);
        }

        const text = document.createElement('div');
        text.className = 'pt-home';
        [...'HOME SWEET HOME!'].forEach((char, i) => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? ' ' : char;
            span.style.setProperty('--i', i);
            span.style.color = `hsl(${(i * 27) % 360}, 100%, 65%)`;
            text.appendChild(span);
        });
        layer.appendChild(text);

        // en dehors du body, sinon le calque tournerait avec la page
        root.appendChild(layer);
        body.style.transformOrigin = `${window.scrollX + window.innerWidth / 2}px ${window.scrollY + window.innerHeight / 2}px`;
        root.classList.add('pt-sun');
        body.classList.add('pt-flush');
        goofySounds();
    }

    function goofyArrive() {
        const body = document.body;
        body.style.transformOrigin = `50% ${window.innerHeight}px`;
        root.classList.add('pt-sun');
        root.classList.remove('pt-cover-goofy');
        body.classList.add('pt-boing');
        setTimeout(() => {
            body.classList.remove('pt-boing');
            body.style.transformOrigin = '';
            root.classList.remove('pt-sun');
        }, 1000);
    }

    let leaving = false;

    document.addEventListener('click', function (event) {
        if (event.defaultPrevented) return;
        const link = event.target.closest('a[href]');
        if (!link) return;
        // ctrl/molette/maj ou nouvel onglet : ouverture normale
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

        const special = link.dataset.transition;
        if (special === 'coffee') {
            event.preventDefault();
            if (leaving) return;
            if (reduced) {
                openTab(link.href);
                return;
            }
            leaving = true;
            coffeeScene(link.href);
            return;
        }

        if (special === 'wiki' || special === 'guide') {
            event.preventDefault();
            if (leaving) return;
            if (reduced) {
                openTab(link.href);
                return;
            }
            leaving = true;
            const box = link.getBoundingClientRect();
            if (special === 'wiki') {
                wikiChaos(link.href);
            } else {
                guideOpen(link.href, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
            }
            return;
        }

        if (link.target && link.target !== '_self') return;
        if (link.hasAttribute('download')) return;
        if (!/^(https?|file):$/.test(link.protocol)) return;

        const isVoid = link.dataset.transition === 'void';
        const internal = link.protocol === location.protocol && link.host === location.host;
        if (!isVoid && !internal) return;
        // simple ancre sur la même page
        if (!isVoid && link.pathname === location.pathname && link.search === location.search) return;

        event.preventDefault();
        if (leaving) return;
        leaving = true;

        const box = link.getBoundingClientRect();
        const origin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        // retour à l'accueil depuis une autre page : version goofy
        const goofy = !isVoid && isHome(link) && !isHome(location);
        let wait;

        if (isVoid) {
            voidLeave(origin);
            wait = reduced ? 400 : 1500;
        } else if (reduced) {
            wait = 0;
        } else if (link.dataset.transition === 'legal') {
            legalCinematic(link.href);
            return;
        } else if (goofy) {
            goofyLeave();
            try { sessionStorage.setItem(KEY, 'goofy'); } catch (e) {}
            wait = 1450;
        } else {
            portalLeave(link);
            try { sessionStorage.setItem(KEY, 'portal'); } catch (e) {}
            wait = 950;
        }

        setTimeout(() => { window.location.href = link.href; }, wait);
    });

    // retour arrière : la page revient du cache, on enlève ce qui la recouvre
    // retour arrière : la page revient du cache, on enlève ce qui la recouvre
    window.addEventListener('pageshow', function (event) {
        if (!event.persisted) return;
        cleanup();
        try { sessionStorage.removeItem(KEY); } catch (e) {}
    });

    if (arriving && !reduced) {
        const arrive = { goofy: goofyArrive, cinema: cinemaArrive, portal: portalArrive }[arriving];
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', arrive);
        } else {
            arrive();
        }
    }
})();
