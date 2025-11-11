import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { ContentAsset } from '../db/entities/ContentAsset.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ ok: true }))

// Simple endpoint to echo that API is reachable for ingestion checks
export default router

