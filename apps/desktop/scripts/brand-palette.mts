export type BrandSolid =
  | 'tileTop'
  | 'tileBottom'
  | 'frameTop'
  | 'frameBottom'
  | 'noteCream'
  | 'brandWhite'
  | 'bandFade';

export const brandPalette: Readonly<Record<BrandSolid, string>> = Object.freeze({
  tileTop: '#2640D9',
  tileBottom: '#142273',
  frameTop: '#0C1341',
  frameBottom: '#020309',
  noteCream: '#F2EBD1',
  brandWhite: '#FFFFFF',
  bandFade: '#AAA79C',
});
