type ViewState = 'checking' | 'disconnected' | 'awaiting-code' | 'connected';

type ConnectionPanelProps = {
  viewState: ViewState;
  statusMessage: string;
  busyLabel: string;
  code: string;
  fieldLabelClass: string;
  inputClass: string;
  buttonClass: string;
  onCodeChange: (value: string) => void;
  onConnect: () => void;
  onSubmitCode: () => void;
};

export function ConnectionPanel({
  viewState,
  statusMessage,
  busyLabel,
  code,
  fieldLabelClass,
  inputClass,
  buttonClass,
  onCodeChange,
  onConnect,
  onSubmitCode,
}: ConnectionPanelProps) {
  if (viewState === 'checking') {
    return <p className="mt-4 text-sm text-zinc-500">Checking...</p>;
  }

  if (viewState === 'disconnected') {
    return (
      <>
        <h1 className="mt-4 text-center text-lg font-semibold leading-tight text-zinc-950">
          Welcome to Anytype Scholar!
        </h1>
        <button
          className={buttonClass}
          disabled={Boolean(busyLabel)}
          onClick={onConnect}>
          {busyLabel || 'Connect to Anytype'}
        </button>
      </>
    );
  }

  if (viewState === 'awaiting-code') {
    return (
      <>
        <p className="mt-2.5 text-sm text-zinc-600">{statusMessage}</p>
        <label className="mt-5 block">
          <span className={fieldLabelClass}>4-digit code</span>
          <input
            className={inputClass}
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            value={code}
            onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, ''))}
          />
        </label>

        <button
          className={buttonClass}
          disabled={code.trim().length !== 4 || Boolean(busyLabel)}
          onClick={onSubmitCode}>
          {busyLabel || 'Connect'}
        </button>
      </>
    );
  }

  return null;
}
