import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { appConfig } from '../config';
import { ENTITIES } from './entities';
import { InitialSchema1759200000000 } from './migrations/1759200000000-InitialSchema';
import { Billing1759300000000 } from './migrations/1759300000000-Billing';
import { UserAdmin1759400000000 } from './migrations/1759400000000-UserAdmin';
import { SnakeNamingStrategy } from './naming';

export const dataSourceOptions = (url = appConfig.databaseUrl): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities: ENTITIES,
  migrations: [InitialSchema1759200000000, Billing1759300000000, UserAdmin1759400000000],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
});

/** Utilisé par la CLI TypeORM : npx typeorm -d dist/database/data-source.js migration:run */
export default new DataSource(dataSourceOptions());
