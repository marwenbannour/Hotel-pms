"""Réservations : liste, création (idempotence), modification, conflit, annulation, arrivées, arabe, droits."""
import re, json
from datetime import date, timedelta
from playwright.sync_api import expect
from common import BASE, launch, login, scenario, shot

iso = lambda d: d.isoformat()

with scenario() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 1440, 'height': 950}, timezone_id='UTC')
    page = ctx.new_page()
    login(page, 'reception@hotel.local')
    # Jour de l'établissement (fuseau de l'hôtel), tel que l'interface l'utilise ; le poste est en UTC.
    hotel_today = date.fromisoformat(page.request.get(BASE + '/api/v1/me').json()['hotel']['today'])
    print('date hôtel', hotel_today)

    # 1. Liste + recherche synchronisée avec l'URL
    page.goto(BASE + '/reservations')
    page.wait_for_selector('table tbody tr')
    n_all = page.locator('table tbody tr').count()
    shot(page, 'r_list')
    page.fill('input[type=search]', 'benali')
    page.wait_for_url(re.compile(r'q=benali'))
    page.wait_for_timeout(600)
    rows = page.locator('table tbody tr')
    assert 1 <= rows.count() < n_all, rows.count()
    for i in range(rows.count()): expect(rows.nth(i)).to_contain_text('Amina Benali')
    page.locator('main select').select_option('cancelled')
    expect(page.get_by_text('Aucune réservation ne correspond')).to_be_visible()
    print(f'1. liste {n_all} lignes, recherche et filtres OK')

    # 2. Création : dates par défaut = calendrier de l'hôtel
    page.goto(BASE + '/reservations/new')
    page.wait_for_selector('input[type=date]')
    arr = page.locator('input[type=date]').nth(0)
    expect(arr).to_have_value(iso(hotel_today))
    a, d = hotel_today + timedelta(days=3), hotel_today + timedelta(days=5)
    arr.fill(iso(a)); page.locator('input[type=date]').nth(1).fill(iso(d))
    page.get_by_text('Demi-pension').click()
    page.get_by_text('Chambre double').click()
    expect(page.get_by_text('290 €')).to_be_visible()          # 2 × (95 + 25 × 2)
    page.get_by_label('Prénom').fill('Jeanne'); page.get_by_label('Nom', exact=True).fill('Testeuse')
    shot(page, 'r_new', full_page=True)
    # Double clic : une seule réservation grâce à la clé d'idempotence
    page.get_by_role('button', name='Créer la réservation').dblclick()
    page.wait_for_url(re.compile(r'/reservations/[0-9a-f-]{36}$'))
    rid = page.url.rsplit('/', 1)[1]
    expect(page.get_by_role('heading', name='Jeanne Testeuse')).to_be_visible()
    count = page.request.get(BASE + '/api/v1/reservations?q=testeuse').json()['data']
    assert len(count) == 1, count
    print('2. création OK, date par défaut hôtel, prix 290 €, pas de doublon au double clic')

    # 3. Modification avec recalcul du prix
    page.get_by_role('button', name='Modifier').click()
    page.locator('input[type=date]').nth(1).fill(iso(hotel_today + timedelta(days=6)))
    expect(page.get_by_text('435 €')).to_be_visible()
    page.get_by_role('button', name='Enregistrer les modifications').click()
    expect(page.get_by_text('Réservation modifiée')).to_be_visible()
    expect(page.locator('section').filter(has_text='Total du séjour').get_by_text('435 €')).to_be_visible()
    print('3. modification OK, total 435 €, historique mis à jour')

    # 4. Conflit : un collègue modifie pendant l'édition
    page.get_by_role('button', name='Modifier').click()
    page.get_by_label('Adultes').fill('1')
    page.request.patch(BASE + f'/api/v1/reservations/{rid}', headers={'If-Match': '*', 'Content-Type': 'application/json'},
                       data=json.dumps({'notes': 'Modifié par un collègue'}))
    page.get_by_role('button', name='Enregistrer les modifications').click()
    expect(page.get_by_text('modifiée par quelqu’un d’autre')).to_be_visible()
    expect(page.get_by_text('Modifié par un collègue')).to_be_visible()
    print('4. conflit détecté (412), fiche rechargée avec la note du collègue')

    # 5. Annulation motivée
    page.get_by_role('button', name='Annuler la réservation').click()
    page.get_by_label('Motif de l’annulation').fill('Le client reporte son voyage')
    page.get_by_role('button', name='Confirmer l’annulation').click()
    expect(page.locator('header').get_by_text('Annulée')).to_be_visible()
    expect(page.get_by_text('Le client reporte son voyage').first).to_be_visible()
    expect(page.get_by_text('modifiée par quelqu’un d’autre')).to_be_hidden()
    WD = ['lun.','mar.','mer.','jeu.','ven.','sam.','dim.']; MO = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
    hotel_label = f"{WD[hotel_today.weekday()]} {hotel_today.day} {MO[hotel_today.month-1]}"
    expect(page.locator('#history-title + ol').get_by_text(hotel_label).first).to_be_visible()
    shot(page, 'r_detail', full_page=True)
    print(f'5. annulation OK, message de conflit effacé, historique daté du {hotel_label} (fuseau hôtel)')

    # 6. Arrivées du jour + navigation
    page.goto(BASE + '/frontdesk/arrivals')
    expect(page.get_by_text('Nadia Cherif')).to_be_visible()
    page.get_by_role('button', name='Enregistrer l’arrivée').first.click()
    expect(page.get_by_text('Arrivé').first).to_be_visible()
    page.get_by_role('button', name='Jour suivant').click()
    page.wait_for_url(re.compile(r'date='))
    expect(page.get_by_text('Les arrivées et départs s’enregistrent le jour même.')).to_be_visible()
    page.get_by_role('button', name='Aujourd’hui').click()
    shot(page, 'r_arrivals')
    print('6. arrivées du jour, enregistrement et navigation OK')

    # 7. Arabe : formulaire en RTL
    page.context.add_cookies([{'name': 'pms_lang', 'value': 'ar', 'url': BASE}])
    page.goto(BASE + '/reservations/new')
    page.wait_for_selector('input[type=date]')
    page.locator('fieldset label').filter(has_text='DBL').click()
    page.wait_for_timeout(700)
    assert page.evaluate('document.documentElement.dir') == 'rtl'
    shot(page, 'r_new_ar', full_page=True)
    print('7. formulaire en arabe (RTL) OK')

    # 8. Le ménage n'accède pas aux réservations
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800})
    p2 = ctx2.new_page(); login(p2, 'menage@hotel.local')
    r = p2.request.get(BASE + '/api/v1/reservations')
    assert r.status == 403, r.status
    print('8. profil ménage : 403 sur les réservations')
    b.close()
