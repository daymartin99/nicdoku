import { signal } from '@preact/signals'

export type Route =
  | 'home'
  | 'game'
  | 'session-done'
  | 'stats'
  | 'themes'
  | 'settings'
  | 'about'
  | 'onboarding'

export const route = signal<Route>('home')

export function go(r: Route) {
  route.value = r
  window.scrollTo(0, 0)
}
