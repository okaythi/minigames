/** The only routes the site has - a discriminated union keeps pages honest. */

export interface QueryParams {
  readonly [key: string]: string
}

export type Route =
  | { readonly name: 'home'; readonly query: QueryParams }
  | { readonly name: 'game'; readonly slug: string; readonly query: QueryParams }
  | { readonly name: 'about'; readonly query: QueryParams }
  | { readonly name: 'user-profile'; readonly username: string; readonly query: QueryParams }
  | { readonly name: 'settings'; readonly query: QueryParams }
  | { readonly name: 'not-found'; readonly path: string; readonly query: QueryParams }

export type RouteName = Route['name']
