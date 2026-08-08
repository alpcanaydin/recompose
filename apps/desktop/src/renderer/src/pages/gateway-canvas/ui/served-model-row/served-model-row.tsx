import type { AccountKind } from '@recompose/contracts';

import type { ServedModel, ServedTarget } from '../../model/served-models';

import { accountName } from '../../../../entities/account';
import { CopyButton, StatusChip } from '../../../../shared/ui';

type ServedModelRowProps = {
  /** The definition as the drawer reads it, target standing and all. */
  served: ServedModel;
};

const kindMarks: Record<AccountKind, string> = {
  subscription: 'bg-subscription',
  'api-key': 'bg-api-key',
  aggregator: 'bg-aggregator',
  local: 'bg-local',
};

function markFill(target: ServedTarget): string {
  return target.standing === 'removed' ? 'bg-danger' : kindMarks[target.account.kind];
}

function bindingLine(served: ServedModel): string {
  const account =
    served.target.standing === 'removed' ? undefined : accountName(served.target.account);

  return account === undefined
    ? `${served.id} → ${served.providerModel}`
    : `${served.id} → ${account} · ${served.providerModel}`;
}

const standings = {
  serving: { word: 'serving', tone: 'positive' },
  removed: { word: 'target removed', tone: 'attention' },
} as const;

/**
 * One virtual model, read leading to trailing as the name it answers to and what serves it.
 *
 * @summary The mark carries the kind of account behind the name, so a person tells a key from a
 * runtime before reading a word, and a target that left the registry takes the danger fill instead.
 * The binding stays on screen either way, because it is what a person comes back to repair rather
 * than something to quietly forget.
 */
export function ServedModelRow({ served }: ServedModelRowProps) {
  const standing = standings[served.target.standing];

  return (
    <li className="flex min-h-sheet-row items-center gap-2.5 border-b border-line-faint px-3 py-1.5 last:border-b-0">
      <span aria-hidden className={`size-2.25 shrink-0 rounded-chip ${markFill(served.target)}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-control font-medium text-ink">{served.displayName}</span>
        <span className="truncate font-mono text-mono-value text-ink-secondary">
          {bindingLine(served)}
        </span>
      </span>
      <StatusChip tone={standing.tone} word={standing.word} />
      <CopyButton announcement="Model id copied." label="Copy model id" value={served.id} />
    </li>
  );
}
