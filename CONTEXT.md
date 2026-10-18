# Agent Template Context

Reusable language for the Agent platform template. This glossary names product concepts only; implementation decisions stay in code or ADRs.

## Language

**Agent job**:
A queued request to start an Agent run from a prompt and timestamp.
_Avoid_: Task, queue item

**Agent job intake**:
The act of accepting a requested Agent job into the system and returning acceptance metadata.
_Avoid_: Job route, enqueue helper

**Agent runtime**:
The Eve implementation of Agent behavior used by Chat SSE and queued Agent jobs.
_Avoid_: Agent type, Agent mode

**Agent authored surface**:
A runtime-owned filesystem tree containing stable instructions, connections, permissions, and reusable skills interpreted by that runtime.
_Avoid_: Runtime source code, platform Agent config

**Agent run**:
One execution of an Agent from a prompt through the Eve Agent runtime. It may be started by Chat SSE or by a queued Agent job.
_Avoid_: Agent work, job result

**Agent run event**:
An event emitted while an Agent runtime executes an Agent run.
_Avoid_: UI timeline item, log line

**Agent continuation**:
A server-issued opaque resume handle returned by an Agent run that can accept another message or input response. Its runtime-specific session state and validity rules are not part of the shared product language.
_Avoid_: Eve session cursor, continuation token fields

**Agent input request**:
A request emitted when an Agent run pauses for human confirmation, selection, or text before execution can continue.
_Avoid_: HITL event, approval popup

**Agent input response**:
A structured answer to an Agent input request, correlated by request identity and carrying either a selected option or text.
_Avoid_: Approval string, follow-up prompt

**Agent message part**:
One ordered piece of an assistant message, such as text or a folded tool event.
_Avoid_: Timeline item, standalone panel

**Template event**:
A reusable sample event that records Agent platform activity for demos, local verification, and Toolbox inspection.
_Avoid_: Database row, log line

**Ecommerce fixture**:
A deterministic, synthetic retail dataset for Toolbox functional validation. It contains no real customer or transaction data.
_Avoid_: Production export, random demo data

**Ecommerce order**:
A synthetic retail order with customer segment, channel, payment, fulfillment state, and order lines. Refunds may be full or partial.
_Avoid_: Template event, Agent run

**Tool provider**:
An external capability source that exposes tools an Agent run may use.
_Avoid_: Agent runtime, app service

**Toolbox server**:
A Tool provider backed by MCP Toolbox for Databases.
_Avoid_: Database helper, embedded database client

**Toolbox group**:
A named group of Toolbox server tools used to generate a focused Agent capability.
_Avoid_: Toolbox toolset (deprecated upstream term), runtime plugin, database permission set

**Agent MCP connection**:
A connection owned by one Agent runtime that exposes an allowed subset of an external Tool provider to that runtime.
_Avoid_: MCP Host, platform MCP registry

**Eve Agent runtime**:
A filesystem-first Agent runtime shaped by Eve's authored surface.
_Avoid_: Eve-style runtime, Eve clone, file runtime
