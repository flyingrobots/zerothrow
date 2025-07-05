import { describe, it, expect } from 'vitest';
import { isRunningInDocker, getDockerInstallCommand } from '../src/index';

describe('@zerothrow/docker', () => {
  describe('isRunningInDocker', () => {
    it('should return boolean', () => {
      const result = isRunningInDocker();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getDockerInstallCommand', () => {
    it('should return a string command', () => {
      const command = getDockerInstallCommand();
      expect(typeof command).toBe('string');
      expect(command.length).toBeGreaterThan(0);
    });
  });
});