// Règles pures des jeux (sans React ni Firestore) : faciles à tester.

// ── Morpion ──────────────────────────────────────────────
export const TTT_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Renvoie la ligne gagnante (3 index) ou null
export function tttWinningLine(b: number[]): number[] | null {
  for (const line of TTT_LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return line;
  }
  return null;
}

export function tttResult(b: number[]): number | "draw" | null {
  const line = tttWinningLine(b);
  if (line) return b[line[0]];
  if (b.every((c) => c !== 0)) return "draw";
  return null;
}

// ── 4 à la suite ─────────────────────────────────────────
export const C4_ROWS = 6;
export const C4_COLS = 7;

export function c4ToBoard(raw: any): number[][] {
  if (!raw) {
    return Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0));
  }
  return Array.from({ length: C4_ROWS }, (_, r) => {
    const rawRow = raw[r] ?? raw[String(r)] ?? [];
    return Array.from({ length: C4_COLS }, (_, c) =>
      Number(rawRow[c] ?? rawRow[String(c)] ?? 0),
    );
  });
}

export function c4FindRow(b: number[][], col: number): number {
  for (let r = C4_ROWS - 1; r >= 0; r--) if (b[r][col] === 0) return r;
  return -1;
}

// Renvoie les 4 cases [ligne, colonne] qui gagnent, ou null
export function c4WinningCells(
  b: number[][],
  piece: number,
): [number, number][] | null {
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
  ];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [];
        for (let i = 0; i < 4; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS) break;
          if (b[rr][cc] !== piece) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

export function c4IsDraw(b: number[][]): boolean {
  return b[0].every((c) => c !== 0);
}

export function c4ToDoc(b: number[][]): Record<string, number[]> {
  const o: Record<string, number[]> = {};
  b.forEach((r, i) => {
    o[String(i)] = r;
  });
  return o;
}
