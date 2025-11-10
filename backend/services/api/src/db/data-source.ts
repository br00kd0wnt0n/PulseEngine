import 'reflect-metadata'
import { DataSource } from 'typeorm'
import dotenv from 'dotenv'
import { User } from './entities/User.js'
import { Creator } from './entities/Creator.js'
import { Trend } from './entities/Trend.js'
import { ContentAsset } from './entities/ContentAsset.js'
import { Initial1710000000000 } from '../db/migrations/1710000000000-Initial.js'
import { Rls1710000001000 } from '../db/migrations/1710000001000-RLS.js'

dotenv.config()

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Creator, Trend, ContentAsset],
  migrations: [Initial1710000000000, Rls1710000001000],
  synchronize: false,
  logging: false,
})

