/** Grid paging: 3 columns x 3 rows first, then six at a time. */

export const COLUMNS = 3
export const ROWS = 3
export const INITIAL_PAGE = COLUMNS * ROWS
export const LOAD_MORE = 6

export function pageLimit(page: number): number {
  return page <= 1 ? INITIAL_PAGE : INITIAL_PAGE + (page - 1) * LOAD_MORE
}
