import 'reflect-metadata'
import { DataSource } from 'typeorm'
import dotenv from 'dotenv'
import { User } from './entities/User.js'
import { Creator } from './entities/Creator.js'
import { Trend } from './entities/Trend.js'
import { ContentAsset } from './entities/ContentAsset.js'
import { Project } from './entities/Project.js'
import { AICache } from './entities/AICache.js'
import { PlatformMetric } from './entities/PlatformMetric.js'
import { ProjectVersion } from './entities/ProjectVersion.js'
import { TrendSummary } from './entities/TrendSummary.js'
import { ConversationMessage } from './entities/ConversationMessage.js'
import { Initial1710000000000 } from '../db/migrations/1710000000000-Initial.js'
import { Rls1710000001000 } from '../db/migrations/1710000001000-RLS.js'
import { MvpExtras1710000002000 } from '../db/migrations/1710000002000-MvpExtras.js'
import { ConversationsVersions1710000003000 } from '../db/migrations/1710000003000-ConversationsVersions.js'
import { VectorEmbeddings1710000004000 } from '../db/migrations/1710000004000-VectorEmbeddings.js'
import { ContentAssetsProjectId1710000005000 } from '../db/migrations/1710000005000-ContentAssetsProjectId.js'
import { PlatformMetrics1710000006000 } from '../db/migrations/1710000006000-PlatformMetrics.js'
import { TrendSummaries1710000007000 } from '../db/migrations/1710000007000-TrendSummaries.js'
import { GoogleOAuth1710000008000 } from '../db/migrations/1710000008000-GoogleOAuth.js'

dotenv.config()

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Creator, Trend, ContentAsset, Project, AICache, PlatformMetric, ProjectVersion, ConversationMessage, TrendSummary],
  migrations: [
    Initial1710000000000,
    Rls1710000001000,
    MvpExtras1710000002000,
    ConversationsVersions1710000003000,
    VectorEmbeddings1710000004000,
    ContentAssetsProjectId1710000005000,
    PlatformMetrics1710000006000,
    TrendSummaries1710000007000,
    GoogleOAuth1710000008000
  ],
  synchronize: false,
  logging: false,
})
