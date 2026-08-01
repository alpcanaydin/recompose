const monograms = {
  anthropic: 'A',
  openai: 'O',
  openrouter: 'R',
};

export type BrandMarkName = keyof typeof monograms;

type BrandMarkProps = {
  /** Which provider of the set the mark stands for. */
  name: BrandMarkName;
};

/**
 * The mark that leads a provider's row, drawn in the ink of whatever it sits in.
 *
 * @summary Reach for it wherever a provider's name appears in a list, so a person finds the row
 * by its shape before reading a word. The mark is decorative, because the provider's name always
 * stands beside it, and it carries a monogram until each vendor's own mark is licensed.
 */
export function BrandMark({ name }: BrandMarkProps) {
  return (
    <svg aria-hidden className="size-5 shrink-0" viewBox="0 0 24 24">
      <rect
        fill="none"
        height="20"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.7"
        width="20"
        x="2"
        y="2"
      />
      <text
        dominantBaseline="central"
        fill="currentColor"
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        x="12"
        y="12.6"
      >
        {monograms[name]}
      </text>
    </svg>
  );
}
