import { useEffect, useState } from 'react';

type CopyButtonProps = {
  /** Accessible name of the button, naming the value it copies. */
  label: string;
  /** Text the button places on the clipboard. */
  value: string;
};

const CONFIRMATION_LINGERS_MS = 2000;

function CopyGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12">
      <rect height="7" rx="1.6" stroke="currentColor" strokeWidth="1.2" width="7" x="4.4" y="4.4" />
      <path
        d="M7.6 2.6H3.1A1.5 1.5 0 0 0 1.6 4.1v4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12">
      <path
        d="M2.2 6.3 4.7 8.8 9.8 3.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/**
 * Icon-only button that puts a value on the clipboard and says so out loud.
 *
 * @summary Reach for it beside a value a person needs in another app, where a text button would
 * outweigh what it copies. The glyph confirms the copy for a sighted person and a polite live
 * region confirms it for a screen reader, both clearing so a second copy announces itself again.
 */
export function CopyButton({ label, value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const clearing = setTimeout(() => {
      setCopied(false);
    }, CONFIRMATION_LINGERS_MS);

    return () => {
      clearTimeout(clearing);
    };
  }, [copied]);

  return (
    <>
      <button
        aria-label={label}
        className="inline-flex size-4.5 items-center justify-center rounded-chip text-ink-secondary focus-ring hover:text-ink"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
          });
        }}
        type="button"
      >
        {copied ? <CheckGlyph /> : <CopyGlyph />}
      </button>
      <span className="sr-only" role="status">
        {copied ? 'Address copied.' : ''}
      </span>
    </>
  );
}
