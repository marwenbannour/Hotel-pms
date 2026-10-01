import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** Propriétés camelCase côté TypeScript, colonnes snake_case côté PostgreSQL. */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  columnName(propertyName: string, customName: string | undefined, prefixes: string[]): string {
    const prefix = prefixes.length ? `${snake(prefixes.join('_'))}_` : '';
    return prefix + (customName ?? snake(propertyName));
  }
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return `${snake(relationName)}_${referencedColumnName}`;
  }
}
