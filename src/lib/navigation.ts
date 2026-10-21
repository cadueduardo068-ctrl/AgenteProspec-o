export const sectionRoutes: Record<string, string> = {
  overview: '/',
  prospect: '/prospect',
  companies: '/library',
  contacted: '/conversations',
  sites: '/sites',
  inspirations: '/inspirations',
  opportunities: '/opportunities',
  queue: '/queue',
  assistant: '/assistant',
  funnel: '/funnel',
  reports: '/reports',
  settings: '/settings',
};
export function sectionForPath(path: string) {
  return Object.entries(sectionRoutes).find(([, url]) => url === path)?.[0];
}
