import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agentteam-maker',
  component: 'Pane',
  requestId: 'agentteam-maker',
  props: {
    title: 'Agent Team Maker',
    isFocused: true,
    bodyColumns: 120,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: starts with main over two teams, edits a team, moves an agent`, async ($, on) => {
    mock.store(on)
    on('command.register', () => ({ value: { command: 'agentteam-maker' } }))
    on('tool.register', () => ({ value: { tool: 'mcp__agentteam-maker__add_team' } }))
    on('session.start', () => ({ cwd: '/tmp' }))
    on('agent.register', (_$, e) => ({ value: { agent: `agentteam-maker:${e.name}` } }))
    await $.session.start(START)
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Button', text: /main · Claude in this terminal/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /▣ Team 1/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /▣ Team 2/ })).toBeDefined()

    // Team 1 is selected first: rename it
    const teamKey = (await ui.find({ type: 'Input', text: /Team 1/ }))?.key ?? ''
    expect(teamKey).toMatch(/^team-name-/)
    await ui.input({ key: teamKey, text: 'research' })
    expect(await ui.find({ type: 'Button', text: /▣ research/ })).toBeDefined()

    // a new agent in the team, pushed one level down under agent-b
    await ui.press({ key: 'add-child' })
    await ui.press({ key: 'in' })
    expect(await ui.find({ type: 'Text', text: /^ {9}└─ $/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /◆ agent-b/ })).toBeDefined()
    await ui.press({ key: 'out' })
    expect(await ui.find({ type: 'Text', text: /^ {9}└─ $/ })).toBeUndefined()

    // skills on the new agent
    const id = (await ui.find({ type: 'Input', text: /^agent-/ }))?.key?.replace(/^name-/, '') ?? ''
    await ui.select({ key: `skills-on-${id}`, value: 'on' })
    await ui.input({ key: `add-skill-${id}-0`, text: 'pdf, docx' })
    expect(await ui.find({ type: 'Text', text: /skills: pdf, docx/ })).toBeDefined()
    await ui.press({ key: `rm-${id}-pdf` })
    expect(await ui.find({ type: 'Text', text: /skills: docx/ })).toBeDefined()

    await ui.unmount()
  })
}

test('the switch sends the team protocol to main once and offers only live teams', async ($, on) => {
  mock.store(on)
  const session = mock.session(on)
  on('command.register', () => ({ value: { command: 'agentteam-maker' } }))
    on('tool.register', () => ({ value: { tool: 'mcp__agentteam-maker__add_team' } }))
  on('session.start', () => ({ cwd: '/tmp' }))
  const registered: string[] = []
  on('agent.register', (_$, e) => {
    registered.push(e.name)
    return { value: { agent: `agentteam-maker:${e.name}` } }
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('agent.offer', () => ({ isOffered: true }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const submit = () => $.prompt.submit({ text: 'hi' } as never)
  const notes = () => session.appended().map(r => JSON.stringify(r.message.content))

  await submit()
  expect(notes()).toHaveLength(0)

  await ui.press({ key: 'team-on' })
  expect(registered).toContain('team-1-manager-1')
  expect(registered).toContain('team-2-agent-d')
  await submit()
  await submit()
  expect(notes()).toHaveLength(1)
  expect(notes()[0]).toContain('top Orchestrator')
  expect(notes()[0]).toContain('agentteam-maker:team-1-agent-a')
  expect(notes()[0]).toContain('Team isolation rules')

  const offer = (agent: string) =>
    $.agent.offer({ agent, description: '', source: 'plugin', provider: { plugin: 'agentteam-maker', tier: 'user' } } as never)
  expect((await offer('agentteam-maker:team-2-agent-c')).isOffered).toBe(true)
  expect((await offer('agentteam-maker:old-name')).isOffered).toBe(false)

  // switching Team 2 off sends a new note without it and hides it from the offer
  const team2 = (await ui.find({ type: 'Button', text: /▣ Team 2/ }))?.key ?? ''
  await ui.press({ key: team2 })
  await ui.select({ key: `team-active-${team2.replace(/^pick-/, '')}`, value: 'off' })
  await submit()
  expect(notes()).toHaveLength(2)
  expect(notes()[1]).not.toContain('team-2-')
  expect((await offer('agentteam-maker:team-2-agent-c')).isOffered).toBe(false)

  await ui.press({ key: 'team-on' })
  await submit()
  expect(notes()).toHaveLength(3)
  expect(notes()[2]).toContain('Teams are switched off')
  await ui.unmount()
})

test('main can add a team through its tool', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'agentteam-maker' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__agentteam-maker__add_team' } }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('agent.register', (_$, e) => ({ value: { agent: `agentteam-maker:${e.name}` } }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'team-on' })

  const ran = await $.tool.call({
    tool: 'mcp__agentteam-maker__add_team',
    teamName: 'review',
    manager: { name: 'chief', model: 'opus', role: 'Merges the reviews' },
    members: [
      { name: 'agent-x', role: 'Security review', skills: ['security-review'] },
      { name: 'agent-y', role: 'Performance review' },
    ],
  } as never)
  expect(String(ran.result)).toContain('agentteam-maker:review-chief')
  expect(String(ran.result)).toContain('agentteam-maker:review-agent-y')
  expect(await ui.find({ type: 'Button', text: /▣ review/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /skills: security-review/ })).toBeDefined()
  await ui.unmount()
})

test('an agent sets which same-level agents its results go to', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'agentteam-maker' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__agentteam-maker__add_team' } }))
  on('session.start', () => ({ cwd: '/tmp' }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const pick = async (name: RegExp) => {
    const key = (await ui.find({ type: 'Button', text: name }))?.key ?? ''
    await ui.press({ key })
    return key.replace(/^pick-/, '')
  }
  const b = await pick(/○ agent-b/)
  const a = await pick(/○ agent-a/)
  expect(await ui.find({ type: 'Text', text: 'Information flow (same level)' })).toBeDefined()
  await ui.select({ key: `flow-${a}-${b}`, value: 'to' })
  expect(await ui.find({ type: 'Text', text: '→ agent-b' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '← agent-a' })).toBeDefined()

  // from agent-b's side the same link reads as "receives from"
  await pick(/○ agent-b/)
  await ui.select({ key: `flow-${b}-${a}`, value: 'both' })
  expect(await ui.find({ type: 'Text', text: '↔ agent-b' })).toBeDefined()
  await ui.unmount()
})

test('main relays results within a level only along the flows', async ($, on) => {
  mock.store(on)
  const session = mock.session(on)
  on('command.register', () => ({ value: { command: 'agentteam-maker' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__agentteam-maker__add_team' } }))
  on('session.start', () => ({ cwd: '/tmp' }))
  const prompts = new Map<string, string>()
  on('agent.register', (_$, e) => {
    prompts.set(e.name, e.prompt)
    return { value: { agent: `agentteam-maker:${e.name}` } }
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'sub-1' }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'team-on' })

  // team 1 as in the request: a → b only, b ↔ c
  await $.tool.call({
    tool: 'mcp__agentteam-maker__add_team',
    teamName: 'flow',
    manager: { name: 'lead', role: 'Merges' },
    members: [
      { name: 'a', role: 'Drafts', sendsTo: ['b'] },
      { name: 'b', role: 'Refines', sendsTo: ['c'] },
      { name: 'c', role: 'Checks', sendsTo: ['b'] },
    ],
  } as never)
  await $.prompt.submit({ text: 'hi' } as never)
  const note = JSON.stringify(session.appended().at(-1)?.message.content)
  expect(note).toContain('Information flow within a level')
  expect(note).toContain('agentteam-maker:flow-a` → `agentteam-maker:flow-b')
  expect(note).toContain('agentteam-maker:flow-b` ↔ `agentteam-maker:flow-c')
  expect(note).not.toContain('flow-c` → ')

  const spawn = (to: string, prompt: string) =>
    $.agent.spawn({
      tool_use_id: 't1',
      prompt,
      description: 'work',
      subagentType: `agentteam-maker:${to}`,
      provider: { plugin: 'agentteam-maker', tier: 'user' },
    } as never) as Promise<{ deny?: string; model?: string }>
  const from = (who: string) => `Go on.\n[FROM agentteam-maker:${who}]\nresult\n[/FROM]`

  expect((await spawn('flow-b', from('flow-a'))).deny).toBeUndefined()
  expect((await spawn('flow-a', from('flow-b'))).deny).toContain('may not pass its result')
  expect((await spawn('flow-c', from('flow-b'))).deny).toBeUndefined()
  expect((await spawn('flow-b', `[FROM flow-c]\nx\n[/FROM]`)).deny).toBeUndefined()
  expect((await spawn('flow-c', from('flow-a'))).deny).toContain('may not pass its result')
  // the manager merges its members' results; another team's never reach a member
  expect((await spawn('flow-lead', `[MERGE]\n${from('flow-a')}`)).deny).toBeUndefined()
  expect((await spawn('flow-a', from('team-1-agent-a'))).deny).toContain('another team')

  // the members' own prompts say what they get and give
  expect(prompts.get('flow-a')).toContain('may be passed on to `agentteam-maker:flow-b`')
  expect(prompts.get('flow-b')).toContain('receive results from `agentteam-maker:flow-a`')
  expect(prompts.get('flow-b')).toContain('exchange results both ways through main')
  expect(prompts.get('flow-lead')).toContain('Information flow between your sub-agents')
  await ui.unmount()
})
