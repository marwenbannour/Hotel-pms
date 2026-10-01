import { ProblemException } from './problem';

export const etagOf = (version: number) => `"${version}"`;

/** Contrôle de concurrence optimiste (section 22.1) : If-Match absent → 428, périmé → 412. */
export function assertIfMatch(ifMatch: string | undefined, currentVersion: number): void {
  if (!ifMatch) throw new ProblemException(428, 'PRECONDITION_REQUIRED');
  if (ifMatch.trim() === '*') return;
  const candidates = ifMatch.split(',').map((t) => t.trim().replace(/^W\//, ''));
  if (!candidates.includes(etagOf(currentVersion))) {
    throw new ProblemException(412, 'PRECONDITION_FAILED', `Version actuelle : ${etagOf(currentVersion)}.`);
  }
}
