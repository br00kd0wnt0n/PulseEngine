import 'reflect-metadata'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import multer from 'multer'
import crypto from 'crypto'
// lazy import heavy parsers
import dotenv from 'dotenv'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { DataSource } from 'typeorm'
import { ContentAsset } from './entities/ContentAsset.js'

dotenv.config()
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })
const upload = multer({ storage: multer.memoryStorage() })

const ds = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, entities: [ContentAsset] })

async function main() {
  console.log('Starting ingestion service...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET')

  const app = express()

  // Health check BEFORE all middleware - always responds immediately
  app.get('/health', (_req, res) => {
    console.log('Health endpoint called')
    res.status(200).send('OK')
    console.log('Health response sent')
  })

  app.get('/', (_req, res) => {
    res.status(200).send('Ingestion Service OK')
  })

  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '4mb' }))
  app.use(pinoHttp({ logger }))

  // URL parsing and social link extraction (lightweight placeholder)
  app.post('/ingest/url', async (req, res) => {
    try {
      const { url, ownerId, projectId } = req.body || {}
      if (!url || !ownerId) return res.status(400).json({ error: 'url and ownerId required' })
      await ds.query('SELECT app.set_current_user($1::uuid)', [ownerId])
      const parsed = parseUrl(url)

      // Generate embedding for URL content
      const embeddingText = formatForEmbedding({ name: parsed.title, metadata: parsed.metadata, tags: parsed.tags })
      const embedding = await generateEmbedding(embeddingText)

      const repo = ds.getRepository(ContentAsset)
      const a = repo.create({ name: parsed.title, url, tags: parsed.tags, metadata: parsed.metadata, ownerId, projectId: projectId || null })

      // Set embedding if generated
      if (embedding) {
        (a as any).embedding = `[${embedding.join(',')}]`
        logger.info(`[EMBEDDING] Saved embedding for URL: ${url}`)
      }

      await repo.save(a)
      res.status(201).json(a)
    } catch (e: any) {
      req.log?.error({ err: e }, 'ingest-url-failed')
      res.status(500).json({ error: 'url-ingestion-failed', detail: e?.message || 'unknown' })
    }
  })

  // Secure in-memory processing + minimal encrypted metadata storage
  app.post('/ingest/upload', upload.array('files'), async (req, res) => {
    try {
      const ownerId = (req.body?.ownerId as string) || ''
      const projectId = (req.body?.projectId as string) || null
      if (!ownerId) return res.status(400).json({ error: 'ownerId required' })
      await ds.query('SELECT app.set_current_user($1::uuid)', [ownerId])
      const files = (req.files as Express.Multer.File[]) || []
      const repo = ds.getRepository(ContentAsset)
      const saved = [] as any[]
      for (const f of files) {
        // 1) In-memory analysis
        const analysis = await analyzeFile(f)
        const insights = deriveInsights(analysis)

        // 2) Generate real embeddings for semantic search
        const embeddingText = formatForEmbedding({ name: f.originalname, metadata: analysis.metadata, tags: analysis.tags })
        const embedding = await generateEmbedding(embeddingText)

        // 3) Compose minimal metadata payload
        const payload = {
          schema: 'kb.v1',
          ownerId,
          projectId,
          name: f.originalname,
          size: f.size,
          mime: f.mimetype,
          extracted: {
            tags: analysis.tags,
            snippet: (analysis.metadata?.text || '').slice(0, 500),
            insights,
            hasEmbedding: embedding !== null,
          },
          createdAt: new Date().toISOString(),
        }
        // 4) Encrypt and store to object storage (optional; do not fail ingestion if misconfigured)
        try {
          const keyId = process.env.DATA_KEY_ID || 'v1'
          const enc = encryptPayload(payload, keyId)
          const store = await getObjectStore()
          const objectKey = `kb/${ownerId}/${Date.now()}_${safeName(f.originalname)}.json`
          await store.putObject(objectKey, enc.buffer, {
            contentType: 'application/octet-stream',
            metadata: { keyId, alg: 'AES-256-GCM', schema: 'kb.v1' },
          })
        } catch (e) {
          req.log?.error({ err: e }, 'object-store-failure-or-encryption-missing')
        }
        // 5) Persist reference row with embedding
        const a = repo.create({
          name: f.originalname,
          url: null,
          tags: analysis.tags,
          metadata: { insights, text: analysis.metadata?.text },
          ownerId,
          projectId
        })

        // Set embedding if generated
        if (embedding) {
          (a as any).embedding = `[${embedding.join(',')}]`
          logger.info(`[EMBEDDING] Saved embedding for: ${f.originalname}`)
        }

        saved.push(await repo.save(a))
        // 6) Ephemeral buffer auto-dropped by garbage collector
      }
      res.status(201).json(saved)
    } catch (e: any) {
      req.log?.error({ err: e }, 'ingest-upload-failed')
      res.status(500).json({ error: 'ingestion-failed', detail: e?.message || 'unknown' })
    }
  })

  // PDF/document analysis placeholder
  app.post('/ingest/pdf', upload.single('file'), async (req, res) => {
    try {
      const ownerId = (req.body?.ownerId as string) || ''
      const projectId = (req.body?.projectId as string) || null
      if (!ownerId || !req.file) return res.status(400).json({ error: 'ownerId and file required' })
      await ds.query('SELECT app.set_current_user($1::uuid)', [ownerId])
      const meta = await analyzeFile(req.file)

      // Generate embedding for PDF content
      const embeddingText = formatForEmbedding({ name: req.file.originalname, metadata: meta.metadata, tags: meta.tags })
      const embedding = await generateEmbedding(embeddingText)

      const repo = ds.getRepository(ContentAsset)
      const a = repo.create({ name: req.file.originalname, tags: meta.tags, metadata: meta.metadata, ownerId, projectId })

      // Set embedding if generated
      if (embedding) {
        (a as any).embedding = `[${embedding.join(',')}]`
        logger.info(`[EMBEDDING] Saved embedding for PDF: ${req.file.originalname}`)
      }

      await repo.save(a)
      res.status(201).json(a)
    } catch (e: any) {
      req.log?.error({ err: e }, 'ingest-pdf-failed')
      res.status(500).json({ error: 'pdf-ingestion-failed', detail: e?.message || 'unknown' })
    }
  })

  // Start server AFTER all routes are registered
  const port = Number(process.env.PORT || 8081)
  console.log('PORT env var:', process.env.PORT)
  console.log('Using port:', port)
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Ingestion service listening on 0.0.0.0:${port}`)
    logger.info(`Ingestion listening on ${port}`)
  })

  // Connect to database AFTER server is listening
  await ds.initialize()
  console.log('Database connected successfully')
}

function parseUrl(url: string) {
  const u = new URL(url)
  const host = u.hostname.replace('www.', '')
  const title = host + (u.pathname ? `:${u.pathname}` : '')
  const tags: Record<string, any> = { host, path: u.pathname }
  const metadata: Record<string, any> = {}
  if (/tiktok|youtube|instagram|x\.com|twitter/.test(host)) tags.platform = 'social'
  return { title, tags, metadata }
}

async function analyzeFile(f: Express.Multer.File) {
  const ext = (f.originalname.split('.').pop() || '').toLowerCase()
  const type = f.mimetype
  const tags: Record<string, any> = { ext, type }
  const metadata: Record<string, any> = { bytes: f.size }
  try {
    if (ext === 'txt') {
      const text = f.buffer.toString('utf-8')
      metadata.text = text.slice(0, 2000)
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth') as any
      const result = await mammoth.extractRawText({ buffer: f.buffer })
      metadata.text = String(result.value || '').slice(0, 4000)
    } else if (ext === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default as any
      const result = await pdfParse(f.buffer)
      metadata.text = String(result.text || '').slice(0, 4000)
    }
  } catch {
    // ignore parse errors in MVP
  }
  return { tags, metadata }
}

function deriveInsights(a: { tags: any; metadata: any }) {
  const text: string = a.metadata?.text || ''
  const keys = (text.toLowerCase().match(/ai|dance|remix|tutorial|gaming|retro/g) || [])
  const uniq = Array.from(new Set(keys))
  return { keyPhrases: uniq.slice(0, 8) }
}

/**
 * Generate real OpenAI embeddings for content
 * Uses text-embedding-3-small (1536 dimensions)
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    logger.warn('[EMBEDDING] No OPENAI_API_KEY, skipping embedding generation')
    return null
  }

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })

    logger.info('[EMBEDDING] Generating embedding for content')
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit to ~8k chars to stay within token limits
      encoding_format: 'float'
    })

    return response.data[0].embedding
  } catch (error) {
    logger.error({ err: error }, '[EMBEDDING] Failed to generate embedding')
    return null
  }
}

/**
 * Format content for embedding generation
 */
function formatForEmbedding(asset: { name: string; metadata?: any; tags?: any }): string {
  const parts = [asset.name]

  if (asset.metadata?.text) {
    // Include first 500 chars of extracted text
    parts.push(asset.metadata.text.substring(0, 500))
  }

  if (asset.tags?.ext) {
    parts.push(`type: ${asset.tags.ext}`)
  }

  return parts.join(', ')
}

function safeName(n: string) { return n.replace(/[^a-zA-Z0-9._-]/g, '_') }

function encryptPayload(data: any, keyId: string) {
  const key = process.env[`DATA_KEY_${keyId.toUpperCase()}`] || process.env.DATA_KEY
  if (!key) throw new Error('missing DATA_KEY')
  const keyBuf = Buffer.from(key, key.length === 64 ? 'hex' : 'base64')
  if (keyBuf.length !== 32) throw new Error('DATA_KEY must be 32 bytes (hex/base64)')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv)
  const plaintext = Buffer.from(JSON.stringify(data), 'utf-8')
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  // format: [keyIdLen|keyId|iv|tag|ciphertext]
  const kid = Buffer.from(keyId, 'utf-8')
  const header = Buffer.alloc(1)
  header.writeUInt8(kid.length)
  const buffer = Buffer.concat([header, kid, iv, tag, enc])
  return { buffer, iv: iv.toString('base64') }
}

// S3-compatible object store (Cloudflare R2, S3, GCS via S3 interface)
async function getObjectStore() {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const endpoint = process.env.OBJ_ENDPOINT // e.g., https://<accountid>.r2.cloudflarestorage.com
  const region = process.env.OBJ_REGION || 'auto'
  const bucket = process.env.OBJ_BUCKET || 'pulse-kb'
  const accessKeyId = process.env.OBJ_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.OBJ_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY
  if (!bucket) throw new Error('OBJ_BUCKET required')
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  })
  return {
    async putObject(key: string, body: Buffer, opts?: { contentType?: string; metadata?: Record<string, string> }) {
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: opts?.contentType, Metadata: opts?.metadata })
      await client.send(cmd)
    }
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  logger.error(e, 'Fatal');
  process.exit(1)
})
