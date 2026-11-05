import { expect, test } from 'claude-code/testing'

const SUMMARY = {
  plugin: 'message-panels',
  surface: 'terminal',
  component: 'AssistantMessage',
  props: { text: 'Read the README.\nIt lists three mods.', isFirstOfReply: true, isSummary: true },
} as const

test('a summary block draws as one italic line with no fill', async $ => {
  const ui = await $.ui.mount(SUMMARY)
  const line = await ui.find({ type: 'Text', text: 'Read the README. It lists three mods.' })
  expect(line?.props.italic).toBe(true)
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.filter(box => box.props.backgroundColor !== undefined)).toEqual([])
  expect(await ui.find({ type: 'Text', text: /summary/ })).toBeUndefined()
})
