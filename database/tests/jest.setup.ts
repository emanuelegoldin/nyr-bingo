import { closeTestConnection, getTestConnection } from './helpers/db-client';

beforeAll(async () => {
  await getTestConnection();
});

beforeEach(async () => {
  const conn = await getTestConnection();
  await conn.beginTransaction();
});

afterEach(async () => {
  const conn = await getTestConnection();
  await conn.rollback();
});

afterAll(async () => {
  await closeTestConnection();
});
