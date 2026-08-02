type AddProviderButtonProps = {
  /** Asks for the catalog, which the page owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/** The one way into the catalog from a surface that already lists accounts. */
export function AddProviderButton({ onAddProvider }: AddProviderButtonProps) {
  return (
    <button
      className="push-button-primary self-start focus-ring"
      onClick={onAddProvider}
      type="button"
    >
      Add provider
    </button>
  );
}
