import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { ZT, ZeroThrow } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface TestEnvironment {
  containerId: string;
  networkName: string;
  port: number;
  composeFile: string;
}


export function createTestEnvironment(): TestEnvironment {
  // Generate unique identifiers
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const containerId = `zt_test_${timestamp}_${random}`;
  const networkName = `zt_net_${timestamp}_${random}`;
  
  // Find available port between 5433-5500
  const port = 5433 + Math.floor(Math.random() * 67);
  
  // Create docker-compose file from template
  const templatePath = join(__dirname, 'docker-compose.test.yml.template');
  const template = readFileSync(templatePath, 'utf8');
  const composeContent = template
    .replace(/\${CONTAINER_PREFIX}/g, containerId)
    .replace(/\${NETWORK_NAME}/g, networkName)
    .replace(/\${PG_PORT}/g, port.toString());
  
  // Use OS temp directory for compose files - automatically cleaned up by OS
  const composeFile = join(tmpdir(), `docker-compose.${containerId}.yml`);
  writeFileSync(composeFile, composeContent);
  
  return {
    containerId,
    networkName,
    port,
    composeFile
  };
}

export async function startTestDatabase(env: TestEnvironment): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  // Clean up any existing containers first
  const cleanupResult = ZT.try(() => 
    execSync(`docker compose -f ${env.composeFile} down -v`, {
      stdio: 'pipe'
    })
  );
  // Ignore cleanup errors - containers might not exist
  
  const startResult = ZT.try(() =>
    execSync(`docker compose -f ${env.composeFile} up -d`, {
      stdio: process.env.DEBUG_TESTS ? 'inherit' : 'pipe'
    })
  );
  
  if (!startResult.ok) {
    console.error(`Failed to start test database: ${startResult.error.message}`);
    return startResult as ZeroThrow.Result<void, ZeroThrow.ZeroError>;
  }
  
  // Wait for PostgreSQL to be ready
  let retries = 30;
  while (retries > 0) {
    const pgReadyResult = ZT.try(() =>
      execSync(
        `docker exec ${env.containerId}_postgres pg_isready -U testuser`,
        { stdio: 'pipe' }
      )
    );
    
    if (pgReadyResult.ok) {
      // pg_isready succeeded, now try to actually connect
      const connectResult = ZT.try(() =>
        execSync(
          `docker exec ${env.containerId}_postgres psql -U testuser -d testdb -c "SELECT 1"`,
          { stdio: 'pipe' }
        )
      );
      
      if (connectResult.ok) {
        console.log('PostgreSQL is ready and accepting queries');
        return ZT.ok(undefined);
      }
    }
    
    retries--;
    if (retries === 0) {
      return ZT.err(new ZeroThrow.ZeroError('PG_START_FAILED', 'PostgreSQL failed to start'));
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return ZT.err(new ZeroThrow.ZeroError('PG_START_TIMEOUT', 'PostgreSQL startup timeout'));
}

export async function stopTestDatabase(env: TestEnvironment): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  // Stop and remove containers
  const stopResult = ZT.try(() =>
    execSync(`docker compose -f ${env.composeFile} down -v`, {
      stdio: process.env.DEBUG_TESTS ? 'inherit' : 'pipe'
    })
  );
  
  if (!stopResult.ok) {
    console.error(`Failed to stop test database: ${stopResult.error.message}`);
    // Don't return error - we want cleanup to be best effort
  }
  
  // Clean up compose file
  const cleanupResult = ZT.try(() => {
    if (existsSync(env.composeFile)) {
      unlinkSync(env.composeFile);
    }
  });
  
  if (!cleanupResult.ok) {
    console.error(`Failed to clean up compose file: ${cleanupResult.error.message}`);
    // Don't return error - we want cleanup to be best effort
  }
  
  return ZT.ok(undefined);
}

export function getTestDatabaseConfig(env: TestEnvironment) {
  return {
    host: 'localhost',
    port: env.port,
    database: 'testdb',
    user: 'testuser',
    password: 'testpass',
    max: 5,
  };
}