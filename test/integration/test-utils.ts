import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { ZT, ZeroThrow } from '../../src/index.js';

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
  
  const composeFile = join(__dirname, `docker-compose.${containerId}.yml`);
  writeFileSync(composeFile, composeContent);
  
  return {
    containerId,
    networkName,
    port,
    composeFile
  };
}

export async function startTestDatabase(env: TestEnvironment): Promise<void> {
  try {
    execSync(`docker compose -f ${env.composeFile} up -d`, {
      stdio: process.env.DEBUG_TESTS ? 'inherit' : 'pipe'
    });
    
    // Wait for PostgreSQL to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        execSync(
          `docker exec ${env.containerId}_postgres pg_isready -U testuser`,
          { stdio: 'pipe' }
        );
        break;
      } catch {
        retries--;
        if (retries === 0) throw new Error('PostgreSQL failed to start');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error(`Failed to start test database: ${error}`);
    throw error;
  }
}

export async function stopTestDatabase(env: TestEnvironment): Promise<void> {
  try {
    // Stop and remove containers
    execSync(`docker compose -f ${env.composeFile} down -v`, {
      stdio: process.env.DEBUG_TESTS ? 'inherit' : 'pipe'
    });
    
    // Clean up compose file
    if (existsSync(env.composeFile)) {
      unlinkSync(env.composeFile);
    }
  } catch (error) {
    console.error(`Failed to stop test database: ${error}`);
    // Don't throw - we want cleanup to be best effort
  }
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