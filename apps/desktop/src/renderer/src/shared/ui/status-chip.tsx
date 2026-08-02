const standing = {
  positive: { mark: 'bg-running', ink: 'text-ink' },
  attention: { mark: 'bg-attention', ink: 'text-attention-ink' },
} as const;

type StatusChipProps = {
  /** The standing the chip prints, which is the whole of what a person reads here. */
  word: string;
  /**
   * Whether the standing holds or asks for something. `positive` marks a thing that needs nothing,
   * and `attention` marks one whose remedy sits beside it.
   */
  tone: keyof typeof standing;
};

/**
 * A standing said as a word with a mark beside it.
 *
 * @summary Reach for it where a person reads how something stands and the word has to survive a
 * screen that renders no color. The mark carries no name of its own, so the word is heard once.
 * Reach for the status indicator instead where the mark stands alone with no word beside it.
 */
export function StatusChip({ word, tone }: StatusChipProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-detail ${standing[tone].ink}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-pill ${standing[tone].mark}`} />
      {word}
    </span>
  );
}
