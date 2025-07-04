/**
 * React integration for zerothrow
 *
 * This is a separate entry point to avoid forcing React as a dependency
 * for users who don't need React integration.
 *
 * Usage:
 *   import { useResult } from '@zerothrow/zerothrow/react';
 */

export { type UseResultState, useResult } from './react-hooks.js';
