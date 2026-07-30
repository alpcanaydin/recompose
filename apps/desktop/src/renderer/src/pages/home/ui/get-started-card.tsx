import { useId } from 'react';

import { type GetStartedStep, getStartedSteps } from '../lib/get-started-steps';

type GetStartedCardProps = {
  /** Whether the app already holds a gateway. */
  gatewayExists: boolean;
  /** Whether the app already holds a connected account. */
  providerConnected: boolean;
  /** Asked for when the person wants the coaching to stop. */
  onSkip: () => void;
};

const marker = {
  done: 'border-running bg-running',
  current: 'border-accent',
  pending: 'border-line-strong',
} as const;

function StepRow({ step }: { step: GetStartedStep }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-1 inline-block size-2.5 shrink-0 rounded-pill border ${marker[step.state]}`}
      />
      <span className="flex flex-col">
        <span
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="text-body text-ink"
        >
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

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-62.5 flex-col gap-3 rounded-card border border-line-subtle bg-surface-card p-4 shadow-raised"
    >
      <h2 className="text-heading text-ink" id={headingId}>
        Get started
      </h2>
      <ul className="flex flex-col gap-2">
        {getStartedSteps({ gatewayExists, providerConnected }).map((step) => (
          <StepRow key={step.title} step={step} />
        ))}
      </ul>
      <footer className="flex justify-end">
        <button
          className="text-caption text-ink-secondary focus-ring hover:text-ink"
          onClick={onSkip}
          type="button"
        >
          Skip setup
        </button>
      </footer>
    </section>
  );
}
