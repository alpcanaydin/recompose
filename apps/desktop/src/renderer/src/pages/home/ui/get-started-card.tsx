import { useId } from 'react';

import { Icon } from '../../../shared/ui';
import { type GetStartedStep, getStartedSteps } from '../lib/get-started-steps';

type GetStartedCardProps = {
  /** Whether the app already holds a gateway. */
  gatewayExists: boolean;
  /** Whether the app already holds a connected account. */
  providerConnected: boolean;
  /** Asked for when the person wants the coaching to stop. */
  onSkip: () => void;
};

const ring = {
  done: 'border-running bg-running text-surface-thumb',
  current: 'checklist-ring-current',
  pending: '',
} as const;

const stepInk = {
  done: 'text-ink-secondary',
  current: 'text-ink font-medium',
  pending: 'text-ink-secondary',
} as const;

function StepRow({ step }: { step: GetStartedStep }) {
  return (
    <li className="flex min-h-7.5 items-center gap-2.25 px-0.5">
      <span aria-hidden className={`checklist-ring ${ring[step.state]}`}>
        {step.state === 'done' && <Icon className="size-2.25 stroke-3" name="check" />}
      </span>
      <span className={`flex flex-col ${stepInk[step.state]}`}>
        <span aria-current={step.state === 'current' ? 'step' : undefined} className="text-note">
          {step.title}
        </span>
        {step.reason !== undefined && (
          <span className="text-caption text-ink-secondary">{step.reason}</span>
        )}
      </span>
    </li>
  );
}

/**
 * The four steps of a first session, tracked against what the app actually holds.
 *
 * @summary Reach for it on the home surface while a person is still finding their way. It
 * coaches rather than stalls: the steps this build cannot finish say what they wait for instead
 * of pretending to be next.
 */
export function GetStartedCard({ gatewayExists, providerConnected, onSkip }: GetStartedCardProps) {
  const headingId = useId();
  const steps = getStartedSteps({ gatewayExists, providerConnected });
  const done = steps.filter((step) => step.state === 'done').length;

  return (
    <section
      aria-labelledby={headingId}
      className="w-62.5 rounded-panel border border-line-subtle bg-surface-card px-3 pt-3 pb-1.5 shadow-raised"
    >
      <header className="mb-1.5 flex items-baseline justify-between px-0.5">
        <h2 className="text-card-title text-ink" id={headingId}>
          Get started
        </h2>
        <span className="font-mono text-mono-value text-ink-secondary">{`${String(done)} of ${String(steps.length)}`}</span>
      </header>
      <ul className="list-none">
        {steps.map((step) => (
          <StepRow key={step.title} step={step} />
        ))}
      </ul>
      <footer className="mt-1.25 flex justify-end border-t border-line-faint px-0.5 py-1.75">
        <button
          className="text-quiet text-ink-secondary focus-ring hover:text-ink"
          onClick={onSkip}
          type="button"
        >
          Skip setup
        </button>
      </footer>
    </section>
  );
}
