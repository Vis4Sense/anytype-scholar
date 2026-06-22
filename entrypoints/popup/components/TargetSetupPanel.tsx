import { Icon } from '@iconify/react';
import infoIcon from '@iconify-icons/lucide/info';
import hashIcon from '@iconify-icons/lucide/hash';
import linkIcon from '@iconify-icons/lucide/link';
import plusIcon from '@iconify-icons/lucide/plus';
import tagsIcon from '@iconify-icons/lucide/tags';
import xIcon from '@iconify-icons/lucide/x';
import type {
  AnytypeConnectionSettings,
  AnytypeProperty,
  AnytypePropertyOverride,
  AnytypeSpace,
  AnytypeTemplate,
  AnytypeType,
} from '@/lib/anytype';

type Message = {
  kind: 'error' | 'success';
  text: string;
} | null;

type SchemaMapping = {
  property: (typeof import('@/lib/anytype').REQUIRED_PAPER_PROPERTIES)[number];
  action: string;
};

type TargetSetupPanelProps = {
  settings: AnytypeConnectionSettings;
  properties: AnytypeProperty[];
  typeProperties: AnytypeProperty[];
  spaces: AnytypeSpace[];
  types: AnytypeType[];
  templates: AnytypeTemplate[];
  selectedTypeName: string;
  busyLabel: string;
  isCreatingType: boolean;
  newTypeName: string;
  typeActionMessage: Message;
  schemaExpanded: boolean;
  schemaActionMessage: Message;
  missingTypePropertiesLength: number;
  schemaExamples: string;
  schemaMappings: SchemaMapping[];
  missingSpaceProperties: Array<(typeof import('@/lib/anytype').REQUIRED_PAPER_PROPERTIES)[number]>;
  compactSelectClass: string;
  compactInlineButtonClass: string;
  inlineButtonClass: string;
  onTargetSpaceChange: (value: string) => void;
  onTargetTypeChange: (value: string) => void;
  onTargetTemplateChange: (value: string) => void;
  onAddOverride: () => void;
  onRemoveOverride: (index: number) => void;
  onOverridePropertyNameChange: (index: number, value: string) => void;
  onOverrideValueChange: (index: number, value: string) => void;
  onToggleCreateType: () => void;
  onNewTypeNameChange: (value: string) => void;
  onCreateType: () => void;
  onToggleSchemaExpanded: () => void;
  onApproveSchemaUpdate: () => void;
};

export function TargetSetupPanel({
  settings,
  properties,
  typeProperties,
  spaces,
  types,
  templates,
  selectedTypeName,
  busyLabel,
  isCreatingType,
  newTypeName,
  typeActionMessage,
  schemaExpanded,
  schemaActionMessage,
  missingTypePropertiesLength,
  schemaExamples,
  schemaMappings,
  missingSpaceProperties,
  compactSelectClass,
  compactInlineButtonClass,
  inlineButtonClass,
  onTargetSpaceChange,
  onTargetTypeChange,
  onTargetTemplateChange,
  onAddOverride,
  onRemoveOverride,
  onOverridePropertyNameChange,
  onOverrideValueChange,
  onToggleCreateType,
  onNewTypeNameChange,
  onCreateType,
  onToggleSchemaExpanded,
  onApproveSchemaUpdate,
}: TargetSetupPanelProps) {
  return (
    <>
      <div className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
        <label className="contents">
          <span className="text-xs font-medium text-zinc-700">Target Space</span>
          <select
            className={compactSelectClass}
            value={settings.targetSpaceId}
            onChange={(event) => onTargetSpaceChange(event.target.value)}>
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
            <span className="text-xs font-medium text-zinc-700">Target Type</span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
              <select
                className={compactSelectClass}
                value={settings.targetTypeId}
                onChange={(event) => onTargetTypeChange(event.target.value)}>
                <option value="">Choose a type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <button
                className={compactInlineButtonClass}
                disabled={Boolean(busyLabel)}
                type="button"
                onClick={onToggleCreateType}>
                + New
              </button>
            </div>

            {isCreatingType ? (
              <div className="col-span-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2.5">
                <div aria-hidden="true" />
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-0.5 text-xs text-zinc-950 outline-none transition focus:border-zinc-950"
                      placeholder="Paper"
                      type="text"
                      value={newTypeName}
                      onChange={(event) => onNewTypeNameChange(event.target.value)}
                    />
                    <button
                      className={compactInlineButtonClass}
                      disabled={Boolean(busyLabel) || !newTypeName.trim()}
                      type="button"
                      onClick={onCreateType}>
                      Create
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <label className="contents">
              <span className="text-xs font-medium text-zinc-700">Target Template</span>
              <select
                className={compactSelectClass}
                value={settings.targetTemplateId}
                onChange={(event) => onTargetTemplateChange(event.target.value)}>
                <option value="">No template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.icon ? `${template.icon} ` : ''}
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            {typeActionMessage ? (
              <p
                className={`col-start-2 text-sm ${
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
        <div className="mt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-700">Property Overrides</span>
            <button
              aria-label="Add property override"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:text-zinc-950 disabled:cursor-wait disabled:opacity-70"
              disabled={Boolean(busyLabel)}
              type="button"
              onClick={onAddOverride}>
              <Icon icon={plusIcon} className="text-sm" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-2">
            {settings.targetPropertyOverrides.map((override, index) => (
              <PropertyOverrideRow
                key={`${index}-${override.propertyName}`}
                override={override}
                property={findMatchingProperty(typeProperties, override.propertyName)}
                onPropertyNameChange={(value) =>
                  onOverridePropertyNameChange(index, value)
                }
                onRemove={() => onRemoveOverride(index)}
                onValueChange={(value) => onOverrideValueChange(index, value)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {settings.targetSpaceId &&
      settings.targetTypeId &&
      missingTypePropertiesLength > 0 ? (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-zinc-600">
              {missingTypePropertiesLength} missing
              {schemaExamples ? `: ${schemaExamples}` : ''}.
            </p>
            <button
              className="shrink-0 text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-950 hover:underline"
              type="button"
              onClick={onToggleSchemaExpanded}>
              {schemaExpanded ? 'Hide' : 'Details'}
            </button>
            <button
              className="shrink-0 rounded-md bg-zinc-950 px-2 py-1 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70"
              disabled={Boolean(busyLabel)}
              type="button"
              onClick={onApproveSchemaUpdate}>
              Approve
            </button>
          </div>

          {schemaExpanded ? (
            <div className="mt-2 space-y-1.5 border-t border-zinc-200 pt-2">
              {schemaMappings.map(({ property, action }) => (
                <div
                  className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-[0.6875rem] leading-snug"
                  key={property.key}>
                  <span className="font-medium text-zinc-700">{property.name}</span>
                  <span className="text-zinc-500">
                    {action}
                    {missingSpaceProperties.some((item) => item.key === property.key)
                      ? ` (${property.format})`
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {schemaActionMessage ? (
            <p
              className={`mt-2 text-xs ${
                schemaActionMessage.kind === 'error'
                  ? 'text-amber-800'
                  : 'text-emerald-700'
              }`}>
              {schemaActionMessage.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

type PropertyOverrideRowProps = {
  override: AnytypePropertyOverride;
  property?: AnytypeProperty;
  onPropertyNameChange: (value: string) => void;
  onRemove: () => void;
  onValueChange: (value: string) => void;
};

function PropertyOverrideRow({
  override,
  property,
  onPropertyNameChange,
  onRemove,
  onValueChange,
}: PropertyOverrideRowProps) {
  const formatMeta = getPropertyFormatMeta(property?.format, override.value);
  const matchState = property
    ? {
        iconClassName: 'text-sky-600',
        statusLabel: `Matched property key: ${property.key}`,
      }
    : {
        iconClassName: 'text-zinc-400',
        statusLabel: 'No matching property key found.',
      };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
        <span className="shrink-0" title={matchState.statusLabel}>
          <Icon
            icon={formatMeta.icon}
            className={`text-xs ${matchState.iconClassName}`}
            aria-hidden="true"
          />
        </span>
        <input
          className="min-w-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 outline-none transition focus:border-zinc-950"
          placeholder="Resource Type"
          type="text"
          value={override.propertyName}
          onChange={(event) => onPropertyNameChange(event.target.value)}
          title={matchState.statusLabel}
        />
        <input
          className="min-w-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 outline-none transition focus:border-zinc-950"
          placeholder='["paper"]'
          type="text"
          value={override.value}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:text-zinc-950"
          type="button"
          onClick={onRemove}
          aria-label="Remove property override">
          <Icon icon={xIcon} className="text-sm" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function findMatchingProperty(properties: AnytypeProperty[], propertyName: string) {
  const normalized = normalizePropertyName(propertyName);
  return properties.find((property) => normalizePropertyName(property.name) === normalized);
}

function getPropertyFormatMeta(format?: string, overrideValue?: string) {
  const normalized = normalizePropertyName(format ?? '');
  const looksLikeListValue = isJsonStringList(overrideValue);

  if (normalized === 'number') {
    return {
      icon: hashIcon,
      label: 'number',
    };
  }

  if (normalized === 'url') {
    return {
      icon: linkIcon,
      label: 'url',
    };
  }

  if (
    normalized.includes('select') ||
    normalized.includes('tag') ||
    normalized.includes('status') ||
    (!normalized && looksLikeListValue)
  ) {
    return {
      icon: tagsIcon,
      label: format || 'tag/select',
    };
  }

  if (normalized === 'text') {
    return {
      icon: infoIcon,
      label: 'text',
    };
  }

  return {
    icon: infoIcon,
    label: format || 'unmatched',
  };
}

function isJsonStringList(value?: string) {
  const trimmedValue = value?.trim() ?? '';

  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string');
  } catch {
    return false;
  }
}

function normalizePropertyName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
