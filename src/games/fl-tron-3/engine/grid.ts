import { ARENA } from './config'
import type { GridCoord, Point } from './types'

export const OCCUPANCY = {
  empty: 0,
  boundary: 1,
  p1Trail: 2,
  aiTrail: 3,
} as const

export type OccupancyType = (typeof OCCUPANCY)[keyof typeof OCCUPANCY]

export class OccupancyGrid {
  private readonly data: Uint8Array
  public readonly cols: number = ARENA.cols
  public readonly rows: number = ARENA.rows

  public constructor() {
    this.data = new Uint8Array(this.cols * this.rows)
  }

  public reset(): void {
    this.data.fill(OCCUPANCY.empty)
  }

  public isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows
  }

  public get(col: number, row: number): number {
    if (!this.isInBounds(col, row)) return OCCUPANCY.boundary
    return this.data[row * this.cols + col] ?? OCCUPANCY.boundary
  }

  public set(col: number, row: number, value: OccupancyType): void {
    if (this.isInBounds(col, row)) {
      this.data[row * this.cols + col] = value
    }
  }

  public isFree(col: number, row: number): boolean {
    if (!this.isInBounds(col, row)) return false
    return this.data[row * this.cols + col] === OCCUPANCY.empty
  }

  public static gridToWorld(col: number, row: number): Point {
    return {
      x: ARENA.paddingX + col * ARENA.cellSize + ARENA.cellSize / 2,
      y: ARENA.paddingY + row * ARENA.cellSize + ARENA.cellSize / 2,
    }
  }

  public static worldToGrid(x: number, y: number): GridCoord {
    const col = Math.floor((x - ARENA.paddingX) / ARENA.cellSize)
    const row = Math.floor((y - ARENA.paddingY) / ARENA.cellSize)
    return {
      col: Math.max(0, Math.min(ARENA.cols - 1, col)),
      row: Math.max(0, Math.min(ARENA.rows - 1, row)),
    }
  }

  /**
   * Computes reachable open chamber volume via BFS.
   * Capped by maxArea to keep per-frame AI computations blazing fast.
   */
  public floodFillArea(startCol: number, startRow: number, maxArea = 800): number {
    if (!this.isFree(startCol, startRow)) return 0

    const visited = new Uint8Array(this.cols * this.rows)
    const queueCol = new Int16Array(maxArea)
    const queueRow = new Int16Array(maxArea)

    let head = 0
    let tail = 0

    const startIndex = startRow * this.cols + startCol
    visited[startIndex] = 1
    queueCol[tail] = startCol
    queueRow[tail] = startRow
    tail += 1

    let count = 0
    const dCols = [0, 0, -1, 1]
    const dRows = [-1, 1, 0, 0]

    while (head < tail && count < maxArea) {
      const c = queueCol[head] ?? 0
      const r = queueRow[head] ?? 0
      head += 1
      count += 1

      for (let i = 0; i < 4; i += 1) {
        const nc = c + (dCols[i] ?? 0)
        const nr = r + (dRows[i] ?? 0)
        if (this.isFree(nc, nr)) {
          const idx = nr * this.cols + nc
          if (visited[idx] === 0) {
            visited[idx] = 1
            if (tail < maxArea) {
              queueCol[tail] = nc
              queueRow[tail] = nr
              tail += 1
            }
          }
        }
      }
    }

    return count
  }

  /**
   * Voronoi Territory Evaluation:
   * Returns { p1Area, aiArea } reachable exclusively earlier by each cycle.
   */
  public voronoiTerritory(
    p1Col: number,
    p1Row: number,
    aiCol: number,
    aiRow: number,
    maxSteps = 600,
  ): { p1Area: number; aiArea: number } {
    const distP1 = new Int16Array(this.cols * this.rows).fill(-1)
    const distAI = new Int16Array(this.cols * this.rows).fill(-1)

    this.computeBfsDistances(p1Col, p1Row, distP1, maxSteps)
    this.computeBfsDistances(aiCol, aiRow, distAI, maxSteps)

    let p1Area = 0
    let aiArea = 0

    for (let i = 0; i < this.data.length; i += 1) {
      const d1 = distP1[i] ?? -1
      const d2 = distAI[i] ?? -1
      if (d1 !== -1 && (d2 === -1 || d1 < d2)) {
        p1Area += 1
      } else if (d2 !== -1 && (d1 === -1 || d2 < d1)) {
        aiArea += 1
      }
    }

    return { p1Area, aiArea }
  }

  private computeBfsDistances(
    startCol: number,
    startRow: number,
    distArray: Int16Array,
    maxSteps: number,
  ): void {
    if (!this.isFree(startCol, startRow)) return

    const queueCol = new Int16Array(maxSteps)
    const queueRow = new Int16Array(maxSteps)
    let head = 0
    let tail = 0

    const startIdx = startRow * this.cols + startCol
    distArray[startIdx] = 0
    queueCol[tail] = startCol
    queueRow[tail] = startRow
    tail += 1

    const dCols = [0, 0, -1, 1]
    const dRows = [-1, 1, 0, 0]

    while (head < tail) {
      const c = queueCol[head] ?? 0
      const r = queueRow[head] ?? 0
      head += 1

      const curDist = distArray[r * this.cols + c] ?? 0
      if (curDist >= maxSteps) continue

      for (let i = 0; i < 4; i += 1) {
        const nc = c + (dCols[i] ?? 0)
        const nr = r + (dRows[i] ?? 0)
        if (this.isFree(nc, nr)) {
          const idx = nr * this.cols + nc
          if (distArray[idx] === -1) {
            distArray[idx] = curDist + 1
            if (tail < maxSteps) {
              queueCol[tail] = nc
              queueRow[tail] = nr
              tail += 1
            }
          }
        }
      }
    }
  }
}
