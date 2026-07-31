type FailedStartLineProps = {
  /** Port the gateway wanted and could not have. */
  port: number;
  /** Accepts the offer to move the gateway onto a port nothing holds. */
  onMoveToFreePort: () => void;
};

/**
 * The sentence a start that lost its port leaves behind, beside the only way out of it.
 *
 * @summary Reach for it under the toolbar rather than beside the pill, so it owns a full row at
 * the narrowest window. Render a fresh one per attempt: a live region repeating a sentence it
 * already announced says nothing the second time.
 */
export function FailedStartLine({ port, onMoveToFreePort }: FailedStartLineProps) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-caption text-danger-ink" role="alert">
        Another process holds port {port}.
      </p>
      <button className="push-button" onClick={onMoveToFreePort} type="button">
        Move to a free port
      </button>
    </div>
  );
}
