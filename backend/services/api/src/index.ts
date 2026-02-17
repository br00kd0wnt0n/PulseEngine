import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { AppDataSource } from './db/data-source.js'
import authRoutes from './routes/auth.js'
import creatorRoutes from './routes/creators.js'
import trendRoutes from './routes/trends.js'
import assetRoutes from './routes/assets.js'
import aiRoutes from './routes/ai.js'
import statusRoutes from './routes/status.js'
import promptsRoutes from './routes/prompts.js'
import searchRoutes from './routes/search.js'
import adminRoutes from './routes/admin.js'
import projectRoutes from './routes/projects.js'
import versionsRoutes from './routes/versions.js'
import conversationRoutes from './routes/conversation.js'
import { authMiddleware, attachRls } from './middleware/auth.js'
import { startTrendCollector } from './services/scheduler/trend-collector.js'
import trendsSummaryRoutes from './routes/trends-summary.js'
import gwiRoutes from './routes/gwi.js'

dotenv.config()
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

async function main() {
  await AppDataSource.initialize()

  // Run migrations - fail loudly if there are issues
  try {
    logger.info('Running database migrations...')
    const migrations = await AppDataSource.runMigrations()
    if (migrations.length > 0) {
      logger.info({ migrations: migrations.map(m => m.name) }, 'Migrations completed successfully')
    } else {
      logger.info('No pending migrations')
    }
  } catch (e) {
    logger.error({ err: e }, 'FATAL: Database migration failed')
    logger.error('Application cannot start with failed migrations. Please fix the database schema.')
    throw new Error(`Migration failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  const app = express()

  // Helmet with relaxed cross-origin policy for CORS
  app.use(helmet({ crossOriginResourcePolicy: false }))

  // Robust CORS configuration - must be before routes
  const allowed = [
    'https://pulseengine-production.up.railway.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000'
  ]

  const corsOptions = {
    origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return cb(null, true) // allow curl/postman
      const ok = allowed.includes(origin) || /\.up\.railway\.app$/i.test(origin)
      cb(ok ? null : new Error('Not allowed by CORS'), ok)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-seed-token'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }

  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions)) // handle preflight for all routes

  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  // Public routes (no auth)
  app.use('/auth', authRoutes)
  app.use('/status', statusRoutes)
  app.use('/search', searchRoutes)
  app.use('/trends/summary', trendsSummaryRoutes)
  app.use('/ai', aiRoutes)
  app.use('/gwi', gwiRoutes)

  // Secure routes (require authentication)
  app.use(authMiddleware, attachRls)
  app.use('/admin', adminRoutes)
  app.use('/prompts', promptsRoutes)
  app.use('/creators', creatorRoutes)
  app.use('/trends', trendRoutes)
  app.use('/assets', assetRoutes)
  app.use('/projects', projectRoutes)
  app.use('/projects/:id/versions', versionsRoutes)
  app.use('/projects/:id/conversation', conversationRoutes)

  // error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    reqLog(_req).error({ err }, 'Unhandled error')
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' })
  })

  const port = Number(process.env.PORT || 8080)
  app.listen(port, () => {
    logger.info(`API listening on ${port}`)

    // Start daily trend collection scheduler
    startTrendCollector()
  })
}

function reqLog(req: express.Request) {
  return (req as any).log || logger
}

main().catch((e) => {
  logger.error(e, 'Fatal startup error')
  process.exit(1)
})
