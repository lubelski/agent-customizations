export type Link = { label: string; url: string; group?: string }

declare module 'claude-code' {
  interface PluginState {
    'footer-links': { links: Shaped<Link[]> }
  }
}
