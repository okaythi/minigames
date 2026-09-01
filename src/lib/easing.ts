/** Easing curves used for juice: menus, spike sprouting, camera shake decay. */

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

/** Overshoots slightly then settles - reads as "sprung into place". */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
