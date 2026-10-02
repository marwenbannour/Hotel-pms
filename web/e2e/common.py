"""Outils partagés par les scénarios de bout en bout (Playwright).

Chaque scénario suppose une base neuve « seed --demo-day » : c'est `run.py` qui la recrée avant
chaque scénario. Variables d'environnement :
  BASE         URL du serveur web (défaut http://127.0.0.1:3001)
  SHOTS        dossier des captures d'écran (défaut e2e/artifacts/<scénario>)
  CHROME_PATH  navigateur à utiliser à la place du Chromium de Playwright
  HEADED=1     afficher le navigateur
"""
import base64, hashlib, hmac, os, struct, sys, time
from contextlib import contextmanager
from playwright.sync_api import sync_playwright

# Accents lisibles aussi dans une console Windows.
for _stream in (sys.stdout, sys.stderr):
    _stream.reconfigure(encoding='utf-8', errors='replace')

BASE = os.environ.get('BASE', 'http://127.0.0.1:3001').rstrip('/')
PASSWORD = 'ChangeMe!2026'
SCENARIO = os.path.splitext(os.path.basename(sys.argv[0]))[0]
SHOTS = os.environ.get('SHOTS') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'artifacts', SCENARIO)

# Secrets MFA enrôlés pendant le scénario, pour les connexions suivantes du même compte.
_secrets: dict[str, str] = {}
_browsers = []


@contextmanager
def scenario():
    """Remplace sync_playwright() : en cas d'échec, capture chaque page encore ouverte avant de fermer."""
    with sync_playwright() as p:
        try:
            yield p
        except BaseException:
            n = 0
            for b in _browsers:
                for ctx in b.contexts if b.is_connected() else []:
                    for page in ctx.pages:
                        n += 1
                        try:
                            shot(page, f'failure-{n}', full_page=True)
                            print(f'Échec : capture {os.path.join(SHOTS, f"failure-{n}.png")} ({page.url})', file=sys.stderr)
                        except Exception:
                            pass
            raise


def launch(p):
    b = p.chromium.launch(
        executable_path=os.environ.get('CHROME_PATH') or None,
        headless=os.environ.get('HEADED') != '1',
    )
    _browsers.append(b)
    return b


def shot(page, name, **kwargs):
    os.makedirs(SHOTS, exist_ok=True)
    page.screenshot(path=os.path.join(SHOTS, f'{name}.png'), **kwargs)


def totp(secret: str) -> str:
    key = base64.b32decode(secret + '=' * (-len(secret) % 8))
    h = hmac.new(key, struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    o = h[-1] & 15
    return '%06d' % ((struct.unpack('>I', h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000)


def submit_credentials(page, email, password=PASSWORD):
    page.goto(BASE + '/login')
    page.fill('input[type=email]', email)
    page.fill('input[type=password]', password)
    page.click('form button')


def login(page, email, password=PASSWORD):
    """Profil sans double authentification : arrive sur le tableau de bord."""
    submit_credentials(page, email, password)
    page.wait_for_url(BASE + '/')


def _submit_code(page, secret):
    page.fill('input[autocomplete=one-time-code]', totp(secret))
    page.click('form button:not([type=button])')


def login_mfa(page, email):
    """Profil soumis à la double authentification : enrôlement au premier passage, puis code."""
    submit_credentials(page, email)
    if email not in _secrets:
        _secrets[email] = page.locator('code').inner_text(timeout=10_000).strip()
        _submit_code(page, _secrets[email])
        # Après activation, l'écran revient à la saisie du mot de passe.
        page.wait_for_selector('input[type=password]')
        submit_credentials(page, email)
    page.wait_for_selector('input[autocomplete=one-time-code]')
    _submit_code(page, _secrets[email])
    page.wait_for_url(BASE + '/')


def step(message):
    print(message, flush=True)
