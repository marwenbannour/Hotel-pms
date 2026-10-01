import { ApiError } from './api';

/** Répartit les erreurs 422 de l'API par champ ; le reste devient un message général. */
export function splitProblem(err: unknown): { fields: Record<string, string>; message: string | null } {
  if (!(err instanceof ApiError)) return { fields: {}, message: err ? String(err) : null };
  const list = (err.problem as { errors?: { field: string; messages: string[] }[] }).errors;
  if (list?.length) {
    return { fields: Object.fromEntries(list.map((e) => [e.field, e.messages[0]])), message: err.problem.detail ?? null };
  }
  return { fields: {}, message: err.message };
}
