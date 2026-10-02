"""Rapports : période, indicateurs et comparaison, info-bulle, regroupement par semaine, tableau, CSV, arabe."""
import re
from playwright.sync_api import expect
from common import BASE, launch, login_mfa, scenario, shot, submit_credentials

with scenario() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = ctx.new_page()
    login_mfa(page, 'compta@hotel.local')

    # 1. Période par défaut : mois en cours, indicateurs et comparaison
    page.goto(BASE + '/reports')
    expect(page.get_by_role('heading', level=1)).to_have_text('Rapports')
    expect(page.get_by_role('button', name='Ce mois')).to_have_attribute('aria-pressed', 'true')
    occ = page.locator('dl div', has=page.locator('dt', has_text='Taux d’occupation')).first
    expect(occ.locator('dd').first).to_contain_text('%')
    expect(occ).to_contain_text('vs période précédente')
    bars = page.get_by_role('list', name='Taux d’occupation').get_by_role('listitem')
    n_days = bars.count()
    assert 28 <= n_days <= 31, n_days
    print(f'1. mois en cours : {n_days} barres, indicateurs et comparaison OK')

    # 2. Info-bulle au survol
    bars.nth(n_days // 2).hover()
    expect(page.locator('div[role=presentation]')).to_contain_text('chambres')
    shot(page, 'reports_fr', full_page=True)
    print('2. info-bulle OK')

    # 3. Préréglage annuel : regroupement par semaine
    page.get_by_role('button', name='Cette année').click()
    page.wait_for_url(re.compile(r'from=\d{4}-01-01&to=\d{4}-12-31'))
    expect(page.get_by_text('par semaine').first).to_be_visible()
    n_weeks = page.get_by_role('list', name='Taux d’occupation').get_by_role('listitem').count()
    assert 52 <= n_weeks <= 53, n_weeks
    print(f'3. année : {n_weeks} semaines OK')

    # 4. Période personnalisée, validation, tableau et export CSV
    page.get_by_label('Du', exact=True).fill('2026-10-10')
    page.get_by_label('Au (inclus)', exact=True).fill('2026-10-05')
    expect(page.locator('main').get_by_role('alert')).to_contain_text('postérieure')
    page.get_by_label('Au (inclus)', exact=True).fill('2026-10-16')
    page.get_by_role('button', name='Afficher', exact=True).click()
    page.wait_for_url(re.compile(r'from=2026-10-10&to=2026-10-16'))
    page.get_by_role('button', name='Afficher le tableau').click()
    expect(page.locator('main table tbody tr')).to_have_count(7)
    with page.expect_download() as dl:
        page.get_by_role('button', name='Exporter (CSV)').click()
    csv = open(dl.value.path(), encoding='utf-8-sig').read().strip().splitlines()
    assert csv[0].startswith('date;rooms_available;rooms_sold'), csv[0]
    assert len(csv) == 8 and csv[1].startswith('2026-10-10;'), csv[:2]
    print('4. période personnalisée, tableau et CSV OK')

    # 5. Arabe : mise en page RTL
    ctx.add_cookies([{'name': 'pms_lang', 'value': 'ar', 'url': BASE}])
    page.goto(BASE + '/reports')
    expect(page.get_by_role('heading', level=1)).to_have_text('التقارير')
    page.wait_for_timeout(500)
    shot(page, 'reports_ar', full_page=True)
    print('5. arabe OK')
    b.close()
