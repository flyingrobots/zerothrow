import React, { useReducer, useCallback } from 'react';
import { Result, ZeroThrow, ZT } from '@zerothrow/core';
const { ZeroError } = ZeroThrow;

// State management with Result types
type AsyncState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ZeroError };

type AsyncAction<T> = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: T }
  | { type: 'FETCH_ERROR'; payload: ZeroError }
  | { type: 'RESET' };

function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', data: action.payload };
    case 'FETCH_ERROR':
      return { status: 'error', error: action.payload };
    case 'RESET':
      return { status: 'idle' };
    default:
      return state;
  }
}

// Custom hook for managing async operations with Result
export function useAsyncState<T>() {
  const [state, dispatch] = useReducer<React.Reducer<AsyncState<T>, AsyncAction<T>>>(
    asyncReducer,
    { status: 'idle' }
  );

  const execute = useCallback(async (asyncOperation: () => Promise<Result<T, ZeroError>>) => {
    dispatch({ type: 'FETCH_START' });
    
    const result = await asyncOperation();
    
    if (result.ok) {
      dispatch({ type: 'FETCH_SUCCESS', payload: result.value });
    } else {
      dispatch({ type: 'FETCH_ERROR', payload: result.error });
    }
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, execute, reset };
}

// Example: User settings component
interface UserSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}

export function UserSettingsManager({ userId }: { userId: string }) {
  const { state, execute, reset } = useAsyncState<UserSettings>();

  const loadSettings = useCallback(async () => {
    await execute(async () => {
      // Simulate API call with ZT.try
      return ZT.try(async () => {
        const response = await fetch(`/api/users/${userId}/settings`);
        
        if (!response.ok) {
          throw new Error(`Failed to load settings: ${response.statusText}`);
        }
        
        return await response.json() as UserSettings;
      }, (error) => new ZeroError(
        'SETTINGS_LOAD_ERROR',
        'Failed to load user settings',
        { userId, cause: error }
      ));
    });
  }, [userId, execute]);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    await execute(async () => {
      return ZT.try(async () => {
        const response = await fetch(`/api/users/${userId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update settings: ${response.statusText}`);
        }
        
        return await response.json() as UserSettings;
      }, (error) => new ZeroError(
        'SETTINGS_UPDATE_ERROR',
        'Failed to update user settings',
        { userId, updates, cause: error }
      ));
    });
  }, [userId, execute]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="settings-manager">
      {state.status === 'idle' && (
        <button onClick={loadSettings}>Load Settings</button>
      )}
      
      {state.status === 'loading' && (
        <div className="loading">Loading settings...</div>
      )}
      
      {state.status === 'error' && (
        <div className="error">
          <h3>Error loading settings</h3>
          <p>{state.error.message}</p>
          <button onClick={loadSettings}>Retry</button>
        </div>
      )}
      
      {state.status === 'success' && (
        <SettingsForm 
          settings={state.data} 
          onUpdate={updateSettings}
          onReset={reset}
        />
      )}
    </div>
  );
}

// Settings form component
function SettingsForm({ 
  settings, 
  onUpdate,
  onReset 
}: { 
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => Promise<void>;
  onReset: () => void;
}) {
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(localSettings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <div className="form-group">
        <label>
          Theme:
          <select 
            value={localSettings.theme}
            onChange={(e) => setLocalSettings(prev => ({ 
              ...prev, 
              theme: e.target.value as 'light' | 'dark' 
            }))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="form-group">
        <label>
          <input 
            type="checkbox"
            checked={localSettings.notifications}
            onChange={(e) => setLocalSettings(prev => ({ 
              ...prev, 
              notifications: e.target.checked 
            }))}
          />
          Enable notifications
        </label>
      </div>

      <div className="form-group">
        <label>
          Language:
          <select 
            value={localSettings.language}
            onChange={(e) => setLocalSettings(prev => ({ 
              ...prev, 
              language: e.target.value 
            }))}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button type="button" onClick={onReset}>
          Cancel
        </button>
      </div>
    </form>
  );
}