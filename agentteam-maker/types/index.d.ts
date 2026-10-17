export type AgentKind = 'main' | 'team' | 'agent'

// `main` is the terminal session itself; a `team` node is the team and its
// manager in one box (teamName, isActive for the team; the rest the manager's).
export type AgentNode = {
  id: string
  parentId: string | null
  kind: AgentKind
  teamName: string
  isActive: boolean
  name: string
  model: string
  role: string
  useSkills: boolean
  skills: string[]
  // ids of same-level sibling agents this one's results may be passed to
  sendsTo: string[]
}

export type Flow = 'none' | 'to' | 'from' | 'both'

declare module 'claude-code' {
  interface PluginState {
    'agentteam-maker': {
      nodes: AgentNode[]
      selected: string | null
      notice: string
      isTeamOn: boolean
      announced: string
    }
  }
}
