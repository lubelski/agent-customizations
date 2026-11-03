export type Link = { label: string; url: string }

declare module 'claude-code' {
  interface PluginState {
    links: { links: Shaped<Link[]> }
  }
}
