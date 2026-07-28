export const meta = {
  name: 'feature-kickoff',
  description:
    'Dispatches the discovery fan-out that opens a feature planning phase. Args: slug is the change directory under openspec/changes, tier is full or standard. Folds the arm table by tier, dispatches the researcher and code-analyzer arms in parallel, writes their findings to disk through one writer subagent after the fan-out, validates the rendered code map against the citation validator under a six-dispatch cap, and reruns the code-map arm once on a failing verdict.',
  phases: ['Discover', 'Validate', 'Recheck'],
}

const MAX_DISCOVERY_DISPATCHES = 6
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const WRITER_DISPATCH_COUNT = 1
const VALIDATOR_DISPATCH_COUNT = 1

const briefSchema = {
  type: 'object', additionalProperties: false, required: ['brief'],
  properties: { brief: { type: 'string', minLength: 1 } },
}
const codeMapEntrySchema = {
  type: 'object', additionalProperties: false,
  required: ['path', 'symbols', 'layer', 'note'],
  properties: {
    path: { type: 'string', minLength: 1 },
    symbols: { type: 'array', items: { type: 'string', minLength: 1 } },
    layer: { type: 'string', minLength: 1 },
    note: { type: 'string', minLength: 1, pattern: '^[^\\n\\r]+$' },
  },
}
const codeMapSchema = {
  type: 'object', additionalProperties: false, required: ['entries'],
  properties: { entries: { type: 'array', items: codeMapEntrySchema, minItems: 1 } },
}

const citationFailureSchema = {
  type: 'object', additionalProperties: false, required: ['path', 'reason'],
  properties: { path: { type: 'string' }, symbol: { type: 'string' }, reason: { type: 'string' } },
}
const passVerdictSchema = {
  type: 'object', additionalProperties: false, required: ['status', 'failures'],
  properties: { status: { type: 'string', enum: ['pass'] }, failures: { type: 'array', maxItems: 0 } },
}
const failVerdictSchema = {
  type: 'object', additionalProperties: false, required: ['status', 'failures'],
  properties: {
    status: { type: 'string', enum: ['fail'] },
    failures: { type: 'array', items: citationFailureSchema, minItems: 1 },
  },
}
const errorVerdictSchema = {
  type: 'object', additionalProperties: false, required: ['status', 'reason'],
  properties: { status: { type: 'string', enum: ['error'] }, reason: { type: 'string', minLength: 1 } },
}
const citationVerdictSchema = { oneOf: [passVerdictSchema, failVerdictSchema, errorVerdictSchema] }

const writerFileOutcomeSchema = {
  type: 'object', additionalProperties: false, required: ['path', 'bytesWritten'],
  properties: { path: { type: 'string' }, bytesWritten: { type: 'number' } },
}
const writeOutcomeSchema = {
  type: 'object', additionalProperties: false, required: ['files'],
  properties: { files: { type: 'array', items: writerFileOutcomeSchema } },
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
    armDef(
      'rider-ledger',
      'brief',
      'code-analyzer',
      'prior out-of-scope riders that touch this feature, filed as open issues carrying the rider label, read by running gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body, not by searching the repository, judged against the feature by body text and named by issue number, and reported as a lookup failure rather than an empty ledger when the command fails',
    ),
  ],
  standard: [
    armDef(
      'research',
      'brief',
      'researcher',
      'a single cited brief covering technical research and acceptance criteria from vendor docs and issue trackers',
    ),
    armDef('code-map', 'code-map', 'code-analyzer', CODE_MAP_FOCUS),
  ],
}

function parsedArgs(delivered) {
  if (typeof delivered !== 'string') return delivered
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
  if (!SAFE_SLUG.test(input.slug)) {
    throw new Error(`feature-kickoff received a slug that is not one path segment: "${input.slug}"`)
  }
  if (!Object.prototype.hasOwnProperty.call(armTable, input.tier)) {
    throw new Error(`feature-kickoff received an unsupported tier "${input.tier}"; expected one of: ${Object.keys(armTable).join(', ')}`)
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
  if (!failures || failures.length === 0) return ''
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
function resolveArmQuery(arm, findings) {
  if (arm.kind === 'code-map') {
    if (findings && findings.entries.length > 0) {
      return { arm, findings, status: 'ok' }
    }
    const reason = findings ? 'returned an empty code map' : 'died'
    throw new Error(
      `feature-kickoff process assertion failed: the ${arm.label} arm ${reason}, and validation then has nothing to check`,
    )
  }
  if (!findings) {
    log(`${arm.label} arm died; continuing without its brief`)
    return { arm, findings: null, status: 'skipped' }
  }
  return { arm, findings, status: 'ok' }
}
function assertDispatchCapRespected(arms) {
  const planned = arms.length + WRITER_DISPATCH_COUNT + VALIDATOR_DISPATCH_COUNT
  if (planned > MAX_DISCOVERY_DISPATCHES) {
    throw new Error(
      `feature-kickoff process assertion failed: ${arms.length} arm(s) plus the writer and the validator plan ${planned} dispatch(es), over the cap of ${MAX_DISCOVERY_DISPATCHES}`,
    )
  }
}

function expectedByteLength(content) {
  return new TextEncoder().encode(content).length
}
function writerPrompt(files) {
  return [
    'Write each of the following files exactly as given, creating any missing directories.',
    'Report the UTF-8 byte length you wrote for every path, even one that already matched.',
    ...files.map((file) => `--- ${file.path} ---\n${file.content}`),
  ].join('\n')
}
function assertWriteIntegrity(files, reportedFiles) {
  const reportedByPath = new Map(reportedFiles.map((file) => [file.path, file.bytesWritten]))
  files.forEach((file) => {
    const expected = expectedByteLength(file.content)
    const actual = reportedByPath.get(file.path)
    if (actual !== expected) {
      throw new Error(
        `feature-kickoff process assertion failed: ${file.path} reported ${actual ?? 'no'} byte(s) written, expected ${expected}`,
      )
    }
  })
}
async function dispatchWriter(files, phaseName) {
  const outcome = await agent(writerPrompt(files), {
    label: 'discovery-writer',
    phase: phaseName,
    schema: writeOutcomeSchema,
  })
  if (!outcome) {
    throw new Error('feature-kickoff process assertion failed: the discovery writer subagent died')
  }
  assertWriteIntegrity(files, outcome.files)
}
function validatePrompt(entries) {
  return [
    'Run this exact command, which resolves the repository root itself instead of relying on your working directory:',
    'root="$(git rev-parse --show-toplevel)" && node "$root/.claude/workflows/citation-validator/citation-validator.mts" "$root"',
    'Feed it the JSON code map below on standard input through a heredoc whose delimiter is quoted, for example opening with <<\'JSON\' and closing with a line containing only JSON, so punctuation inside the note fields is not interpreted by the shell.',
    'JSON code map:',
    JSON.stringify(entries),
    'The command prints exactly one JSON object on standard output: status "pass" with an empty failures list, status "fail" with a non-empty failures list, or status "error" with a reason when it never reached a verdict.',
    'If the command prints no parseable JSON at all, report status "error" with a reason describing what happened instead of inventing a verdict.',
    'Report exactly the JSON object that resulted. Change nothing and add no commentary of your own.',
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
function armDispatchOptions(arm, phaseName) {
  return { label: arm.label, phase: phaseName, agentType: arm.subagentType, schema: arm.schema }
}

const input = requireArgs(args)

phase('Discover')
const arms = armTable[input.tier]
assertDispatchCapRespected(arms)
log(`Dispatching ${arms.length} discovery arm(s) for the ${input.tier} tier`)
const findingsList = await parallel(
  arms.map((arm) => () => agent(armQueryPrompt(arm, input), armDispatchOptions(arm, 'Discover'))),
)
const resolved = arms.map((arm, index) => resolveArmQuery(arm, findingsList[index]))
const written = resolved.filter((entry) => entry.status === 'ok')
const filesToWrite = written.map((entry) => ({
  path: armFilePath(input.slug, entry.arm),
  content: armContent(entry.arm, entry.findings),
}))
await dispatchWriter(filesToWrite, 'Discover')

const codeMapEntry = resolved.find((entry) => entry.arm.kind === 'code-map')
let entries = codeMapEntry.findings.entries
phase('Validate')
let verdict = await runValidation(entries)
assertNotInputFault(verdict)
let recheckRan = false

if (verdict.status === 'fail') {
  phase('Recheck')
  recheckRan = true
  log(`Citation validator rejected ${verdict.failures.length} citation(s); rerunning ${codeMapEntry.arm.label}`)
  const rerunFindings = await agent(
    armQueryPrompt(codeMapEntry.arm, input, verdict.failures),
    armDispatchOptions(codeMapEntry.arm, 'Recheck'),
  )
  const rerun = resolveArmQuery(codeMapEntry.arm, rerunFindings)
  entries = rerun.findings.entries
  await dispatchWriter(
    [{ path: armFilePath(input.slug, rerun.arm), content: armContent(rerun.arm, rerun.findings) }],
    'Recheck',
  )
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
  arms: written.map((entry) => ({ label: entry.arm.label, file: armFilePath(input.slug, entry.arm) })),
  entries,
  recheckRan,
}
