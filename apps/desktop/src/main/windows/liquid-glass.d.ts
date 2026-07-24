declare module 'electron-liquid-glass' {
  type GlassViewOptions = {
    opaque: boolean;
  };

  const liquidGlass: {
    addView(handle: Buffer, options: GlassViewOptions): number;
  };

  export default liquidGlass;
}
