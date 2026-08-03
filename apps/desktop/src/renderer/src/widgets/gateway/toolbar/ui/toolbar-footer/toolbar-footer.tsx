import { FailedStartLine } from '../failed-start-line/failed-start-line';

type ToolbarFooterProps = {
  /** Names the attempt a message belongs to, so a repeated sentence announces itself again. */
  attempt: number;
  failure: { port: number } | undefined;
  onMoveToFreePort: () => void;
  refusal: string | undefined;
};

/**
 * The line under the strip, carrying whichever of the two failures stands.
 *
 * @summary A refused request and a lost port are different failures, and only one of them can be
 * true at a time. A refusal means the engine never answered, so it takes the line rather than a
 * sentence about a port nobody reached.
 */
export function ToolbarFooter({ attempt, failure, onMoveToFreePort, refusal }: ToolbarFooterProps) {
  if (refusal !== undefined) {
    return (
      <div className="app-no-drag px-4 pb-2">
        <p className="text-caption text-danger-ink" key={attempt} role="alert">
          {refusal}
        </p>
      </div>
    );
  }

  if (failure === undefined) {
    return null;
  }

  return (
    <div className="app-no-drag px-4 pb-2">
      <FailedStartLine key={attempt} onMoveToFreePort={onMoveToFreePort} port={failure.port} />
    </div>
  );
}
