import { useEffect, useState } from 'react';
import {
  DEFAULT_CONNECTION_SETTINGS,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionCheckResult,
  type AnytypeConnectionSettings,
  type AnytypeSpace,
  loadConnectionSettings,
  saveConnectionSettings,
} from '@/lib/anytype';
import './App.css';

type ViewState = 'checking' | 'disconnected' | 'awaiting-code' | 'connected';

function App() {
  const [settings, setSettings] = useState<AnytypeConnectionSettings>(
    DEFAULT_CONNECTION_SETTINGS,
  );
  const [viewState, setViewState] = useState<ViewState>('checking');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [spaces, setSpaces] = useState<AnytypeSpace[]>([]);
  const [statusMessage, setStatusMessage] = useState('Checking local Anytype connection...');
  const [busyLabel, setBusyLabel] = useState('');

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    const stored = await loadConnectionSettings();
    setSettings(stored);

    const result = (await browser.runtime.sendMessage({
      type: 'anytype:check-connection',
      payload: stored,
    })) as AnytypeConnectionCheckResult;

    if (result.ok) {
      const nextSettings = await syncSpaces(stored, result.spaces ?? []);
      setSettings(nextSettings);
      setViewState('connected');
      setStatusMessage(
        nextSettings.targetSpaceId
          ? 'Connected to Anytype.'
          : 'Connected to Anytype. Choose a target Space to continue.',
      );
      return;
    }

    setViewState('disconnected');
    setStatusMessage('Not connected yet.');
  }

  async function handleConnect() {
    setBusyLabel('Connecting...');
    setStatusMessage('Requesting a login code from Anytype...');

    const result = (await browser.runtime.sendMessage({
      type: 'anytype:create-challenge',
      payload: settings,
    })) as AnytypeChallengeResult;

    if (result.ok && result.challengeId) {
      setChallengeId(result.challengeId);
      setViewState('awaiting-code');
      setStatusMessage(
        'A 4-digit code should now appear in the Anytype desktop app. Enter it below to finish connecting.',
      );
    } else {
      setViewState('disconnected');
      setStatusMessage(formatMessage(result.message, result.status, result.statusText));
    }

    setBusyLabel('');
  }

  async function handleSubmitCode() {
    setBusyLabel('Verifying...');
    setStatusMessage('Exchanging the code for an API key...');

    const result = (await browser.runtime.sendMessage({
      type: 'anytype:create-api-key',
      payload: {
        settings,
        challengeId,
        code,
      },
    })) as AnytypeApiKeyResult;

    if (result.ok && result.apiKey) {
      const nextSettings = {
        ...settings,
        apiToken: result.apiKey,
      };
      await saveConnectionSettings(nextSettings);
      const { settings: syncedSettings, message } = await refreshSpaces(nextSettings);
      setSettings(syncedSettings);
      setViewState('connected');
      setStatusMessage(
        message ||
          (syncedSettings.targetSpaceId
          ? 'Connected to Anytype.'
          : 'Connected to Anytype. Choose a target Space to continue.'),
      );
      setCode('');
    } else {
      setStatusMessage(formatMessage(result.message, result.status, result.statusText));
    }

    setBusyLabel('');
  }

  async function refreshSpaces(baseSettings: AnytypeConnectionSettings) {
    const result = (await browser.runtime.sendMessage({
      type: 'anytype:list-spaces',
      payload: baseSettings,
    })) as {
      ok: boolean;
      message: string;
      spaces?: AnytypeSpace[];
      status?: number;
      statusText?: string;
    };

    if (!result.ok) {
      setSpaces([]);
      return {
        settings: baseSettings,
        message: formatMessage(result.message, result.status, result.statusText),
      };
    }

    return {
      settings: await syncSpaces(baseSettings, result.spaces ?? []),
      message: '',
    };
  }

  async function syncSpaces(
    baseSettings: AnytypeConnectionSettings,
    nextSpaces: AnytypeSpace[],
  ) {
    setSpaces(nextSpaces);

    const hasSavedSpace = nextSpaces.some((space) => space.id === baseSettings.targetSpaceId);
    const nextTargetSpaceId = hasSavedSpace ? baseSettings.targetSpaceId : (nextSpaces[0]?.id ?? '');

    if (nextTargetSpaceId === baseSettings.targetSpaceId) {
      return baseSettings;
    }

    const nextSettings = {
      ...baseSettings,
      targetSpaceId: nextTargetSpaceId,
    };
    await saveConnectionSettings(nextSettings);
    return nextSettings;
  }

  async function handleTargetSpaceChange(targetSpaceId: string) {
    const nextSettings = {
      ...settings,
      targetSpaceId,
    };

    setSettings(nextSettings);
    await saveConnectionSettings(nextSettings);
    setStatusMessage('Connected to Anytype.');
  }

  const selectedSpace = spaces.find((space) => space.id === settings.targetSpaceId);

  return (
    <main className="app-shell">
      <p className="eyebrow">Anytype Scholar</p>
      <h1>{viewState === 'connected' ? 'Connected' : 'Connect to Anytype'}</h1>
      <p className="intro">{statusMessage}</p>

      {viewState === 'checking' ? <p className="meta">Checking...</p> : null}

      {viewState === 'disconnected' ? (
        <button disabled={Boolean(busyLabel)} onClick={() => void handleConnect()}>
          {busyLabel || 'Connect to Anytype'}
        </button>
      ) : null}

      {viewState === 'awaiting-code' ? (
        <>
          <label className="field">
            <span>4-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </label>

          <button
            disabled={code.trim().length !== 4 || Boolean(busyLabel)}
            onClick={() => void handleSubmitCode()}>
            {busyLabel || 'Finish connection'}
          </button>
        </>
      ) : null}

      {viewState === 'connected' ? (
        <>
          <label className="field">
            <span>Target Space</span>
            <select
              value={settings.targetSpaceId}
              onChange={(event) => void handleTargetSpaceChange(event.target.value)}>
              {spaces.length === 0 ? (
                <option value="">No spaces available</option>
              ) : null}
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>

          <p className="meta success">
            {selectedSpace
              ? `Anytype is connected. Imports will go to ${selectedSpace.name}.`
              : 'Anytype is connected.'}
          </p>
        </>
      ) : null}
    </main>
  );
}

function formatMessage(message: string, status?: number, statusText?: string) {
  if (typeof status !== 'number') {
    return message;
  }

  return `${message} HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
}

export default App;
