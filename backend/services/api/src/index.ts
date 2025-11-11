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
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'
import projectRoutes from './routes/projects.js'
import ingestionRoutes from './routes/ingestion.js'
import { authMiddleware, attachRls } from './middleware/auth.js'

dotenv.config()
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

async function main() {
  await AppDataSource.initialize()
  try {
    await AppDataSource.runMigrations()
  } catch (e) {
    logger.warn({ err: e }, 'Migration run skipped or failed; proceeding')
  }
  const app = express()
  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  // Public routes
  app.use('/auth', authRoutes)
  app.use('/status', statusRoutes)
  app.use('/admin', adminRoutes)
  // Public AI endpoints for MVP (no auth required)
  app.use('/ai', aiRoutes)
  app.use('/public', publicRoutes)

  // Secure routes (require authentication)
  app.use(authMiddleware, attachRls)
  app.use('/creators', creatorRoutes)
  app.use('/trends', trendRoutes)
  app.use('/assets', assetRoutes)
  app.use('/projects', projectRoutes)
  app.use('/ingest', ingestionRoutes)

  // error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    reqLog(_req).error({ err }, 'Unhandled error')
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' })
  })

  const port = Number(process.env.PORT || 8080)
  app.listen(port, () => logger.info(`API listening on ${port}`))
}

function reqLog(req: express.Request) {
  return (req as any).log || logger
}

main().catch((e) => {
  logger.error(e, 'Fatal startup error')
  process.exit(1)
})
