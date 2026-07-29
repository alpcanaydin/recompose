import { RowAction } from './row-action';

type TokenActionsProps = {
  /** The mask of the stored value, or nothing when none has been minted. */
  masked: string | null;
  /** Puts the whole value on the clipboard without ever showing it. */
  onCopy: () => void;
  /** Mints the first value, or opens the confirmation guarding a replacement. */
  onMint: () => void;
};

/** The resting cluster of a credential row: copy what exists, or mint what does not. */
export function TokenActions({ masked, onCopy, onMint }: TokenActionsProps) {
  if (masked === null) {
    return <RowAction onClick={onMint}>Generate</RowAction>;
  }

  return (
    <>
      <RowAction onClick={onCopy}>Copy</RowAction>
      <RowAction onClick={onMint}>Regenerate</RowAction>
    </>
  );
}
