"""Lance les scénarios de bout en bout sur une pile Docker isolée (docker-compose.e2e.yml).

  python web/e2e/run.py                    # construit la pile, joue tous les scénarios, arrête la pile
  python web/e2e/run.py guests reports     # seulement ces scénarios
  python web/e2e/run.py --keep             # laisse la pile tourner (relance plus rapide avec --reuse)
  python web/e2e/run.py --reuse guests     # réutilise une pile déjà démarrée, sans reconstruire

Avant chaque scénario, la base est recréée (schéma vide, migrations, journée de démonstration) :
les scénarios sont indépendants et peuvent tourner dans n'importe quel ordre.
"""
import argparse, os, subprocess, sys, time

# Accents lisibles aussi dans une console Windows.
for _stream in (sys.stdout, sys.stderr):
    _stream.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SCENARIOS = ['reservations', 'planning', 'billing', 'guests', 'housekeeping', 'reports', 'admin']
PORT = os.environ.get('E2E_PORT', '3101')
COMPOSE = ['docker', 'compose', '-f', os.path.join(ROOT, 'docker-compose.e2e.yml')]


def sh(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def reset_database():
    sh(COMPOSE + ['exec', '-T', 'db', 'psql', '-q', '-U', 'hotel', '-d', 'hotel', '-v', 'ON_ERROR_STOP=1',
                  '-c', 'SET client_min_messages TO warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'], stdout=subprocess.DEVNULL)
    sh(COMPOSE + ['exec', '-T', 'api', 'node', 'dist/database/seed.js', '--demo-day'], stdout=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('scenarios', nargs='*', metavar='scenario', help=', '.join(SCENARIOS))
    parser.add_argument('--keep', action='store_true', help='ne pas arrêter la pile à la fin')
    parser.add_argument('--reuse', action='store_true', help='utiliser la pile déjà démarrée (pas de build)')
    args = parser.parse_args()
    unknown = [s for s in args.scenarios if s not in SCENARIOS]
    if unknown:
        parser.error(f"scénario inconnu : {', '.join(unknown)} (choix : {', '.join(SCENARIOS)})")
    selected = args.scenarios or SCENARIOS

    if not args.reuse:
        print('Construction et démarrage de la pile e2e…', flush=True)
        sh(COMPOSE + ['up', '-d', '--build', '--wait'])

    results = []
    try:
        for name in selected:
            print(f'\n=== {name} ===', flush=True)
            started = time.monotonic()
            reset_database()
            env = {**os.environ, 'BASE': f'http://127.0.0.1:{PORT}', 'SHOTS': os.path.join(HERE, 'artifacts', name), 'PYTHONIOENCODING': 'utf-8'}
            code = subprocess.run([sys.executable, os.path.join(HERE, f'{name}.py')], cwd=HERE, env=env).returncode
            results.append((name, code == 0, time.monotonic() - started))
    finally:
        if not args.keep and not args.reuse:
            if any(not ok for _, ok, _ in results):
                # Journaux de l'API et du web utiles pour comprendre un échec en CI.
                subprocess.run(COMPOSE + ['logs', '--no-color', '--tail', '200', 'api', 'web'])
            sh(COMPOSE + ['down', '-v'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print('\nRésultat')
    for name, ok, seconds in results:
        print(f"  {'OK   ' if ok else 'ÉCHEC'}  {name:<14} {seconds:5.1f} s")
    failed = [n for n, ok, _ in results if not ok]
    if failed:
        print(f"\n{len(failed)} scénario(s) en échec. Captures : {os.path.join(HERE, 'artifacts')}")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
