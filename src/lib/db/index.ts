import { drizzle } from 'drizzle-orm/libsql';
import { createClient as createWebClient } from '@libsql/client/web';
import { createClient as createNodeClient } from '@libsql/client';
import * as schema from './schema';

// Check if we're using Turso (production) or local SQLite (development)
const isProduction = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

let db: ReturnType<typeof drizzle>;

if (isProduction) {
  // Production: Use Turso with HTTP/web client for better serverless compatibility
  const client = createWebClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  db = drizzle(client, { schema });
} else {
  // Development: Use local SQLite file with Node client
  const client = createNodeClient({
    url: 'file:./scraper/data/listings.db',
  });
  db = drizzle(client, { schema });
}

export { db };

// Export schema for use in other files
export * from './schema';
