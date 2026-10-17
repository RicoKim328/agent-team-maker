# agent-team-maker

A Claude Code mod that lets you design multi-level Orchestrator/Worker agent teams in a pane and export them as subagents.

## Install

```
/plugin marketplace add RicoKim328/agent-team-maker
/plugin install agentteam-maker@rico-agentteam
```

## Layout

- `.claude-plugin/marketplace.json` — marketplace manifest (`rico-agentteam`)
- `agentteam-maker/hooks/register.tsx` — pane UI and the `add_team` MCP tool
- `agentteam-maker/types/index.d.ts` — plugin state types
- `agentteam-maker/tests/pane.test.tsx` — pane tests
