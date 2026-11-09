declare module 'claude-code' {
  interface PluginState {
    'message-panels': {
      /** Tool rows whose full input and output the person revealed, by tool_use_id. */
      revealed: Shaped<Record<string, boolean>>
      /** The palette in use: light or dark, from the theme setting. */
      scheme: Shaped<'light' | 'dark'>
    }
  }
}
