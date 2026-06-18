import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import checkCircle2 from '@iconify-icons/lucide/check-circle-2';
import {
  DEFAULT_CONNECTION_SETTINGS,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionCheckResult,
  type AnytypeConnectionSettings,
  type AnytypeImportResult,
  type AnytypeProperty,
  type AnytypeSpace,
  type AnytypeType,
  type AnytypeTypeDetail,
  REQUIRED_PAPER_PROPERTIES,
  loadConnectionSettings,
  saveConnectionSettings,
} from '@/lib/anytype';
import { parseBibtexEntries } from '@/lib/bibtex';
import { BibtexImportPanel } from './components/BibtexImportPanel';
import { ConnectionPanel } from './components/ConnectionPanel';
import { TargetSetupPanel } from './components/TargetSetupPanel';

type ViewState = 'checking' | 'disconnected' | 'awaiting-code' | 'connected';
type InlineMessage = {
  kind: 'error' | 'success';
  text: string;
} | null;

const fieldLabelClass = 'mb-2 block text-sm font-medium text-zinc-700';
const inputClass =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950';
const textAreaClass =
  'min-h-36 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950';
const buttonClass =
  'mt-5 w-full rounded-xl border border-zinc-950 bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70';
const inlineButtonClass =
  'rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-70';
const compactInlineButtonClass =
  'rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-70';
const compactSelectClass =
  'w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 outline-none transition focus:border-zinc-950';

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
  const [selectedTypeDetailTypeId, setSelectedTypeDetailTypeId] = useState('');
  const [selectedTypeDetailLoading, setSelectedTypeDetailLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking local Anytype connection...');
  const [busyLabel, setBusyLabel] = useState('');
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [typeActionMessage, setTypeActionMessage] = useState<InlineMessage>(null);
  const [schemaExpanded, setSchemaExpanded] = useState(false);
  const [schemaActionMessage, setSchemaActionMessage] = useState<InlineMessage>(null);
  const [bibtexInput, setBibtexInput] = useState('');
  const [parsedEntries, setParsedEntries] = useState<
    ReturnType<typeof parseBibtexEntries>
  >([]);
  const [parseMessage, setParseMessage] = useState<InlineMessage>(null);
  const [importResult, setImportResult] = useState<AnytypeImportResult | null>(null);

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

    if (!result.ok) {
      setViewState('disconnected');
      setStatusMessage('Not connected yet.');
      return;
    }

    const nextSettings = await syncSpaces(stored, result.spaces ?? []);
    await refreshSchema(nextSettings);
    setSettings(nextSettings);
    setViewState('connected');
    setStatusMessage(
      nextSettings.targetSpaceId
        ? 'Connected to Anytype.'
        : 'Connected to Anytype. Choose a target Space to continue.',
    );
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
    resetSetupMessages();
    setParsedEntries([]);
    setParseMessage(null);
    setImportResult(null);
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
    resetSetupMessages();
    setImportResult(null);
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
    setBusyLabel('Preparing schema...');

    const schemaResult = (await browser.runtime.sendMessage({
      type: 'anytype:prepare-paper-type',
      payload: {
        settings: nextSettings,
        typeId: result.type.id,
        typeName: result.type.name,
      },
    })) as {
      ok: boolean;
      message: string;
      type?: AnytypeTypeDetail;
      status?: number;
      statusText?: string;
    };

    if (schemaResult.ok) {
      setSelectedTypeDetail(schemaResult.type ?? null);
      setTypeActionMessage({
        kind: 'success',
        text: `${result.type.name} is ready.`,
      });
      setSchemaActionMessage(null);
    } else {
      setTypeActionMessage({
        kind: 'success',
        text: `${result.type.name} was created.`,
      });
      setSchemaActionMessage({
        kind: 'error',
        text: formatMessage(schemaResult.message, schemaResult.status, schemaResult.statusText),
      });
    }

    await refreshSchema(nextSettings);
    setSchemaExpanded(false);
    setBusyLabel('');
  }

  async function handleApproveSchemaUpdate() {
    if (!settings.targetTypeId || !selectedType) {
      return;
    }

    setBusyLabel('Updating schema...');
    setSchemaActionMessage(null);

    const result = (await browser.runtime.sendMessage({
      type: 'anytype:prepare-paper-type',
      payload: {
        settings,
        typeId: settings.targetTypeId,
        typeName: selectedType.name,
      },
    })) as {
      ok: boolean;
      message: string;
      type?: AnytypeTypeDetail;
      status?: number;
      statusText?: string;
    };

    if (!result.ok) {
      setSchemaActionMessage({
        kind: 'error',
        text: formatMessage(result.message, result.status, result.statusText),
      });
      setBusyLabel('');
      return;
    }

    setSelectedTypeDetail(result.type ?? null);
    await refreshSchema(settings);
    setSchemaExpanded(false);
    setSchemaActionMessage({
      kind: 'success',
      text: 'Schema is ready.',
    });
    setBusyLabel('');
  }

  async function refreshSelectedType(
    baseSettings: AnytypeConnectionSettings,
    typeId: string,
  ) {
    if (!typeId) {
      setSelectedTypeDetail(null);
      setSelectedTypeDetailTypeId('');
      setSelectedTypeDetailLoading(false);
      return;
    }

    setSelectedTypeDetail(null);
    setSelectedTypeDetailTypeId(typeId);
    setSelectedTypeDetailLoading(true);

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
      setSelectedTypeDetailTypeId(typeId);
      setSelectedTypeDetailLoading(false);
      setStatusMessage(formatMessage(result.message, result.status, result.statusText));
      return;
    }

    setSelectedTypeDetail(result.type ?? null);
    setSelectedTypeDetailTypeId(typeId);
    setSelectedTypeDetailLoading(false);
  }

  function handleParseBibtex() {
    const nextEntries = parseBibtexEntries(bibtexInput);

    if (nextEntries.length === 0) {
      setParsedEntries([]);
      setParseMessage({
        kind: 'error',
        text: 'No BibTeX entries were found.',
      });
      setImportResult(null);
      return;
    }

    setParsedEntries(nextEntries);
    setParseMessage({
      kind: 'success',
      text: `Parsed ${nextEntries.length} entr${nextEntries.length === 1 ? 'y' : 'ies'}.`,
    });
    setImportResult(null);
  }

  async function handleImportBibtex() {
    if (!settings.targetSpaceId || !settings.targetTypeId) {
      setParseMessage({
        kind: 'error',
        text: 'Choose a target Space and Type first.',
      });
      return;
    }

    if (missingTypeProperties.length > 0) {
      setParseMessage({
        kind: 'error',
        text: 'Approve the schema changes before importing.',
      });
      return;
    }

    const nextEntries = parseBibtexEntries(bibtexInput);
    if (nextEntries.length === 0) {
      setParsedEntries([]);
      setParseMessage({
        kind: 'error',
        text: 'No BibTeX entries were found.',
      });
      setImportResult(null);
      return;
    }

    setParsedEntries(nextEntries);
    setParseMessage({
      kind: 'success',
      text: `Parsed ${nextEntries.length} entr${nextEntries.length === 1 ? 'y' : 'ies'}.`,
    });
    setBusyLabel('Importing...');

    const result = (await browser.runtime.sendMessage({
      type: 'anytype:import-bibtex',
      payload: {
        settings,
        bibtex: bibtexInput,
      },
    })) as AnytypeImportResult;

    setImportResult(result);
    setBusyLabel('');
  }

  function resetSetupMessages() {
    setIsCreatingType(false);
    setNewTypeName('');
    setTypeActionMessage(null);
    setSchemaExpanded(false);
    setSchemaActionMessage(null);
  }

  const selectedSpace = spaces.find((space) => space.id === settings.targetSpaceId);
  const selectedType = types.find((type) => type.id === settings.targetTypeId);
  const availablePropertyKeys = new Set(
    properties.flatMap((property) => [
      normalizePropertyName(property.key),
      normalizePropertyName(property.name),
    ]),
  );
  const attachedPropertyKeys = new Set(
    selectedTypeDetail?.propertyKeys.map((key) => normalizePropertyName(key)) ?? [],
  );
  const missingSpaceProperties = REQUIRED_PAPER_PROPERTIES.filter(
    (property) =>
      !availablePropertyKeys.has(normalizePropertyName(property.key)) &&
      !availablePropertyKeys.has(normalizePropertyName(property.name)),
  );
  const missingTypeProperties =
    settings.targetTypeMode === 'existing' &&
    !selectedTypeDetailLoading &&
    selectedTypeDetailTypeId === settings.targetTypeId &&
    selectedTypeDetail
      ? REQUIRED_PAPER_PROPERTIES.filter((property) => {
          const presentOnType =
            attachedPropertyKeys.has(normalizePropertyName(property.key)) ||
            attachedPropertyKeys.has(normalizePropertyName(property.name));
          return !presentOnType;
        })
      : [];
  const schemaExamples = missingTypeProperties
    .slice(0, 3)
    .map((property) => property.name)
    .join(', ');
  const schemaMappings = missingTypeProperties.map((property) => {
    const existingProperty = properties.find(
      (availableProperty) =>
        normalizePropertyName(availableProperty.key) ===
          normalizePropertyName(property.key) ||
        normalizePropertyName(availableProperty.name) ===
          normalizePropertyName(property.name),
    );

    return {
      property,
      action: existingProperty
        ? `Attach existing ${existingProperty.name}`
        : `Create ${property.name}`,
    };
  });
  const connectedMessage =
    viewState === 'connected' && statusMessage.startsWith('Connected to Anytype')
      ? ''
      : statusMessage;
  const canImport =
    viewState === 'connected' &&
    Boolean(settings.targetSpaceId) &&
    Boolean(settings.targetTypeId) &&
    missingTypeProperties.length === 0 &&
    !selectedTypeDetailLoading;
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

      <ConnectionPanel
        viewState={viewState}
        statusMessage={statusMessage}
        busyLabel={busyLabel}
        code={code}
        fieldLabelClass={fieldLabelClass}
        inputClass={inputClass}
        buttonClass={buttonClass}
        onCodeChange={setCode}
        onConnect={() => void handleConnect()}
        onSubmitCode={() => void handleSubmitCode()}
      />

      {viewState === 'connected' ? (
        <>
          {connectedMessage ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {connectedMessage}
            </div>
          ) : null}

          <TargetSetupPanel
            settings={settings}
            spaces={spaces}
            types={types}
            selectedTypeName={selectedType?.name ?? ''}
            busyLabel={busyLabel}
            isCreatingType={isCreatingType}
            newTypeName={newTypeName}
            typeActionMessage={typeActionMessage}
            schemaExpanded={schemaExpanded}
            schemaActionMessage={schemaActionMessage}
            missingTypePropertiesLength={missingTypeProperties.length}
            schemaExamples={schemaExamples}
            schemaMappings={schemaMappings}
            missingSpaceProperties={missingSpaceProperties}
            compactSelectClass={compactSelectClass}
            compactInlineButtonClass={compactInlineButtonClass}
            inlineButtonClass={inlineButtonClass}
            onTargetSpaceChange={(value) => void handleTargetSpaceChange(value)}
            onTargetTypeChange={(value) => void handleTargetTypeChange(value)}
            onToggleCreateType={() => {
              setIsCreatingType((value) => !value);
              setNewTypeName('');
              setTypeActionMessage(null);
            }}
            onNewTypeNameChange={setNewTypeName}
            onCreateType={() => void handleCreateType()}
            onToggleSchemaExpanded={() => setSchemaExpanded((value) => !value)}
            onApproveSchemaUpdate={() => void handleApproveSchemaUpdate()}
          />

          <BibtexImportPanel
            bibtexInput={bibtexInput}
            parseMessage={parseMessage}
            importResult={importResult}
            busyLabel={busyLabel}
            canImport={canImport}
            onBibtexInputChange={(value) => {
              setBibtexInput(value);
              setParseMessage(null);
              setImportResult(null);
            }}
            onImportBibtex={() => void handleImportBibtex()}
          />
        </>
      ) : null}
    </main>
  );
}

function normalizePropertyName(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatMessage(message: string, status?: number, statusText?: string) {
  if (typeof status !== 'number') {
    return message;
  }

  return `${message} HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
}

export default App;
