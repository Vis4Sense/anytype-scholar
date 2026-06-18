import { useEffect, useState } from 'react';
import {
  DEFAULT_CONNECTION_SETTINGS,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionSettings,
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
  const [statusMessage, setStatusMessage] = useState('Checking local Anytype connection...');
  const [busyLabel, setBusyLabel] = useState('');

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    const stored = await loadConnectionSettings();
    setSettings(stored);

    const result = await browser.runtime.sendMessage({
      type: 'anytype:check-connection',
      payload: stored,
    });

    if (result.ok) {
      setViewState('connected');
      setStatusMessage('Connected to Anytype.');
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
      setSettings(nextSettings);
      setViewState('connected');
      setStatusMessage('Connected to Anytype.');
      setCode('');
    } else {
      setStatusMessage(formatMessage(result.message, result.status, result.statusText));
    }

    setBusyLabel('');
  }

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
        <p className="meta success">Anytype is connected.</p>
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
