"""Temps réel : modification visible sans rechargement sur un autre poste, conflit d'édition, coupure du flux."""
import json, re
from playwright.sync_api import expect
from common import BASE, launch, login, scenario, shot

# Bien en deçà de l'actualisation de secours (30 s) : seul le flux peut expliquer la mise à jour.
LIVE_MS = 5_000

def section(page, title_id):
    return page.locator(f'section:has(#{title_id})')

def card(page, title_id, number):
    return section(page, title_id).locator('li', has=page.locator('h3', has_text=re.compile(rf'(^|\D){re.escape(number)}(\D|$)')))

def set_hidden(page, hidden):
    """Simule le passage de l'onglet en arrière-plan (téléphone verrouillé) puis le retour."""
    page.evaluate("""h => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
    }""", hidden)

with scenario() as p:
    b = launch(p)
    # Réception au bureau, ménage sur téléphone (en arabe) : deux sessions distinctes.
    desk = b.new_context(viewport={'width': 1440, 'height': 950}).new_page()
    login(desk, 'reception@hotel.local')
    phone = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    login(phone, 'menage@hotel.local')

    # 1. La réception passe une chambre « à nettoyer » : le téléphone du ménage la reçoit aussitôt.
    desk.goto(BASE + '/housekeeping')
    phone.goto(BASE + '/housekeeping')
    expect(phone.locator('html')).to_have_attribute('dir', 'rtl')
    ready = section(desk, 'ready-title')
    ready.get_by_role('button', name=re.compile(r'Afficher les chambres prêtes')).click()
    first = ready.locator('li').first
    number = re.search(r'Chambre (\S+)', first.locator('h3').inner_text()).group(1)
    expect(card(phone, 'clean-title', number)).to_have_count(0)
    first.get_by_role('button', name='À nettoyer').click()
    expect(card(phone, 'clean-title', number)).to_have_count(1, timeout=LIVE_MS)
    shot(phone, 'live_phone')
    print(f'1. chambre {number} à nettoyer : visible sur le téléphone du ménage sans rechargement')

    # 2. Retour en arrière : même chose dans l'autre sens.
    card(phone, 'clean-title', number).get_by_role('button', name='نظيفة').click()  # « Propre »
    expect(card(desk, 'clean-title', number)).to_have_count(0, timeout=LIVE_MS)
    print('2. chambre nettoyée par le ménage : retirée de l’écran de la réception')

    # 3. Fiche client ouverte sur deux postes : la modification d'un collègue s'affiche en direct ;
    #    une saisie en cours sur l'ancienne version est refusée, pas enregistrée par-dessus.
    guest = desk.request.get(BASE + '/api/v1/guests?limit=1').json()['data'][0]
    gid = guest['id']
    desk.goto(BASE + f'/guests/{gid}')
    expect(desk.get_by_role('heading', level=1)).to_be_visible()
    colleague = b.new_context().new_page()
    login(colleague, 'reception@hotel.local')
    colleague.request.patch(BASE + f'/api/v1/guests/{gid}', headers={'If-Match': '*', 'Content-Type': 'application/json'},
                            data=json.dumps({'email': 'collegue.live@example.com'}))
    expect(desk.locator('main dl')).to_contain_text('collegue.live@example.com', timeout=LIVE_MS)
    print('3a. modification d’un collègue affichée en direct')

    desk.get_by_role('button', name='Modifier').click()
    desk.get_by_label('Email').fill('ecrase.live@example.com')
    colleague.request.patch(BASE + f'/api/v1/guests/{gid}', headers={'If-Match': '*', 'Content-Type': 'application/json'},
                            data=json.dumps({'email': 'collegue2.live@example.com'}))
    # Le temps que la fiche se recharge en arrière-plan pendant la saisie.
    desk.wait_for_timeout(1_500)
    desk.get_by_role('button', name='Enregistrer').click()
    expect(desk.get_by_text('modifié par quelqu’un d’autre')).to_be_visible()
    expect(desk.locator('main dl')).to_contain_text('collegue2.live@example.com')
    after = desk.request.get(BASE + f'/api/v1/guests/{gid}').json()
    assert after['email'] == 'collegue2.live@example.com', after['email']
    print('3b. saisie sur une version périmée refusée (412), la modification du collègue est conservée')

    # 4. Flux coupé : bandeau après quelques secondes, puis retour à la normale.
    desk.goto(BASE + '/')
    banner = desk.get_by_text('Connexion perdue')
    desk.route('**/api/v1/events', lambda route: route.abort())
    set_hidden(desk, True)
    set_hidden(desk, False)
    expect(banner).to_be_visible(timeout=15_000)
    shot(desk, 'live_offline')
    desk.unroute('**/api/v1/events')
    expect(banner).to_be_hidden(timeout=15_000)
    print('4. coupure du flux : bandeau affiché puis retiré à la reconnexion')
    b.close()
