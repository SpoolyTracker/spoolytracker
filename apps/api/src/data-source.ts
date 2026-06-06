import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'filament_user',
  password: process.env.DB_PASSWORD || 'filament_password',
  database: process.env.DB_DATABASE || 'filament_manager',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
  subscribers: [],
});
