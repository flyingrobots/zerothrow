import { ZT, ZeroThrow } from '../../packages/core/src/index.js';
import { execCmd, execCmdInteractive } from './shared.js';
import { platform } from 'os';
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  composeInstalled: boolean;
  composeVersion?: string;
  error?: ZeroThrow.ZeroError;
}

export function isRunningInDocker(): boolean {
  // Check common Docker indicators
  return (
    existsSync('/.dockerenv') || // Docker creates this file
    existsSync('/run/.containerenv') || // Podman creates this file
    (process.env.container === 'docker') || // Some images set this
    (existsSync('/proc/1/cgroup') && 
     require('fs').readFileSync('/proc/1/cgroup', 'utf8').includes('docker'))
  );
}

export interface DockerPruneOptions {
  all?: boolean;
  volumes?: boolean;
  force?: boolean;
}

export async function checkDockerStatus(): Promise<ZeroThrow.Result<DockerStatus, ZeroThrow.ZeroError>> {
  const status: DockerStatus = {
    installed: false,
    running: false,
    composeInstalled: false,
  };

  // Check if Docker is installed
  const versionResult = await execCmd('docker --version');
  if (versionResult.ok) {
    status.installed = true;
    status.version = versionResult.value.trim();
  } else {
    return ZT.ok(status);
  }

  // Check if Docker daemon is running
  const psResult = await execCmd('docker ps');
  if (psResult.ok) {
    status.running = true;
  }

  // Check for docker compose
  const composeResult = await execCmd('docker compose version');
  if (composeResult.ok) {
    status.composeInstalled = true;
    status.composeVersion = composeResult.value.trim();
  }

  return ZT.ok(status);
}

export async function startDocker(): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const spinner = ora('Starting Docker...').start();
  
  switch (platform()) {
    case 'darwin':
      // Try to start Docker Desktop on macOS
      const openResult = await execCmd('open -a Docker');
      if (!openResult.ok) {
        spinner.fail('Failed to start Docker Desktop');
        return openResult; // Result<never, ZeroError> is assignable to Result<void, ZeroError>
      }
      
      // Wait for Docker to start (max 30 seconds)
      for (let i = 0; i < 30; i++) {
        const checkResult = await execCmd('docker ps');
        if (checkResult.ok) {
          spinner.succeed('Docker is now running!');
          return ZT.ok(undefined);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        spinner.text = `Starting Docker... (${i + 1}/30)`;
      }
      
      spinner.fail('Docker failed to start within 30 seconds');
      return ZT.err(
        new ZeroThrow.ZeroError('DOCKER_START_TIMEOUT', 'Docker failed to start within 30 seconds')
      );
      
    case 'linux':
      spinner.text = 'Starting Docker daemon...';
      const systemctlResult = await execCmd('sudo systemctl start docker');
      if (!systemctlResult.ok) {
        spinner.fail('Failed to start Docker daemon');
        return systemctlResult;
      }
      spinner.succeed('Docker daemon started');
      return ZT.ok(undefined);
      
    case 'win32':
      spinner.fail('Please start Docker Desktop manually from the Start Menu');
      return ZT.err(
        new ZeroThrow.ZeroError('MANUAL_START_REQUIRED', 'Docker Desktop must be started manually on Windows')
      );
      
    default:
      spinner.fail('Unsupported platform');
      return ZT.err(
        new ZeroThrow.ZeroError('UNSUPPORTED_PLATFORM', `Platform ${platform()} is not supported`)
      );
  }
}

export function getDockerInstallCommand(): string {
  switch (platform()) {
    case 'darwin':
      return 'brew install --cask docker';
    case 'linux':
      return 'curl -fsSL https://get.docker.com | sh';
    case 'win32':
      return 'winget install Docker.DockerDesktop';
    default:
      return 'Visit https://docs.docker.com/get-docker/';
  }
}

export async function checkDiskSpace(): Promise<ZeroThrow.Result<{ available: number; used: number }, ZeroThrow.ZeroError>> {
  const result = await execCmd('docker system df --format json');
  if (!result.ok) return result;
  
  try {
    const data = JSON.parse(result.value);
    const total = data.reduce((acc: number, item: any) => acc + (item.Size || 0), 0);
    const reclaimable = data.reduce((acc: number, item: any) => acc + (item.Reclaimable || 0), 0);
    
    return ZT.ok({
      used: total,
      available: reclaimable,
    });
  } catch (e) {
    return ZT.err(
      ZeroThrow.wrap(e as Error, 'PARSE_ERROR', 'Failed to parse Docker disk usage')
    );
  }
}

export async function pruneDocker(options: DockerPruneOptions = {}): Promise<ZeroThrow.Result<string, ZeroThrow.ZeroError>> {
  const spinner = ora('Cleaning up Docker resources...').start();
  
  let cmd = 'docker system prune';
  if (options.all) cmd += ' --all';
  if (options.volumes) cmd += ' --volumes';
  if (options.force) cmd += ' --force';
  
  const result = await execCmd(cmd);
  
  if (result.ok) {
    spinner.succeed('Docker cleanup complete');
    return result;
  } else {
    spinner.fail('Docker cleanup failed');
    return result;
  }
}

export async function isContainerRunning(name: string): Promise<ZeroThrow.Result<boolean, ZeroThrow.ZeroError>> {
  const result = await execCmd(`docker ps --filter "name=${name}" --format "{{.Names}}"`);
  if (!result.ok) return result;
  
  return ZT.ok(result.value.includes(name));
}

export async function stopContainer(name: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const result = await execCmd(`docker stop ${name}`);
  if (!result.ok) return result;
  return ZT.ok(undefined);
}

export async function removeContainer(name: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const result = await execCmd(`docker rm -f ${name}`);
  if (!result.ok) return result;
  return ZT.ok(undefined);
}

export async function handleDockerError(error: ZeroThrow.ZeroError): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const message = error.message.toLowerCase();
  
  // Out of disk space
  if (message.includes('no space left') || message.includes('disk full')) {
    console.log(chalk.yellow('\n⚠️  Docker is out of disk space!'));
    
    const spaceResult = await checkDiskSpace();
    if (spaceResult.ok) {
      const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
      console.log(chalk.gray(`Used: ${mb(spaceResult.value.used)}MB`));
      console.log(chalk.gray(`Reclaimable: ${mb(spaceResult.value.available)}MB`));
    }
    
    console.log(chalk.blue('\nWould you like to clean up unused Docker resources?'));
    console.log(chalk.gray('This will remove:'));
    console.log(chalk.gray('  - Stopped containers'));
    console.log(chalk.gray('  - Unused networks'));
    console.log(chalk.gray('  - Dangling images'));
    console.log(chalk.gray('  - Build cache'));
    
    // In a real implementation, we'd prompt for confirmation
    // For now, return the error
    return ZT.err(
      new ZeroThrow.ZeroError('DOCKER_DISK_FULL', 'Docker is out of disk space', {
        context: {
          suggestion: 'Run "docker system prune -a" to free up space',
        }
      })
    );
  }
  
  // Docker daemon not running
  if (message.includes('cannot connect to the docker daemon')) {
    return await startDocker();
  }
  
  // Permission denied
  if (message.includes('permission denied')) {
    return ZT.err(
      new ZeroThrow.ZeroError('DOCKER_PERMISSION_DENIED', 'Docker requires elevated permissions', {
        context: {
          suggestion: platform() === 'linux' 
            ? 'Add your user to the docker group: sudo usermod -aG docker $USER'
            : 'Make sure Docker Desktop is running with proper permissions',
        }
      })
    );
  }
  
  // Unknown error
  return ZT.err(error);
}