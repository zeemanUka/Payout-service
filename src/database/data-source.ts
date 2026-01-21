import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';


export function dataSourceOptionsFactory(config: ConfigService): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.get<string>('DATABASE_HOST', 'localhost'),
    port: Number(config.get<string>('DATABASE_PORT', '5432')),
    username: config.get<string>('DATABASE_USER', 'postgres'),
    password: config.get<string>('DATABASE_PASSWORD', 'postgres'),
    database: config.get<string>('DATABASE_NAME', 'straitpay'),
    entities: [],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
    logging: false
  };
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'straitpay',
  entities: [],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false
});
