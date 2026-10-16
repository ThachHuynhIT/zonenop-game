import { BOARD as STD_BOARD, groupPositions as groupPositionsIn, type Group, type Square } from "@/lib/typhu/board";

/**
 * The board of the table being shown (the standard or the huge map). TableBody sets it every render
 * (`boardRef.current = boardOf(...)`) before any child reads it, so every file reads the current map from here.
 */
export const boardRef: { current: Square[] } = { current: STD_BOARD };

/** Positions of a colour group on the current board. */
export const groupPositions = (group: Group) => groupPositionsIn(group, boardRef.current);
