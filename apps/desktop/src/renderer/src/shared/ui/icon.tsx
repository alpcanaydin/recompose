const glyphs = {
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  book: (
    <>
      <path d="M12 6.3C10.2 4.9 7.9 4.5 5 4.8v13.4c2.9-.3 5.2.1 7 1.5 1.8-1.4 4.1-1.8 7-1.5V4.8c-2.9-.3-5.2.1-7 1.5Z" />
      <path d="M12 6.3v13.4" />
    </>
  ),
  check: <path d="M5 12.5l4.6 4.6L19 7.4" />,
  chevron: <path d="M6 9.5 12 15.5l6-6" />,
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
  key: (
    <>
      <circle cx="7.6" cy="16.4" r="3.6" />
      <path d="M10.2 13.8 19.5 4.5M16.4 7.6l2.2 2.2M13.8 10.2l2.2 2.2" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6L12 3.2Z" />
      <path d="M12 11.8v9M12 11.8 4 7.6M12 11.8l8-4.2" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.2 18.4a9 9 0 1 1 15.6 0" />
      <path d="M12 12.9 15.9 9" />
      <circle cx="12" cy="14.2" r="1.4" />
    </>
  ),
  gear: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  play: <path d="M8.6 5.6 18.4 12l-9.8 6.4Z" fill="currentColor" stroke="none" />,
  stop: <rect fill="currentColor" height="14" rx="3" stroke="none" width="14" x="5" y="5" />,
  more: (
    <>
      <circle cx="5.5" cy="12" fill="currentColor" r="1.7" stroke="none" />
      <circle cx="12" cy="12" fill="currentColor" r="1.7" stroke="none" />
      <circle cx="18.5" cy="12" fill="currentColor" r="1.7" stroke="none" />
    </>
  ),
  tidy: (
    <path d="M13.2 10.8 4.6 19.4M15.9 4.6l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7ZM20 12.1l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5ZM8.8 3.8l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5Z" />
  ),
  json: (
    <path d="M9.2 4.5c-2 0-2.7 1-2.7 2.5v2.2c0 1.4-.7 2.3-2.1 2.8 1.4.5 2.1 1.4 2.1 2.8v2.2c0 1.5.7 2.5 2.7 2.5M14.8 4.5c2 0 2.7 1 2.7 2.5v2.2c0 1.4.7 2.3 2.1 2.8-1.4.5-2.1 1.4-2.1 2.8v2.2c0 1.5-.7 2.5-2.7 2.5" />
  ),
  'panel-bottom': (
    <>
      <rect height="14.5" rx="3.4" width="18" x="3" y="4.75" />
      <path d="M3 14.4h18" />
      <circle cx="8.4" cy="17" fill="currentColor" r=".95" stroke="none" />
      <circle cx="12" cy="17" fill="currentColor" r=".95" stroke="none" />
      <circle cx="15.6" cy="17" fill="currentColor" r=".95" stroke="none" />
    </>
  ),
  'panel-right': (
    <>
      <rect height="14.5" rx="3.4" width="18" x="3" y="4.75" />
      <path d="M14.6 4.75v14.5M17 8.1h1.3M17 11.1h1.3" />
    </>
  ),
  'panel-left': (
    <>
      <rect height="14.5" rx="3.4" width="18" x="3" y="4.75" />
      <path d="M9.6 4.75v14.5M5.9 8.1h1.3M5.9 11.1h1.3" />
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
