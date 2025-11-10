import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { AppDataSource } from './db/data-source'
import authRoutes from './routes/auth'
import creatorRoutes from './routes/creators'
import trendRoutes from './routes/trends'
import assetRoutes from './routes/assets'
import aiRoutes from './routes/ai'
import { authMiddleware, attachRls } from './middleware/auth'

dotenv.config()
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

async function main() {
  await AppDataSource.initialize()
  const app = express()
  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use('/auth', authRoutes)

  // secure routes
  app.use(authMiddleware, attachRls)
  app.use('/creators', creatorRoutes)
  app.use('/trends', trendRoutes)
  app.use('/assets', assetRoutes)
  app.use('/ai', aiRoutes)

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

