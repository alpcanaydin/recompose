export const meta = {
  name: 'feature-kickoff',
  description:
    'Dispatches the discovery fan-out that opens a feature planning phase. Args: slug is the change directory under openspec/changes, tier is full or standard. Folds the arm table by tier, dispatches the researcher and code-analyzer arms in parallel under a six-arm cap, renders and validates the code map against the citation validator, and reruns the code-map arm once on a failing verdict.',
  phases: ['Discover', 'Validate', 'Recheck'],
}

const MAX_ARMS = 6

const briefSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['brief'],
  properties: { brief: { type: 'string', minLength: 1 } },
}

const codeMapEntrySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'symbols', 'layer', 'note'],
  properties: {
    path: { type: 'string', minLength: 1 },
    symbols: { type: 'array', items: { type: 'string', minLength: 1 } },
    layer: { type: 'string', minLength: 1 },
    note: { type: 'string', minLength: 1 },
  },
}

const codeMapSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: { entries: { type: 'array', items: codeMapEntrySchema } },
}

const citationFailureSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'reason'],
  properties: { path: { type: 'string' }, symbol: { type: 'string' }, reason: { type: 'string' } },
}

const citationVerdictSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['pass', 'fail', 'error'] },
    failures: { type: 'array', items: citationFailureSchema },
    reason: { type: 'string' },
  },
}

const writeOutcomeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['written'],
  properties: { written: { type: 'boolean' }, path: { type: 'string' } },
}

const CODE_MAP_FOCUS = 'a code map of the paths, symbols, and Feature-Sliced Design layers this feature touches'

function armDef(label, kind, subagentType, focus) {
  return { label, kind, subagentType, schema: kind === 'code-map' ? codeMapSchema : briefSchema, focus }
}

const armTable = {
  full: [
    armDef('technical-research', 'brief', 'researcher', 'a cited brief on libraries, standards, and prior art relevant to this feature'),
    armDef(
      'acceptance-references',
      'brief',
      'researcher',
      'acceptance criteria drawn from vendor docs, issue trackers, and community complaints, because broken expectations reveal the criteria happy-path docs omit',
    ),
    armDef('code-map', 'code-map', 'code-analyzer', CODE_MAP_FOCUS),
    armDef('rider-ledger', 'brief', 'code-analyzer', 'prior out-of-scope riders that touch this feature'),
  ],
  standard: [
    armDef(
      'research',
      'brief',
      'researcher',
      'a single cited brief covering technical research, acceptance criteria from vendor docs and issue trackers, and prior out-of-scope riders for this feature',
    ),
    armDef('code-map', 'code-map', 'code-analyzer', CODE_MAP_FOCUS),
  ],
}

function parsedArgs(delivered) {
  if (typeof delivered !== 'string') {
    return delivered
  }
  try {
    return JSON.parse(delivered)
  } catch (error) {
    throw new Error(`feature-kickoff received args as a string that is not valid JSON: ${error.message}`)
  }
}

function requireArgs(delivered) {
  const input = parsedArgs(delivered)
  const keys = ['slug', 'tier']
  const missing = keys.filter((key) => !input || typeof input[key] !== 'string' || input[key].length === 0)
  if (missing.length > 0) {
    throw new Error(`feature-kickoff needs string args { slug, tier }; missing or empty: ${missing.join(', ')}`)
  }
  if (!Object.prototype.hasOwnProperty.call(armTable, input.tier)) {
    throw new Error(
      `feature-kickoff received an unsupported tier "${input.tier}"; expected one of: ${Object.keys(armTable).join(', ')}`,
    )
  }
  return { slug: input.slug, tier: input.tier }
}

function discoveryDirectory(slug) {
  return `openspec/changes/${slug}/discovery`
}
function armFilePath(slug, arm) {
  return `${discoveryDirectory(slug)}/${arm.label}.md`
}

function renderCodeMapEntry(entry) {
  const symbols = entry.symbols.length > 0 ? entry.symbols.join(', ') : 'none'
  return `- \`${entry.path}\` (${entry.layer}) — symbols: ${symbols}. ${entry.note}`
}
function renderCodeMapMarkdown(entries) {
  return ['# Code map', '', ...entries.map(renderCodeMapEntry), ''].join('\n')
}

function armContent(arm, findings) {
  return arm.kind === 'code-map' ? renderCodeMapMarkdown(findings.entries) : findings.brief
}

function citationRepairNote(failures) {
  if (!failures || failures.length === 0) {
    return ''
  }
  const named = failures
    .map((failure) => `${failure.path}${failure.symbol ? ` (symbol: ${failure.symbol})` : ''}: ${failure.reason}`)
    .join('\n')
  return [
    '',
    'The citation validator rejected these citations from your previous code map. Cite only paths and symbols that exist in the repository, then return the corrected map in full.',
    named,
  ].join('\n')
}

function armQueryPrompt(arm, input, failures) {
  const header = `You are the ${arm.label} discovery arm for the feature at openspec/changes/${input.slug}, tier ${input.tier}.`
  const ask =
    arm.kind === 'code-map'
      ? `Produce ${arm.focus}. Cite every path and symbol you reference, and give one line on what each entry contributes.`
      : `Produce ${arm.focus}. Back every claim with a source or a repository reference.`
  return [header, ask].join('\n') + citationRepairNote(failures)
}

function writePrompt(path, content) {
  return [
    `Write the following content exactly to ${path}, creating any missing directories.`,
    'Change nothing in the content.',
    '---',
    content,
  ].join('\n')
}

async function writeArmFile(arm, input, phaseName, findings) {
  const path = armFilePath(input.slug, arm)
  const outcome = await agent(writePrompt(path, armContent(arm, findings)), {
    label: `${arm.label}-write`,
    phase: phaseName,
    schema: writeOutcomeSchema,
  })

  return outcome && outcome.written === true ? path : null
}

async function dispatchArm(arm, input, phaseName, failures) {
  const findings = await agent(armQueryPrompt(arm, input, failures), {
    label: arm.label,
    phase: phaseName,
    agentType: arm.subagentType,
    schema: arm.schema,
  })

  if (!findings) {
    return { arm, findings: null, path: null }
  }

  const path = await writeArmFile(arm, input, phaseName, findings)

  return { arm, findings, path }
}

function resolveArm(outcome) {
  if (outcome.findings && outcome.path) {
    return { ...outcome, status: 'ok' }
  }

  const failureKind = outcome.findings ? 'failed to write its discovery file' : 'died'

  if (outcome.arm.subagentType === 'code-analyzer') {
    throw new Error(
      `feature-kickoff process assertion failed: the ${outcome.arm.label} arm ${failureKind}, and code-analyzer output is required for validation`,
    )
  }

  log(`${outcome.arm.label} arm ${failureKind}; continuing without its brief`)

  return { ...outcome, status: 'skipped' }
}

function assertArmCapRespected(arms) {
  if (arms.length > MAX_ARMS) {
    throw new Error(
      `feature-kickoff process assertion failed: the folded arm table has ${arms.length} arm(s), over the cap of ${MAX_ARMS}`,
    )
  }
}

function validatePrompt(entries) {
  return [
    'Run this exact command from the repository root, piping the JSON code map below on standard input:',
    'node .claude/workflows/citation-validator/citation-validator.mts .',
    'Standard input:',
    JSON.stringify(entries),
    'The command prints exactly one JSON object on standard output: status "pass" with an empty failures list, status "fail" with a failures list, or status "error" with a reason when it never reached a verdict.',
    'Report exactly the JSON object the command printed. Change nothing and add no commentary of your own.',
  ].join('\n')
}

async function runValidation(entries) {
  const verdict = await agent(validatePrompt(entries), {
    label: 'citation-validator',
    phase: 'Validate',
    model: 'haiku',
    schema: citationVerdictSchema,
  })

  if (!verdict) {
    throw new Error('feature-kickoff process assertion failed: the citation-validator subagent died')
  }

  return verdict
}

function assertNotInputFault(verdict) {
  if (verdict.status === 'error') {
    throw new Error(`feature-kickoff citation validator reported an input fault: ${verdict.reason}`)
  }
}

function describeCitation(failure) {
  return failure.symbol ? `${failure.path}:${failure.symbol}` : failure.path
}

const input = requireArgs(args)

phase('Discover')
const arms = armTable[input.tier]
assertArmCapRespected(arms)
log(`Dispatching ${arms.length} discovery arm(s) for the ${input.tier} tier`)
const dispatched = (await parallel(arms.map((arm) => () => dispatchArm(arm, input, 'Discover')))).map(resolveArm)

const codeMapOutcome = dispatched.find((outcome) => outcome.arm.kind === 'code-map')
let entries = codeMapOutcome.findings.entries

phase('Validate')
let verdict = await runValidation(entries)
assertNotInputFault(verdict)

let recheckRan = false

if (verdict.status === 'fail') {
  phase('Recheck')
  recheckRan = true
  log(`Citation validator rejected ${verdict.failures.length} citation(s); rerunning ${codeMapOutcome.arm.label}`)

  const rerunOutcome = resolveArm(await dispatchArm(codeMapOutcome.arm, input, 'Recheck', verdict.failures))
  entries = rerunOutcome.findings.entries
  dispatched[dispatched.indexOf(codeMapOutcome)] = rerunOutcome

  verdict = await runValidation(entries)
  assertNotInputFault(verdict)

  if (verdict.status === 'fail') {
    throw new Error(
      `feature-kickoff citation validator failed twice; failing citations: ${verdict.failures.map(describeCitation).join(', ')}`,
    )
  }
}

return {
  discoveryDirectory: discoveryDirectory(input.slug),
  arms: dispatched
    .filter((outcome) => outcome.status === 'ok')
    .map((outcome) => ({ label: outcome.arm.label, file: outcome.path })),
  entries,
  recheckRan,
}
