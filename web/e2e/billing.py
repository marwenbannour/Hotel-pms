"""Facturation : départ bloqué par le solde, prestation, encaissement, facture (arabe), comptabilité, avoir."""
import base64, hashlib, hmac, os, re, struct, time
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3001'

def totp(secret):
    key = base64.b32decode(secret + '=' * (-len(secret) % 8))
    h = hmac.new(key, struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    o = h[-1] & 15
    return str((struct.unpack('>I', h[o:o + 4])[0] & 0x7fffffff) % 1000000).zfill(6)

def login(page, email):
    page.goto(BASE + '/login')
    page.fill('input[type=email]', email); page.fill('input[type=password]', 'ChangeMe!2026'); page.click('form button')

def login_mfa(page, email):
    login(page, email)
    page.wait_for_selector('code')
    secret = page.inner_text('code').strip()
    page.fill('input[autocomplete=one-time-code]', totp(secret)); page.click('form button:not([type=button])')
    page.wait_for_selector('input[type=password]')
    page.fill('input[type=email]', email); page.fill('input[type=password]', 'ChangeMe!2026'); page.click('form button')
    page.wait_for_selector('input[autocomplete=one-time-code]')
    time.sleep(1)
    page.fill('input[autocomplete=one-time-code]', totp(secret)); page.click('form button:not([type=button])')
    page.wait_for_url(BASE + '/')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None)
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = ctx.new_page()
    login(page, 'reception@hotel.local'); page.wait_for_url(BASE + '/')

    # 1. Départ refusé : solde dû, lien direct vers le compte
    page.goto(BASE + '/frontdesk/departures')
    row = page.locator('tr', has_text='Amina Benali')
    row.get_by_role('button', name='Enregistrer le départ').click()
    expect(row.get_by_role('alert')).to_contain_text('Solde à régler avant le départ : 296.00 EUR')
    row.get_by_role('link', name='Facturation').click()
    page.wait_for_url(re.compile(r'/reservations/[0-9a-f-]{36}'))
    panel = page.locator('section[aria-labelledby=billing-title]')
    expect(panel.get_by_text('Solde à régler')).to_be_visible()
    expect(panel.locator('dl').get_by_text(re.compile(r'^296,00\s€$')).last).to_be_visible()  # espace insécable avant €
    print('1. départ refusé (296,00 €), lien vers le compte du séjour')

    # 2. Prestation minibar
    panel.get_by_role('button', name='Ajouter une prestation').click()
    dlg = page.locator('dialog[open]')
    dlg.get_by_label('Catégorie').select_option('minibar')
    dlg.get_by_label('Description').fill('Eau minérale')
    dlg.get_by_label('Qté').fill('2')
    dlg.get_by_label('Prix unitaire TTC').fill('4,50')
    dlg.get_by_role('button', name='Ajouter').click()
    expect(panel.get_by_text('Eau minérale')).to_be_visible()
    expect(panel.locator('dl').get_by_text(re.compile(r'^305,00\s€$')).last).to_be_visible()
    print('2. prestation minibar ajoutée, solde 305,00 €')

    # 3. Encaissement : numéro de carte refusé, référence de transaction acceptée
    panel.get_by_role('button', name='Encaisser').click()
    dlg = page.locator('dialog[open]')
    expect(dlg.get_by_label('Montant TTC (EUR)')).to_have_value('305.00')
    dlg.get_by_label('Référence de la transaction').fill('4111 1111 1111 1111')
    dlg.get_by_role('button', name='Enregistrer').click()
    expect(dlg.get_by_text('Ne saisissez jamais un numéro de carte')).to_be_visible()
    dlg.get_by_label('Référence de la transaction').fill('TPE-20261001-0042')
    dlg.get_by_role('button', name='Enregistrer').click()
    expect(panel.get_by_text('Compte soldé')).to_be_visible()
    page.screenshot(path='/tmp/b_folio.png', full_page=True)
    print('3. numéro de carte refusé ; paiement par référence TPE enregistré, compte soldé')

    # 4. Facture en arabe, puis départ
    panel.get_by_label('Langue de la facture').select_option('ar')
    panel.get_by_role('button', name='Émettre la facture').click()
    expect(panel.get_by_text(re.compile(r'Séjour facturé : F\d{4}-000001'))).to_be_visible()
    expect(panel.get_by_role('button', name='Ajouter une prestation')).to_be_hidden()
    page.get_by_role('button', name='Enregistrer le départ').click()
    expect(page.locator('header').get_by_text('Parti')).to_be_visible()
    panel.get_by_role('link', name='Voir la facture').click()
    page.wait_for_url(re.compile(r'/invoices/'))
    art = page.locator('article')
    expect(art).to_have_attribute('dir', 'rtl')
    expect(art.get_by_role('heading', name='فاتورة')).to_be_visible()
    page.screenshot(path='/tmp/b_invoice_ar.png', full_page=True)
    page.emulate_media(media='print')
    page.screenshot(path='/tmp/b_invoice_print.png', full_page=True)
    page.emulate_media(media='screen')
    assert page.locator('aside').is_hidden() is False
    print('4. facture émise en arabe (RTL), compte figé, départ enregistré')

    # 5. Comptabilité : intégrité, export, avoir
    ctx2 = b.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    acc = ctx2.new_page()
    login_mfa(acc, 'compta@hotel.local')
    acc.get_by_role('link', name='Factures').click()
    acc.wait_for_url(BASE + '/invoices')
    expect(acc.get_by_role('link', name=re.compile(r'F\d{4}-000001'))).to_be_visible()
    acc.get_by_role('button', name='Vérifier les factures').click()
    expect(acc.get_by_text('1 pièce(s) vérifiée(s)')).to_be_visible()
    with acc.expect_download() as dl:
        acc.get_by_role('link', name='Télécharger le CSV').click()
    path = dl.value.path(); content = open(path, encoding='utf-8-sig').read()
    assert content.startswith('date;journal;piece;compte;libelle;debit;credit'), content[:60]
    assert '706100' in content and '511200' in content, content
    print(f'5. intégrité OK, export CSV téléchargé ({dl.value.suggested_filename}, {content.count(chr(10)) - 1} écritures)')

    acc.get_by_role('link', name=re.compile(r'F\d{4}-000001')).click()
    acc.get_by_role('button', name='Émettre un avoir').click()
    acc.locator('dialog[open]').get_by_label('Motif de l’avoir').fill('Minibar contesté par le client')
    acc.locator('dialog[open]').get_by_role('button', name='Émettre l’avoir').click()
    acc.wait_for_url(re.compile(r'/invoices/'))
    expect(acc.locator('article').get_by_role('heading', name='إشعار دائن')).to_be_visible()
    acc.screenshot(path='/tmp/b_credit.png', full_page=True)
    print('6. avoir émis par la comptabilité (même langue que la facture)')

    # 7. Le ménage ne voit pas les factures
    ctx3 = b.new_context(); hk = ctx3.new_page(); login(hk, 'menage@hotel.local'); hk.wait_for_url(BASE + '/')
    hk.wait_for_selector('nav a'); time.sleep(0.5)
    assert hk.get_by_role('link', name=re.compile('الفواتير|Factures')).count() == 0
    assert hk.request.get(BASE + '/api/v1/invoices').status == 403
    print('7. ménage : pas d’entrée « Factures », API 403')
    b.close()
