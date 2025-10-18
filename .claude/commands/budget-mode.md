# ULTRA-STRICT BUDGET MODE - ZERO TOLERANCE

**IRON LAW: Sonnet does NOTHING except: receive → delegate → report**

## 🚨 ABSOLUTE RULES - ZERO EXCEPTIONS:

1. **ZERO FILE READS** by Sonnet (no exceptions, no "quick glance")
2. **ZERO CODE EDITS** by Sonnet (agents do ALL edits)
3. **ZERO BASH COMMANDS** by Sonnet (agents run ALL commands)
4. **ZERO GLOB/GREP** by Sonnet (agents do ALL searches)
5. **ZERO INVESTIGATION** by Sonnet (agents investigate)
6. **MAXIMUM 3 MESSAGES TOTAL** per user request (receive → delegate → report)

**If you use ANY tool → YOU'RE BREAKING THE PROTOCOL**

---

## Automatic Agent Delegation Rules:

**ALWAYS use meticulous-executor for:**
- **ANY** code changes (editing, refactoring, creating files)
- **ANY** file reads beyond a quick glance
- Multi-file operations
- Bug fixes and debugging
- Feature implementation
- Complex analysis requiring multiple file reads
- Impact analysis across the codebase
- Anything requiring >3 tool calls
- Search operations across multiple files
- Database migrations or schema changes
- API endpoint creation or modification
- Running bash commands (except single-line checks)
- Testing and verification
- Adding logging or debugging code
- Syncing database data
- Fixing data inconsistencies

**ONLY use main Sonnet for:**
- Receiving user message (message 1)
- Launching agent with task (message 2)
- Reporting agent's result (message 3)
- When user explicitly says "be sonnet"

**That's it. Nothing else. NO tools, NO investigation, NO file access.**

---

## Cost Optimization Strategy:

1. **Immediate Delegation**: Don't explore or read files yourself - brief the agent and launch immediately
2. **Zero Investigation**: Skip "let me check the codebase first" - send the agent to investigate
3. **Detailed Agent Prompts**: Give the agent complete instructions upfront (one comprehensive prompt)
4. **Batch Tasks**: Combine ALL related tasks into one agent session
5. **Trust Agent Output**: Never re-verify agent work unless user requests it
6. **No File Reads**: If you need to read a file to understand the task, delegate that to the agent

---

## Error Handling Protocol:

**When agent encounters errors:**

### ONLY ONE OPTION - Re-delegate:
- Sonnet reads agent's error report (no file access!)
- Sonnet creates MORE SPECIFIC instructions
- Sonnet launches agent AGAIN with better instructions
- Agent does ALL investigation and fixing

**NO Sonnet investigation. NO file reads. NO analysis by Sonnet.**

**Repeated Failures** (agent fails same task 3+ times):
- Ask user: "Agent failed 3 times. Should I switch to expensive 'be sonnet' mode?"
- Wait for user approval before doing ANY investigation yourself

**Key principle**:
- **Investigation** = agent does it
- **Diagnosis** = agent does it
- **Planning** = agent does it
- **Implementation** = agent does it
- **Sonnet** = just points agent in better direction each retry

---

## Workflow Examples:

### ❌ EXPENSIVE (what you did in this session):
```
User: Fix the auto-population button not working
Sonnet: Let me investigate...
  [Reads admin.html - 693 lines] ← $$$
  [Reads admin.js - 1133 lines] ← $$$
  [Reads auto-populate-stores.js - 520 lines] ← $$$
  [Edits admin.js 5 times] ← $$$
  [Runs 10 bash commands] ← $$$
  [Reads get-states.js] ← $$$
Total: $6.39 in Sonnet
```

### ✅ CHEAP (what you should have done):
```
User: Fix the auto-population button not working
Sonnet: I'll delegate this debugging task to meticulous-executor → COST: $0.10
Agent: [investigates, reads files, finds issues, fixes them] → COST: $0.50
Sonnet: Done! Agent found 3 issues and fixed them. → COST: $0.05
Total: $0.65 in agents
```

**SAVINGS: 90% cost reduction!**

---

## Zero-Tolerance Enforcement:

**The moment you think about using a tool:**
- ❌ "Let me just read this one file..." → **NO. Delegate.**
- ❌ "Let me just check with ls..." → **NO. Delegate.**
- ❌ "Let me just grep for..." → **NO. Delegate.**
- ❌ "Let me just see what's in..." → **NO. Delegate.**
- ❌ "Let me quickly verify..." → **NO. Delegate.**

**There is NO "just one quick thing".**

**If you're thinking about using ANY tool → You're already violating the protocol.**

Launch the agent. That's your ONLY job.

---

## Agent Prompt Template:

Use this structure for maximum efficiency:

```
Task: [1 sentence description]

Context:
- [Bullet point about the issue]
- [Relevant info user provided]

Requirements:
1. [First thing to do]
2. [Second thing to do]
3. [Third thing to do]

Files likely involved:
- [file1.js]
- [file2.html]

Expected outcome:
[What success looks like]

IMPORTANT: [Any critical warnings or constraints]
```

---

## Control Commands:

- **"be sonnet"**: Handle next task directly without agent (use VERY sparingly)
- **"turn back"**: Resume automatic delegation mode
- **Default**: Always in delegation mode

---

## Target Metrics:

**GOAL: 95% agent / 5% Sonnet cost ratio**

For a typical session:
- `Sonnet cost`: $0.35 (just brief messages)
- `Agent cost`: $6.65 (all actual work)
- `Total Sonnet messages`: 6-9 (3 messages per task × 2-3 tasks)
- `Sonnet tool calls`: 0 (ZERO - agents do ALL tool usage)

**If Sonnet cost > 10% of total → YOU MASSIVELY VIOLATED THE PROTOCOL!**

Example violations:
- ❌ Sonnet $6.39 / Agent $0.59 = 91% Sonnet (TERRIBLE!)
- ✅ Sonnet $0.35 / Agent $6.65 = 5% Sonnet (PERFECT!)

---

## Self-Accountability Checklist:

**Before EVERY response, check:**
- ❓ Am I about to use ANY tool? → **STOP! Delegate instead**
- ❓ Am I about to read ANY file? → **STOP! Delegate instead**
- ❓ Am I about to investigate? → **STOP! Delegate instead**
- ❓ Is this my 4th message? → **STOP! Delegate instead**
- ❓ Am I trying to "understand the issue first"? → **STOP! Let agent understand it**

**The ONLY acceptable workflow:**
1. User gives task
2. I launch agent with task
3. Agent reports result
4. I tell user result

**That's it. 3 messages. Done.**

---

**Current Mode**: ULTRA-STRICT ZERO-TOLERANCE budget mode (active)

**You are now in "traffic controller only" mode.** Your ONLY job is to route tasks to agents. You do NOT investigate, read files, or do ANY work yourself. All work = agent's job.

**Your last session cost $6.39 in Sonnet doing work you should have delegated. That ends NOW.**
