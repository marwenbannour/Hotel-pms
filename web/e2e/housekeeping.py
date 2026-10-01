"""Ménage (format téléphone) : à nettoyer, annulation, hors service, filtre par étage, arabe."""
import re
from playwright.sync_api import expect
from common import BASE, launch, login, scenario, shot

def section(page, title_id):
    return page.locator(f'section:has(#{title_id})')

with scenario() as p:
    b = launch(p)
    # Format téléphone : l'équipe de ménage travaille sur mobile.
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    login(page, 'reception@hotel.local')
    page.goto(BASE + '/housekeeping')
    expect(page.get_by_role('heading', level=1)).to_have_text('Ménage')
    shot(page, 'hk_mobile', full_page=True)

    # 1. Chambre prête → à nettoyer, puis annulation
    ready = section(page, 'ready-title')
    ready.get_by_role('button', name=re.compile(r'Afficher les chambres prêtes')).click()
    first = ready.locator('li').first
    number = re.search(r'Chambre (\S+)', first.locator('h3').inner_text()).group(1)
    first.get_by_role('button', name='À nettoyer').click()
    toast = page.get_by_role('status')
    expect(toast).to_contain_text(f'Chambre {number} à nettoyer.')
    expect(section(page, 'clean-title').locator('h3', has_text=f'Chambre {number}')).to_have_count(1)
    toast.get_by_role('button', name='Annuler').click()
    expect(section(page, 'clean-title').locator('h3', has_text=f'Chambre {number}')).to_have_count(0)
    print(f'1. chambre {number} : à nettoyer puis annulation OK')

    # 2. À nettoyer → propre
    ready.locator('li', has=page.locator('h3', has_text=f'Chambre {number}')).get_by_role('button', name='À nettoyer').click()
    clean_card = section(page, 'clean-title').locator('li', has=page.locator('h3', has_text=f'Chambre {number}'))
    clean_card.get_by_role('button', name='Propre').click()
    expect(page.get_by_role('status')).to_contain_text(f'Chambre {number} prête.')
    expect(clean_card).to_have_count(0)
    print('2. nettoyage terminé OK')

    # 3. Signaler un problème → hors service → remise en service
    ready.locator('li', has=page.locator('h3', has_text=f'Chambre {number}')).get_by_role('button', name='Signaler un problème').click()
    ooo_card = section(page, 'ooo-title').locator('li', has=page.locator('h3', has_text=f'Chambre {number}'))
    expect(ooo_card).to_have_count(1)
    ooo_card.get_by_role('button', name='Remettre en service').click()
    expect(ooo_card).to_have_count(0)
    print('3. hors service puis remise en service OK')

    # 4. Filtre par étage synchronisé avec l'URL
    chips = page.get_by_role('group', name='Étage').get_by_role('button')
    if chips.count() > 2:
        chips.nth(1).click()
        page.wait_for_url(re.compile(r'floor=\d+'))
        expect(chips.nth(1)).to_have_attribute('aria-pressed', 'true')
        print('4. filtre par étage OK')
    ctx.close()

    # 5. Profil ménage : interface en arabe
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    login(page, 'menage@hotel.local')
    page.goto(BASE + '/housekeeping')
    expect(page.get_by_role('heading', level=1)).to_have_text('التدبير المنزلي')
    expect(page.locator('html')).to_have_attribute('dir', 'rtl')
    shot(page, 'hk_ar', full_page=True)
    print('5. ménage en arabe (RTL) OK')
    b.close()
