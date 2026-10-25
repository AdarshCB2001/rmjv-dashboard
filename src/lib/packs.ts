/**
 * Drill templates are cut from a 12x18 inch sheet that FunKustoms charges SHEET_PRICE
 * for, so they are only sold in whole sheets: quantity must be a multiple of the pieces
 * that fit on one sheet, and the per-piece price is SHEET_PRICE / pieces-per-sheet.
 *
 * Pieces-per-sheet is read from the layout PDF's filename ("... Layout - 10ps.pdf") in
 * catalog.ts (server only); this file stays client-safe for the cart UI.
 */
export const SHEET_PRICE = 60;

export const isValidQuantity = (quantity: number, pack: number) =>
  Number.isInteger(quantity) && quantity >= pack && quantity % pack === 0;
