import type {
  AnytypeConnectionSettings,
  AnytypeProperty,
  AnytypeSpace,
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
  spaces: AnytypeSpace[];
  types: AnytypeType[];
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
  onToggleCreateType: () => void;
  onNewTypeNameChange: (value: string) => void;
  onCreateType: () => void;
  onToggleSchemaExpanded: () => void;
  onApproveSchemaUpdate: () => void;
};

export function TargetSetupPanel({
  settings,
  spaces,
  types,
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
  onToggleCreateType,
  onNewTypeNameChange,
  onCreateType,
  onToggleSchemaExpanded,
  onApproveSchemaUpdate,
}: TargetSetupPanelProps) {
  return (
    <>
      <div className="mt-5 grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
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
              <div className="col-start-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
                    placeholder="Paper"
                    type="text"
                    value={newTypeName}
                    onChange={(event) => onNewTypeNameChange(event.target.value)}
                  />
                  <button
                    className={inlineButtonClass}
                    disabled={Boolean(busyLabel) || !newTypeName.trim()}
                    type="button"
                    onClick={onCreateType}>
                    Create
                  </button>
                </div>
              </div>
            ) : null}

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
