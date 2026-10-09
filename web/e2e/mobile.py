"""Application mobile : installation, onglets par profil, restaurant, et synchronisation téléphone ↔ tableau de bord."""
import re
from playwright.sync_api import expect
from common import BASE, launch, login, scenario, shot

# Bien en deçà de l'actualisation de secours (30 s) : seul le flux peut expliquer la mise à jour.
LIVE_MS = 5_000
PHONE = {'viewport': {'width': 390, 'height': 844}, 'is_mobile': True, 'has_touch': True}

def tabs(page):
    return page.get_by_role('navigation', name='Navigation rapide')

with scenario() as p:
    b = launch(p)

    # 1. Installable : manifeste, icônes, service worker, balises iOS.
    desk = b.new_context(viewport={'width': 1440, 'height': 950}).new_page()
    manifest = desk.request.get(BASE + '/manifest.webmanifest')
    assert manifest.ok, manifest.status
    m = manifest.json()
    assert m['display'] == 'standalone' and m['start_url'] == '/', m
    assert {'any', 'maskable'} <= {i['purpose'] for i in m['icons']}, m['icons']
    for icon in [i['src'] for i in m['icons']] + ['/icons/apple-touch-icon.png']:
        res = desk.request.get(BASE + icon)
        assert res.ok and res.headers['content-type'] == 'image/png', (icon, res.status)
    sw = desk.request.get(BASE + '/sw.js')
    assert sw.ok and 'javascript' in sw.headers['content-type'], sw.status
    login(desk, 'reception@hotel.local')
    expect(desk.locator('link[rel=manifest]')).to_have_count(1)
    expect(desk.locator('link[rel=apple-touch-icon]')).to_have_count(1)
    expect(tabs(desk)).to_be_hidden()  # poste fixe : menu latéral, pas d'onglets
    print('1. manifeste, icônes, service worker et balises iOS OK')

    # 2. Restaurant sur téléphone : onglets du profil, consommation portée sur une chambre,
    #    visible aussitôt sur le compte du séjour ouvert à la réception.
    stay = next(r for r in desk.request.get(BASE + '/api/v1/reservations?status=checked_in&limit=50').json()['data'] if r.get('room'))
    room = stay['room']['number']
    desk.goto(BASE + f'/reservations/{stay["id"]}')
    folio = desk.locator('section[aria-labelledby=billing-title]')
    expect(folio).to_be_visible()

    resto = b.new_context(**PHONE).new_page()
    login(resto, 'restaurant@hotel.local')
    expect(tabs(resto).get_by_role('link')).to_have_text(['Tableau de bord', 'Clients', 'Restaurant'])
    tabs(resto).get_by_role('link', name='Restaurant').click()
    resto.wait_for_url(BASE + '/restaurant')
    expect(tabs(resto).get_by_role('link', name='Restaurant')).to_have_attribute('aria-current', 'page')
    room_button = resto.get_by_role('button', name=f'Chambre {room}', exact=True)
    expect(room_button).to_be_visible()
    occupied_before = resto.locator('main ul li button').count()
    room_button.click()
    resto.get_by_role('button', name='Bar', exact=True).click()
    resto.get_by_label('Consommation').fill('Café mobile')
    resto.get_by_role('button', name='Un de plus').click()
    resto.get_by_label('Prix unitaire TTC').fill('3,50')
    expect(resto.locator('form')).to_contain_text('7,00')
    shot(resto, 'restaurant_form')
    resto.get_by_role('button', name=f'Porter sur la chambre {room}').click()
    expect(resto.get_by_role('status')).to_contain_text(f'porté sur la chambre {room}')
    expect(folio).to_contain_text('Café mobile', timeout=LIVE_MS)
    print(f'2. restaurant : 2 × 3,50 € sur la chambre {room}, affiché en direct sur le compte du séjour')

    # 3. Réception sur téléphone : arrivée enregistrée depuis l'onglet « Arrivées du jour » ;
    #    le tableau de bord du bureau et la liste des chambres du restaurant suivent.
    desk.goto(BASE + '/')
    arrivals_title = desk.locator('#arrivals-title')
    expect(arrivals_title).to_be_visible()
    before = re.search(r'(\d+)/(\d+)', arrivals_title.inner_text()).groups()

    front = b.new_context(**PHONE).new_page()
    login(front, 'reception@hotel.local')
    tabs(front).get_by_role('link', name='Arrivées du jour').click()
    front.wait_for_url(BASE + '/frontdesk/arrivals')
    shot(front, 'reception_arrivals')
    front.get_by_role('button', name='Enregistrer l’arrivée').first.click()
    expected = f'{int(before[0]) - 1}/{before[1]}'
    expect(arrivals_title).to_contain_text(expected, timeout=LIVE_MS)
    expect(resto.locator('main ul li button')).to_have_count(occupied_before + 1, timeout=LIVE_MS)
    print(f'3. arrivée sur téléphone : tableau de bord {before[0]}/{before[1]} → {expected}, nouvelle chambre côté restaurant')

    # 4. Ménage sur téléphone (en arabe) : chambre nettoyée, tuile mise à jour sur le tableau de bord.
    hk = b.new_context(**PHONE).new_page()
    login(hk, 'menage@hotel.local')
    tabs_ar = hk.get_by_role('navigation', name='تنقل سريع')
    tabs_ar.get_by_role('link', name='التدبير المنزلي').click()
    hk.wait_for_url(BASE + '/housekeeping')
    to_clean = hk.locator('section:has(#clean-title) li').first
    number = re.search(r'\d+', to_clean.locator('h3').inner_text()).group(0)
    tile = desk.get_by_role('button', name=re.compile(rf'^Chambre {number},'))
    expect(tile).not_to_have_attribute('aria-label', re.compile('Libre et propre'))
    to_clean.get_by_role('button', name='نظيفة').click()
    expect(tile).to_have_attribute('aria-label', re.compile('Libre et propre'), timeout=LIVE_MS)
    # Le message d'annulation reste au-dessus des onglets.
    toast = hk.get_by_role('status').filter(has=hk.get_by_role('button'))
    assert toast.bounding_box()['y'] + toast.bounding_box()['height'] <= tabs_ar.bounding_box()['y'], 'message masqué par les onglets'
    shot(hk, 'housekeeping_toast')
    print(f'4. ménage : chambre {number} propre, tuile du tableau de bord mise à jour en direct')

    # 5. « Plus » ouvre le menu complet (langue, déconnexion).
    tabs(front).get_by_role('button', name='Plus').click()
    expect(front.get_by_role('navigation', name='Menu principal').get_by_role('link', name='Clients')).to_be_visible()
    expect(front.get_by_role('button', name='Se déconnecter')).to_be_visible()
    print('5. onglet « Plus » : menu complet OK')
    b.close()
