const glyphs = {
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  book: (
    <>
      <path d="M12 6.3C10.2 4.9 7.9 4.5 5 4.8v13.4c2.9-.3 5.2.1 7 1.5 1.8-1.4 4.1-1.8 7-1.5V4.8c-2.9-.3-5.2.1-7 1.5Z" />
      <path d="M12 6.3v13.4" />
    </>
  ),
  check: <path d="M5 12.5l4.6 4.6L19 7.4" />,
  network: (
    <>
      <circle cx="5.2" cy="12" r="2.1" />
      <circle cx="17.6" cy="5.8" r="2.1" />
      <circle cx="17.6" cy="18.2" r="2.1" />
      <path d="M7.2 11l8.5-4.2M7.2 13l8.5 4.2" />
    </>
  ),
  spark: (
    <path
      d="M12 3c.7 5 1.6 6.4 9 9-7.4 2.6-8.3 4-9 9-.7-5-1.6-6.4-9-9 7.4-2.6 8.3-4 9-9Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  person: (
    <>
      <circle cx="12" cy="8.4" r="3.5" />
      <path d="M5.4 19.6c.7-3.5 3.4-5.3 6.6-5.3s5.9 1.8 6.6 5.3" />
    </>
  ),
  gear: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

export type IconName = keyof typeof glyphs;

type IconProps = {
  /** Which glyph of the sprite to draw. */
  name: IconName;
  /**
   * Size and color classes, replacing the standing 16px square rather than adding to it, so a
   * caller that passes anything here names its own size.
   */
  className?: string;
};

/**
 * One glyph of the shared sprite, drawn in the ink of whatever it sits in.
 *
 * @summary Reach for it beside a label or inside a control that names itself. Every glyph is
 * decorative, so it stays out of the accessibility tree and the control keeps the name it
 * already had.
 */
export function Icon({ name, className = 'size-4' }: IconProps) {
  return (
    <svg
      aria-hidden
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {glyphs[name]}
    </svg>
  );
}
