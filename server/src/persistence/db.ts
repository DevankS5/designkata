import { mkdirSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { createModels, type Models } from './models.ts';

export interface Database {
  models: Models;
  description: string;
  close(): Promise<void>;
}

/**
 * Connects to MONGO_URI when it is set. Without it (local runs and reviews),
 * starts a local MongoDB that keeps its files in .data/mongo, so history
 * survives restarts and nobody has to install anything.
 */
export async function connectDatabase(uri: string | undefined, dataDir = path.resolve('.data/mongo')): Promise<Database> {
  if (uri) {
    const connection = await mongoose.createConnection(uri).asPromise();
    return { models: await createModels(connection), description: 'MongoDB (MONGO_URI)', close: () => connection.close() };
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mkdirSync(dataDir, { recursive: true });
  const server = await MongoMemoryServer.create({ instance: { dbPath: dataDir, storageEngine: 'wiredTiger' } });
  const connection = await mongoose.createConnection(server.getUri('designkata')).asPromise();
  return {
    models: await createModels(connection),
    description: `local MongoDB in ${path.relative(process.cwd(), dataDir) || dataDir}`,
    close: async () => {
      await connection.close();
      await server.stop({ doCleanup: false });
    },
  };
}
