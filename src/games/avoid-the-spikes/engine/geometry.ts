import { ARENA } from './config'
import type { Rect, Spike, SpikeSurface, Triangle, Vec2, WallSide } from './types'

/**
 * Shape algebra for the arena. Everything the collision code needs is derived
 * here so `collision.ts` stays a pure geometry file.
 */

export const playerRect = (pos: Vec2, width: number, height: number): Rect => ({
  x: pos.x - width / 2,
  y: pos.y - height / 2,
  width,
  height,
})

/** Inner playfield the player centre may occupy before touching a wall. */
export const wallLimitFor = (side: WallSide, halfWidth: number): number =>
  side === 'left' ? halfWidth : ARENA.width - halfWidth

/** Cell grid for a wall: index 0 sits just under the ceiling teeth. */
export interface WallGrid {
  readonly origin: number
  readonly span: number
  readonly pitch: number
  readonly cells: number
}

export const wallGrid = (): WallGrid => {
  const origin = ARENA.ceilingDepth + ARENA.boundaryInset
  const span = ARENA.height - origin - (ARENA.floorDepth + ARENA.boundaryInset)
  const cells = Math.floor(span / ARENA.wallPitch)
  return { origin, span, pitch: ARENA.wallPitch, cells }
}

export const boundaryGrid = (): WallGrid => {
  const origin = ARENA.boundaryPitch / 2
  const span = ARENA.width - ARENA.boundaryPitch
  const cells = Math.floor(span / ARENA.boundaryPitch)
  return { origin, span, pitch: ARENA.boundaryPitch, cells }
}

/** Position along the surface for a cell index. */
export const alongForCell = (grid: WallGrid, index: number): number =>
  grid.origin + grid.pitch * index + grid.pitch / 2

/**
 * Triangle of a spike, given how far it has grown (0..1). A spike at rest has
 * its full depth; a sprouting one is proportionally shorter, which is what
 * makes mid-air retargeting fair.
 */
export function spikeTriangle(spike: Spike, growth: number): Triangle {
  const depth = spike.depth * growth
  const half = spike.base / 2
  switch (spike.surface) {
    case 'left':
      return {
        a: { x: 0, y: spike.along - half },
        b: { x: 0, y: spike.along + half },
        c: { x: depth, y: spike.along },
      }
    case 'right':
      return {
        a: { x: ARENA.width, y: spike.along + half },
        b: { x: ARENA.width, y: spike.along - half },
        c: { x: ARENA.width - depth, y: spike.along },
      }
    case 'ceiling':
      return {
        a: { x: spike.along - half, y: 0 },
        b: { x: spike.along + half, y: 0 },
        c: { x: spike.along, y: depth },
      }
    case 'floor':
      return {
        a: { x: spike.along + half, y: ARENA.height },
        b: { x: spike.along - half, y: ARENA.height },
        c: { x: spike.along, y: ARENA.height - depth },
      }
  }
}

/** Outward normal of the wall a spike grows from (used by the particle burst). */
export function spikeNormal(surface: SpikeSurface): Vec2 {
  switch (surface) {
    case 'left':
      return { x: 1, y: 0 }
    case 'right':
      return { x: -1, y: 0 }
    case 'ceiling':
      return { x: 0, y: 1 }
    case 'floor':
      return { x: 0, y: -1 }
  }
}
