import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';
import { createModels, type Models } from '../src/persistence/models.ts';
import './global-setup.ts';

/** A fresh database on the shared test MongoDB. Call close() in afterAll. */
export async function testDatabase(): Promise<{ models: Models; close: () => Promise<void> }> {
  const connection = await mongoose
    .createConnection(inject('mongoUri'), { dbName: `test_${randomUUID().slice(0, 8)}` })
    .asPromise();
  const models = await createModels(connection);
  return {
    models,
    close: async () => {
      await connection.dropDatabase();
      await connection.close();
    },
  };
}
