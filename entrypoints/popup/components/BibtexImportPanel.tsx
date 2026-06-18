import type { AnytypeImportResult } from '@/lib/anytype';

const inlineButtonClass =
  'rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-70';
const fieldLabelClass =
  'text-xs font-medium text-zinc-700';
const textAreaClass =
  'min-h-32 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-950 outline-none transition focus:border-zinc-950';

type Message = {
  kind: 'error' | 'success';
  text: string;
} | null;

type BibtexImportPanelProps = {
  bibtexInput: string;
  parseMessage: Message;
  importResult: AnytypeImportResult | null;
  busyLabel: string;
  canImport: boolean;
  onBibtexInputChange: (value: string) => void;
  onImportBibtex: () => void;
};

export function BibtexImportPanel({
  bibtexInput,
  parseMessage,
  importResult,
  busyLabel,
  canImport,
  onBibtexInputChange,
  onImportBibtex,
}: BibtexImportPanelProps) {
  return (
    <section className="mt-4">
      <div>
        <p className="text-xs font-medium text-zinc-700">Import Source</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Paste one or more BibTeX entries
        </p>
      </div>

      <div className="mt-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className={fieldLabelClass}>BibTeX</span>
          <button
            className={inlineButtonClass}
            disabled={!bibtexInput.trim() || !canImport || Boolean(busyLabel)}
            type="button"
            onClick={onImportBibtex}>
            {busyLabel === 'Importing...' ? busyLabel : 'Import'}
          </button>
        </div>
        <textarea
          className={textAreaClass}
          placeholder="@article{vaswani2017attention,&#10;  title={Attention Is All You Need},&#10;  author={Vaswani, Ashish and Shazeer, Noam},&#10;  year={2017}&#10;}"
          value={bibtexInput}
          onChange={(event) => onBibtexInputChange(event.target.value)}
        />
      </div>

      {parseMessage ? (
        parseMessage.kind === 'error' ? (
          <p className="mt-3 text-sm text-amber-800">{parseMessage.text}</p>
        ) : null
      ) : null}

      {importResult ? (
        <p
          className={`mt-1.5 text-xs ${
            importResult.ok ? 'text-emerald-700' : 'text-amber-800'
          }`}>
          {importResult.warning ? importResult.warning : importResult.message}
        </p>
      ) : null}
    </section>
  );
}
