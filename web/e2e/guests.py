"""Clients : liste, recherche, création, validation, modification, réservation présélectionnée, droits."""
import re, time
from playwright.sync_api import expect
from common import BASE, launch, login, scenario

with scenario() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 1440, 'height': 950})
    page = ctx.new_page()
    login(page, 'reception@hotel.local')

    # 1. Liste + recherche synchronisée avec l'URL
    page.goto(BASE + '/guests')
    page.wait_for_selector('table tbody tr')
    n_all = page.locator('table tbody tr').count()
    page.fill('input[type=search]', 'benali')
    page.wait_for_url(re.compile(r'q=benali'))
    page.wait_for_timeout(600)
    rows = page.locator('table tbody tr')
    assert 1 <= rows.count() <= n_all, rows.count()
    expect(rows.first).to_contain_text('BENALI')
    page.locator('main select').select_option('company')
    page.wait_for_url(re.compile(r'segment=company'))
    expect(page.get_by_text('Aucun client trouvé.')).to_be_visible()
    page.get_by_role('button', name='Effacer les filtres').click()
    page.wait_for_selector('table tbody tr')
    print(f'1. liste {n_all} lignes, recherche et segment OK')

    # 2. Création : erreur de validation renvoyée par l'API, puis succès
    stamp = str(int(time.time()))
    page.get_by_role('link', name='Nouveau client').click()
    page.wait_for_url(BASE + '/guests/new')
    page.get_by_label('Prénom').fill('Yasmine')
    page.get_by_label('Nom', exact=True).fill('Test' + stamp)
    page.get_by_label('Téléphone').fill('abc')
    page.get_by_role('button', name='Créer le client').click()
    expect(page.locator('main .text-maintenance').first).to_be_visible()
    page.get_by_label('Téléphone').fill('+216 71 000 000')
    page.get_by_label('Email').fill(f'yasmine.{stamp}@example.com')
    page.get_by_label('Nationalité').fill('tn')
    page.locator('main select').select_option('company')
    page.get_by_role('button', name='Créer le client').click()
    page.wait_for_url(re.compile(r'/guests/[0-9a-f-]{36}$'))
    expect(page.get_by_role('heading', level=1)).to_have_text(f'Yasmine Test{stamp}')
    expect(page.locator('main dl')).to_contain_text('TN')
    expect(page.locator('main dl')).to_contain_text('Entreprise')
    expect(page.get_by_text('Aucun séjour pour ce client.')).to_be_visible()
    guest_url = page.url
    print('2. création + validation OK')

    # 3. Modification (If-Match) : changement d'email, téléphone vidé
    page.get_by_role('button', name='Modifier').click()
    page.get_by_label('Email').fill(f'y.{stamp}@example.org')
    page.get_by_label('Téléphone').fill('')
    page.get_by_role('button', name='Enregistrer').click()
    expect(page.locator('main dl')).to_contain_text(f'y.{stamp}@example.org')
    expect(page.locator('main dl')).not_to_contain_text('+216')
    print('3. modification OK')

    # 4. Pas d'effacement RGPD pour la réception
    expect(page.get_by_role('button', name='Anonymiser (RGPD)')).to_have_count(0)

    # 5. Nouvelle réservation avec le client présélectionné
    page.get_by_role('link', name='Nouvelle réservation').click()
    page.wait_for_url(re.compile(r'/reservations/new\?guestId='))
    expect(page.locator('main')).to_contain_text(f'Yasmine Test{stamp}')
    print('5. présélection dans la nouvelle réservation OK')

    # 6. Séjours d'un client existant et lien retour depuis la réservation
    page.goto(BASE + '/guests?q=benali')
    page.locator('table tbody tr a').first.click()
    page.wait_for_selector('#stays-title')
    page.wait_for_selector('main table tbody tr')
    page.locator('main table tbody tr a').first.click()
    page.wait_for_url(re.compile(r'/reservations/[0-9a-f-]{36}$'))
    page.get_by_role('link', name='Voir la fiche client').click()
    page.wait_for_url(re.compile(r'/guests/[0-9a-f-]{36}$'))
    print('6. séjours et navigation réservation ↔ client OK')
    ctx.close()

    # 7. Restaurant : lecture seule
    ctx = b.new_context(viewport={'width': 1440, 'height': 950})
    page = ctx.new_page()
    login(page, 'restaurant@hotel.local')
    page.goto(BASE + '/guests')
    page.wait_for_selector('table tbody tr')
    expect(page.get_by_role('link', name='Nouveau client')).to_have_count(0)
    page.goto(guest_url)
    expect(page.get_by_role('heading', level=1)).to_have_text(f'Yasmine Test{stamp}')
    expect(page.get_by_role('button', name='Modifier')).to_have_count(0)
    expect(page.locator('#stays-title')).to_have_count(0)
    print('7. restaurant en lecture seule OK')
    b.close()
