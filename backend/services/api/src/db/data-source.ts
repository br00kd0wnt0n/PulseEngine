import 'reflect-metadata'
import { DataSource } from 'typeorm'
import dotenv from 'dotenv'
import { User } from './entities/User'
import { Creator } from './entities/Creator'
import { Trend } from './entities/Trend'
import { ContentAsset } from './entities/ContentAsset'
import { Initial1710000000000 } from '../db/migrations/1710000000000-Initial'
import { Rls1710000001000 } from '../db/migrations/1710000001000-RLS'

dotenv.config()

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Creator, Trend, ContentAsset],
  migrations: [Initial1710000000000, Rls1710000001000],
  synchronize: false,
  logging: false,
})

