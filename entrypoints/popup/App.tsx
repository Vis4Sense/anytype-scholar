import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import checkCircle2 from '@iconify-icons/lucide/check-circle-2';
import {
  DEFAULT_CONNECTION_SETTINGS,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionCheckResult,
  type AnytypeConnectionSettings,
  type AnytypeProperty,
  type AnytypeSpace,
  type AnytypeType,
  type AnytypeTypeDetail,
  REQUIRED_PAPER_PROPERTIES,
  loadConnectionSettings,
  saveConnectionSettings,
} from '@/lib/anytype';

type ViewState = 'checking' | 'disconnected' | 'awaiting-code' | 'connected';

const fieldLabelClass = 'mb-2 block text-sm font-medium text-zinc-700';
const inputClass =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950';
const buttonClass =
  'mt-5 w-full rounded-xl border border-zinc-950 bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70';
const inlineButtonClass =
  'rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-70';

function App() {
  const [settings, setSettings] = useState<AnytypeConnectionSettings>(
    DEFAULT_CONNECTION_SETTINGS,
  );
  const [viewState, setViewState] = useState<ViewState>('checking');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [spaces, setSpaces] = useState<AnytypeSpace[]>([]);
  const [types, setTypes] = useState<AnytypeType[]>([]);
  const [properties, setProperties] = useState<AnytypeProperty[]>([]);
  const [selectedTypeDetail, setSelectedTypeDetail] = useState<AnytypeTypeDetail | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState('Checking local Anytype connection...');
  const [busyLabel, setBusyLabel] = useState('');
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [typeActionMessage, setTypeActionMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

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
      await refreshSchema(nextSettings);
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
      await refreshSchema(syncedSettings);
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

  async function refreshSchema(baseSettings: AnytypeConnectionSettings) {
    if (!baseSettings.targetSpaceId) {
      setTypes([]);
      setProperties([]);
      setSelectedTypeDetail(null);
      return;
    }

    const [typesResult, propertiesResult] = await Promise.all([
      browser.runtime.sendMessage({
        type: 'anytype:list-types',
        payload: baseSettings,
      }) as Promise<{
        ok: boolean;
        message: string;
        types?: AnytypeType[];
        status?: number;
        statusText?: string;
      }>,
      browser.runtime.sendMessage({
        type: 'anytype:list-properties',
        payload: baseSettings,
      }) as Promise<{
        ok: boolean;
        message: string;
        properties?: AnytypeProperty[];
        status?: number;
        statusText?: string;
      }>,
    ]);

    setTypes(typesResult.ok ? typesResult.types ?? [] : []);
    setProperties(propertiesResult.ok ? propertiesResult.properties ?? [] : []);

    if (!typesResult.ok) {
      setStatusMessage(
        formatMessage(typesResult.message, typesResult.status, typesResult.statusText),
      );
      return;
    }

    if (
      baseSettings.targetTypeMode === 'existing' &&
      baseSettings.targetTypeId &&
      (typesResult.types ?? []).some((type) => type.id === baseSettings.targetTypeId)
    ) {
      await refreshSelectedType(baseSettings, baseSettings.targetTypeId);
      return;
    }

    setSelectedTypeDetail(null);
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
      targetTypeId: '',
    };

    setSettings(nextSettings);
    setIsCreatingType(false);
    setNewTypeName('');
    setTypeActionMessage(null);
    await saveConnectionSettings(nextSettings);
    await refreshSchema(nextSettings);
    setStatusMessage('Connected to Anytype.');
  }

  async function handleTargetTypeChange(targetTypeId: string) {
    const nextSettings = {
      ...settings,
      targetTypeId,
      targetTypeMode: 'existing' as const,
    };

    setSettings(nextSettings);
    setIsCreatingType(false);
    setNewTypeName('');
    setTypeActionMessage(null);
    await saveConnectionSettings(nextSettings);
    await refreshSelectedType(nextSettings, targetTypeId);
  }

  async function handleCreateType() {
    const name = newTypeName.trim();

    if (!name) {
      setTypeActionMessage({
        kind: 'error',
        text: 'Enter a type name first.',
      });
      return;
    }

    setBusyLabel('Creating type...');
    setTypeActionMessage(null);
    const result = (await browser.runtime.sendMessage({
      type: 'anytype:create-type',
      payload: {
        settings,
        name,
      },
    })) as {
      ok: boolean;
      message: string;
      type?: AnytypeType;
      status?: number;
      statusText?: string;
    };

    if (!result.ok || !result.type) {
      setTypeActionMessage({
        kind: 'error',
        text: formatMessage(result.message, result.status, result.statusText),
      });
      setBusyLabel('');
      return;
    }

    const nextSettings = {
      ...settings,
      targetTypeId: result.type.id,
      targetTypeMode: 'existing' as const,
    };

    setSettings(nextSettings);
    setIsCreatingType(false);
    setNewTypeName('');
    await saveConnectionSettings(nextSettings);
    await refreshSchema(nextSettings);
    await refreshSelectedType(nextSettings, result.type.id);
    setTypeActionMessage({
      kind: 'success',
      text: `${result.type.name} is ready.`,
    });
    setBusyLabel('');
  }

  async function refreshSelectedType(
    baseSettings: AnytypeConnectionSettings,
    typeId: string,
  ) {
    if (!typeId) {
      setSelectedTypeDetail(null);
      return;
    }

    const result = (await browser.runtime.sendMessage({
      type: 'anytype:get-type',
      payload: {
        settings: baseSettings,
        typeId,
      },
    })) as {
      ok: boolean;
      message: string;
      type?: AnytypeTypeDetail;
      status?: number;
      statusText?: string;
    };

    if (!result.ok) {
      setSelectedTypeDetail(null);
      setStatusMessage(formatMessage(result.message, result.status, result.statusText));
      return;
    }

    setSelectedTypeDetail(result.type ?? null);
  }

  const selectedSpace = spaces.find((space) => space.id === settings.targetSpaceId);
  const selectedType = types.find((type) => type.id === settings.targetTypeId);
  const availablePropertyKeys = new Set(
    properties.flatMap((property) => [property.key, normalizePropertyName(property.name)]),
  );
  const attachedPropertyKeys = new Set(
    selectedTypeDetail?.propertyKeys.flatMap((key) => [key, normalizePropertyName(key)]) ?? [],
  );
  const missingSpaceProperties = REQUIRED_PAPER_PROPERTIES.filter(
    (property) =>
      !availablePropertyKeys.has(property.key) &&
      !availablePropertyKeys.has(normalizePropertyName(property.name)),
  );
  const missingTypeProperties =
    settings.targetTypeMode === 'existing'
      ? REQUIRED_PAPER_PROPERTIES.filter((property) => {
          const presentOnType =
            attachedPropertyKeys.has(property.key) ||
            attachedPropertyKeys.has(normalizePropertyName(property.name));
          return !presentOnType;
        })
      : REQUIRED_PAPER_PROPERTIES;
  const connectedMessage =
    viewState === 'connected' && statusMessage.startsWith('Connected to Anytype')
      ? ''
      : statusMessage;
  const connectionBadge =
    viewState === 'connected'
      ? {
          label: 'Connected',
          className: 'bg-emerald-50 text-emerald-700',
          ariaLabel: 'Connected to Anytype',
        }
      : viewState === 'checking'
        ? {
            label: 'Checking',
            className: 'bg-zinc-100 text-zinc-600',
            ariaLabel: 'Checking Anytype connection',
          }
        : viewState === 'awaiting-code'
          ? {
              label: 'Waiting for code',
              className: 'bg-amber-50 text-amber-700',
              ariaLabel: 'Waiting for connection code',
            }
          : {
              label: 'Not connected',
              className: 'bg-zinc-100 text-zinc-600',
              ariaLabel: 'Not connected to Anytype',
            };

  return (
    <main className="max-h-96 w-80 overflow-y-auto bg-white px-5 py-5 text-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-500">
          Anytype Scholar
        </p>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${connectionBadge.className}`}
          aria-label={connectionBadge.ariaLabel}
          title={connectionBadge.ariaLabel}>
          {viewState === 'connected' ? (
            <Icon className="text-xs" icon={checkCircle2} aria-hidden="true" />
          ) : null}
          <span>{connectionBadge.label}</span>
        </div>
      </div>

      {viewState !== 'connected' && viewState !== 'disconnected' ? (
        <>
          <p className="mt-2.5 text-sm text-zinc-600">{statusMessage}</p>
        </>
      ) : null}

      {viewState === 'checking' ? <p className="mt-4 text-sm text-zinc-500">Checking...</p> : null}

      {viewState === 'disconnected' ? (
        <>
          <h1 className="mt-4 text-center text-lg font-semibold leading-tight text-zinc-950">
            Welcome to Anytype Scholar!
          </h1>
          <button
            className={buttonClass}
            disabled={Boolean(busyLabel)}
            onClick={() => void handleConnect()}>
            {busyLabel || 'Connect to Anytype'}
          </button>
        </>
      ) : null}

      {viewState === 'awaiting-code' ? (
        <>
          <label className="mt-5 block">
            <span className={fieldLabelClass}>4-digit code</span>
            <input
              className={inputClass}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </label>

          <button
            className={buttonClass}
            disabled={code.trim().length !== 4 || Boolean(busyLabel)}
            onClick={() => void handleSubmitCode()}>
            {busyLabel || 'Connect'}
          </button>
        </>
      ) : null}

      {viewState === 'connected' ? (
        <>
          {connectedMessage ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {connectedMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            <label className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2.5">
              <span className="text-xs font-medium text-zinc-700">Target Space</span>
              <select
                className="w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
                value={settings.targetSpaceId}
                onChange={(event) => void handleTargetSpaceChange(event.target.value)}>
                {spaces.length === 0 ? <option value="">No spaces available</option> : null}
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>

            {settings.targetSpaceId ? (
              <>
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2.5">
                  <span className="text-xs font-medium text-zinc-700">Target Type</span>
                  <select
                    className="w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
                    value={settings.targetTypeId}
                    onChange={(event) => void handleTargetTypeChange(event.target.value)}>
                    <option value="">Choose a type</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className={inlineButtonClass}
                    disabled={Boolean(busyLabel)}
                    type="button"
                    onClick={() => {
                      setIsCreatingType((value) => !value);
                      setNewTypeName('');
                      setTypeActionMessage(null);
                    }}>
                    + New
                  </button>
                </div>

                {isCreatingType ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
                        placeholder="Paper"
                        type="text"
                        value={newTypeName}
                        onChange={(event) => setNewTypeName(event.target.value)}
                      />
                      <button
                        className={inlineButtonClass}
                        disabled={Boolean(busyLabel) || !newTypeName.trim()}
                        type="button"
                        onClick={() => void handleCreateType()}>
                        Create
                      </button>
                    </div>
                  </div>
                ) : null}

                {typeActionMessage ? (
                  <p
                    className={`text-sm ${
                      typeActionMessage.kind === 'error'
                        ? 'text-amber-800'
                        : 'text-emerald-700'
                    }`}>
                    {typeActionMessage.text}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          {settings.targetSpaceId ? (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <span className={fieldLabelClass}>Schema Check</span>
                {!settings.targetTypeId ? (
                  <p className="text-sm text-zinc-600">
                    Choose a target type, or create a new one, to inspect its fields.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-zinc-600">
                      {selectedType
                        ? `Using ${selectedType.name}. Missing fields shown below should be added with user approval.`
                        : 'Choose an existing type to inspect its fields.'}
                    </p>
                    {missingTypeProperties.length === 0 ? (
                      <p className="mt-3 text-sm font-medium text-emerald-700">
                        This type already looks ready for paper import.
                      </p>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
                        {missingTypeProperties.map((property) => (
                          <li key={property.key}>
                            {property.name}
                            {missingSpaceProperties.some((item) => item.key === property.key)
                              ? ' (new property needed in space)'
                              : ' (attach to this type)'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
            </div>
          ) : null}

          <p className="mt-4 text-sm text-zinc-700">
            {selectedSpace
              ? `Anytype is connected. Imports will go to ${selectedSpace.name}.`
              : 'Anytype is connected.'}
          </p>
        </>
      ) : null}
    </main>
  );
}

function normalizePropertyName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function formatMessage(message: string, status?: number, statusText?: string) {
  if (typeof status !== 'number') {
    return message;
  }

  return `${message} HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
}

export default App;
