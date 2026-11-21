import net from 'net';
import path from 'path';
import EmbeddedPostgres from 'embedded-postgres';

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

let pgInstance: any = null;

export async function ensurePostgresRunning(port = 5432): Promise<void> {
  const inUse = await isPortInUse(port);
  if (inUse) {
    console.log(`[PostgreSQL] Port ${port} is active, connecting to existing instance.`);
    return;
  }

  console.log(`[PostgreSQL] Starting embedded PostgreSQL 18 on port ${port}...`);
  const dataDir = path.resolve(__dirname, '../../data/db');
  pgInstance = new (EmbeddedPostgres as any)({
    port,
    user: 'postgres',
    password: 'password',
    database: 'factoryflow',
    persistent: true,
    dataDir,
  });

  try {
    await pgInstance.initialise();
  } catch (err: any) {
    // Already initialized
  }

  await pgInstance.start();
  console.log(`[PostgreSQL] Embedded PostgreSQL started successfully on port ${port}.`);

  process.on('SIGINT', async () => {
    if (pgInstance) {
      console.log('[PostgreSQL] Shutting down embedded PostgreSQL...');
      await pgInstance.stop();
      process.exit(0);
    }
  });

  process.on('SIGTERM', async () => {
    if (pgInstance) {
      await pgInstance.stop();
      process.exit(0);
    }
  });
}

// If run directly from CLI
if (require.main === module || process.argv[1]?.endsWith('pg-runner.ts')) {
  ensurePostgresRunning(5432).then(() => {
    console.log('[PostgreSQL] Runner is active. Press Ctrl+C to stop.');
  }).catch(err => {
    console.error('[PostgreSQL] Error:', err);
    process.exit(1);
  });
}
