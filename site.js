/* AmaiCraft : petits comportements communs à toutes les pages */
(function () {
    // le lien Coffee : chaque lettre prend une couleur au hasard
    const coffee = document.getElementById('Don');
    if (coffee && !coffee.dataset.rainbow) {
        coffee.dataset.rainbow = '1';
        const text = coffee.textContent.trim();
        coffee.textContent = '';
        [...text].forEach((char, i) => {
            const span = document.createElement('span');
            span.textContent = char;
            const color = `hsl(${Math.floor(Math.random() * 360)}, 100%, 80%)`;
            span.style.color = color;
            span.style.textDecorationColor = color;
            span.style.setProperty('--i', i);
            coffee.appendChild(span);
        });
    }

    // Steve saute quand on clique dessus
    document.querySelectorAll('.ac-steve').forEach((steve) => {
        steve.addEventListener('click', () => {
            if (steve.classList.contains('jumping')) return;
            steve.classList.add('jumping');
            setTimeout(() => steve.classList.remove('jumping'), 800);
        });
    });

    // le menu Sections se ferme en cliquant ailleurs ou avec Échap
    const menus = document.querySelectorAll('.ac-menu, .ac-info');
    document.addEventListener('click', (event) => {
        menus.forEach((menu) => {
            if (menu.open && !menu.contains(event.target)) menu.open = false;
        });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        menus.forEach((menu) => { menu.open = false; });
    });
})();
