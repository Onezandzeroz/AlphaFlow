/**
 * Database client with robust SQLite path resolution
 *
 * The Prisma schema (prisma/schema.prisma) defines:
 *   url = "file:./db/custom.db"
 *
 * This is relative to the prisma/ directory, so the actual file is:
 *   <project-root>/prisma/db/custom.db
 *
 * This module resolves the path to match that location from any CWD,
 * ensuring both Prisma CLI commands and the Next.js app use the SAME database.
 *
 * Override: Set DATABASE_URL env var to use a custom location.
 */

import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

/**
 * Resolves the SQLite database path.
 *
 * Priority:
 *   1. Default: <CWD>/prisma/db/custom.db (matches Prisma schema resolution)
 *   2. DATABASE_URL env var (if explicitly set AND the DB file exists)
 *
 * If DATABASE_URL points to a non-existent file but the default path exists,
 * the default path is used instead. This prevents broken env vars from
 * creating empty databases.
 */
function resolveDatabaseUrl(): string {
  // The canonical path — matches where prisma db push creates the database
  // Schema: prisma/schema.prisma → url = "file:./db/custom.db" → prisma/db/custom.db
  const defaultPath = path.resolve(process.cwd(), 'prisma', 'db', 'custom.db')
  const defaultDir = path.dirname(defaultPath)

  // Ensure the prisma/db directory exists
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true })
  }

  const defaultExists = fs.existsSync(defaultPath)

  // Check for DATABASE_URL override
  const envUrl = process.env.DATABASE_URL

  if (envUrl && envUrl.startsWith('file:')) {
    const envPath = envUrl.replace('file:', '')
    const absoluteEnvPath = path.isAbsolute(envPath)
      ? envPath
      : path.resolve(process.cwd(), envPath)

    const envDir = path.dirname(absoluteEnvPath)
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
    }

    const envExists = fs.existsSync(absoluteEnvPath)

    if (envExists) {
      // DATABASE_URL points to an existing file — use it
      console.error(`[DB] Using DATABASE_URL: file:${absoluteEnvPath}`)
      return `file:${absoluteEnvPath}`
    }

    if (defaultExists) {
      // DATABASE_URL points to non-existent file, but default DB exists
      // This prevents accidentally creating a second empty database
      console.error(`[DB] DATABASE_URL file not found, using default path: file:${defaultPath}`)
      return `file:${defaultPath}`
    }

    // Neither exists — use DATABASE_URL path (user may want to create a new DB there)
    console.error(`[DB] Using DATABASE_URL (new database): file:${absoluteEnvPath}`)
    return `file:${absoluteEnvPath}`
  }

  // No DATABASE_URL override — use the default Prisma-resolved path
  console.error(`[DB] Using default path: file:${defaultPath}`)
  return `file:${defaultPath}`
}

// Resolve the database URL
const resolvedUrl = resolveDatabaseUrl()

// Ensure Prisma internals also use this path
process.env.DATABASE_URL = resolvedUrl

// Log diagnostic info
const dbFilePath = resolvedUrl.replace('file:', '')
console.error(`[DB] CWD: ${process.cwd()}`)
console.error(`[DB] Resolved path: ${dbFilePath}`)
console.error(`[DB] DB exists: ${fs.existsSync(dbFilePath)}`)

// Singleton pattern for development (prevents multiple connections)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolvedUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
