declare module 'claude-code' {
  interface PluginState {
    'message-panels': {
      /** Tool rows whose full input and output the person revealed, by tool_use_id. */
      revealed: Shaped<Record<string, boolean>>
      /** Tool rows whose chevron the person turned, by tool_use_id: true open, false closed. */
      opened: Shaped<Record<string, boolean>>
      /** The `verbose` setting, read at start and when it changes. */
      verbose: Shaped<boolean>
      /** The palette in use: light or dark, from the theme setting. */
      scheme: Shaped<'light' | 'dark'>
    }
  }
}
