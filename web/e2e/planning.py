"""Planning des chambres : attribution au menu, glisser-déposer, refus d'un chevauchement, arabe."""
import re
from playwright.sync_api import expect
from common import BASE, launch, login, scenario, shot

def stay(page, ref):
    data = page.request.get(BASE + '/api/v1/reservations?q=' + ref).json()['data'][0]
    return data

def room_cell(page, number):
    return page.locator('div[role=row]').filter(has=page.locator('div[role=rowheader]', has_text=re.compile(rf'^{number}'))).locator('div[role=gridcell]')

with scenario() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000})
    page = ctx.new_page()
    login(page, 'reception@hotel.local')

    page.goto(BASE + '/planning')
    page.wait_for_selector('div[role=grid] button[aria-label*="RDEMO"]')
    n_bars = page.locator('div[role=grid] button[aria-label*="RDEMO"]').count()
    shot(page, 'p_planning', full_page=True)
    assert n_bars >= 14, n_bars
    expect(page.get_by_text('À attribuer').first).to_be_visible()
    print(f'1. planning affiché : {n_bars} séjours, ligne « À attribuer » présente')

    # 2. Attribution au menu (accessible au clavier)
    page.locator('button[aria-label*="RDEMO012"]').click()
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()
    shot(page, 'p_popover', clip={'x': 0, 'y': 0, 'width': 1440, 'height': 1000})
    dialog.get_by_label('Attribuer la chambre').select_option(label='103')
    expect(page.get_by_role('status')).to_contain_text('attribuée à la chambre 103')
    assert stay(page, 'RDEMO012')['room']['number'] == '103'
    print('2. attribution par le menu : RDEMO012 → 103')

    # 3. Glisser-déposer valide : séjour familial à venir vers la 301 (libre à partir de J+2)
    page.locator('button[aria-label*="RDEMO013"]').drag_to(room_cell(page, '301'))
    expect(page.get_by_role('status')).to_contain_text('RDEMO013 attribuée à la chambre 301')
    assert stay(page, 'RDEMO013')['room']['number'] == '301'
    print('3. glisser-déposer : RDEMO013 → 301')

    # 4. Glisser-déposer refusé : la 201 est promise à RDEMO014 sur des nuits communes avec RDEMO011
    before = stay(page, 'RDEMO011')['room']['number']
    page.locator('button[aria-label*="RDEMO011"]').drag_to(room_cell(page, '201'))
    page.wait_for_timeout(800)
    assert stay(page, 'RDEMO011')['room']['number'] == before == '203'
    print('4. dépôt sur une chambre déjà promise ignoré : RDEMO011 reste en 203')

    # 5. Retrait de l'attribution
    page.locator('button[aria-label*="RDEMO012"]').click()
    page.get_by_role('dialog').get_by_label('Attribuer la chambre').select_option(value='')
    expect(page.get_by_role('status')).to_contain_text('RDEMO012 n’a plus de chambre')
    assert stay(page, 'RDEMO012')['room'] is None
    print('5. retrait de l’attribution OK')

    # 6. La fiche de réservation montre l'historique d'attribution
    page.goto(BASE + '/reservations/' + stay(page, 'RDEMO013')['id'])
    expect(page.get_by_text('Chambre attribuée')).to_be_visible()
    print('6. historique « Chambre attribuée » sur la fiche')

    # 7. Arabe
    ctx.add_cookies([{'name': 'pms_lang', 'value': 'ar', 'url': BASE}])
    page.goto(BASE + '/planning')
    page.wait_for_selector('div[role=grid] button[aria-label*="RDEMO"]'); page.wait_for_timeout(500)
    assert page.evaluate('document.documentElement.dir') == 'rtl'
    shot(page, 'p_planning_ar', full_page=True)
    print('7. planning en arabe (RTL)')

    # 8. Le ménage n'y a pas accès
    ctx2 = b.new_context(); p2 = ctx2.new_page(); login(p2, 'menage@hotel.local')
    assert p2.request.get(BASE + '/api/v1/planning?from=2026-10-01&to=2026-10-08').status == 403
    print('8. profil ménage : 403 sur le planning')
    b.close()
