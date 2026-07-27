export const meta = {
  name: 'review-pr',
  description:
    'Heavy adversarial review over a PR diff. Args: sha is the reviewed head commit, repo is the owner/repo slug, diffRange is the range to review. Runs two adversarial-reviewer seats with model and angle diversity, escalates conflicting verdicts to a Fable judge at maximum effort, and posts the feature-cycle/reviewed commit status only when no finding survives.',
  phases: ['Review', 'Judge', 'Verify'],
}

const seatBlueprints = [
  {
    label: 'correctness-regression',
    lens: 'correctness and regression risk: broken logic, unhandled edge cases, data loss, and behavior that diverges from the stated intent',
  },
  {
    label: 'security-failure-modes',
    model: 'fable',
    lens: 'security and failure modes: unsafe input handling, injection, race conditions, resource exhaustion, and error paths that fail open',
  },
]

const findingsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['location', 'defect', 'failureScenario', 'confidence', 'reproduced', 'verdict', 'reason'],
        properties: {
          location: { type: 'string' },
          defect: { type: 'string' },
          failureScenario: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          reproduced: { type: 'boolean' },
          verdict: { type: 'string', enum: ['confirmed', 'dropped'] },
          reason: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        },
      },
    },
  },
}

const judgeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'reason'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'dropped'] },
    reason: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
  },
}

const statusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['posted'],
  properties: {
    posted: { type: 'boolean' },
    detail: { type: 'string' },
  },
}

function requireArgs(input) {
  const keys = ['sha', 'repo', 'diffRange']
  const missing = keys.filter((key) => !input || typeof input[key] !== 'string' || input[key].length === 0)
  if (missing.length > 0) {
    throw new Error(
      `review-pr needs string args { sha, repo, diffRange }; missing or empty: ${missing.join(', ')}`,
    )
  }
  return { sha: input.sha, repo: input.repo, diffRange: input.diffRange }
}

function seatModel(seat) {
  return seat.model ?? 'opus'
}

function seatOptions(seat, schema) {
  const options = {
    label: seat.label,
    phase: 'Review',
    agentType: 'adversarial-reviewer',
    schema,
  }
  if (seat.model) {
    options.model = seat.model
  }
  return options
}

function reviewPrompt(seat, input) {
  return [
    `You are one seat of a two-seat adversarial review over the diff at ${input.diffRange} in ${input.repo} at commit ${input.sha}.`,
    `Your lens is ${seat.lens}.`,
    'Read the diff and its surrounding context with the tools you have. Change nothing.',
    'For every candidate defect, reproduce it yourself by running the commands that show the break. Reproduce or drop: a claim you cannot reproduce is dropped.',
    'Score each finding for confidence from 0 to 100 and drop anything below 80.',
    'Return every finding you evaluated. Mark verdict confirmed when you reproduced it at confidence 80 or above, otherwise mark it dropped and give the reason.',
    'For each finding give a stable location, the defect, and a concrete failure scenario.',
  ].join('\n')
}

function judgePrompt(group, input) {
  const lead = group.entries[0].finding
  const perspectives = group.entries
    .map(
      (entry) =>
        `Seat ${entry.seatLabel} ruled ${entry.finding.verdict} at confidence ${entry.finding.confidence}. Reason: ${entry.finding.reason}. Failure scenario: ${entry.finding.failureScenario}.`,
    )
    .join('\n')
  return [
    `Two adversarial seats disagree on one finding in ${input.repo} at commit ${input.sha}, diff range ${input.diffRange}.`,
    `Location: ${lead.location}.`,
    `Defect: ${lead.defect}.`,
    perspectives,
    'Settle the conflict yourself. Reproduce the claim by running the commands that would show the break.',
    'Reproduce or drop: rule confirmed only when you reproduce it at confidence 80 or above, otherwise rule dropped and give the reason.',
  ].join('\n')
}

function statusPrompt(input) {
  return [
    `The heavy adversarial review passed with no surviving findings for ${input.repo} at commit ${input.sha}.`,
    'Post the reviewed commit status by running this exact command:',
    `gh api repos/${input.repo}/statuses/${input.sha} -f state=success -f context=feature-cycle/reviewed -f description="Adversarial review passed with no surviving findings"`,
    'Report posted true only when the command returns a created status.',
  ].join('\n')
}

function assertDistinctSeats(blueprints, results) {
  const present = results.every((result) => result && Array.isArray(result.findings))
  if (!present) {
    throw new Error('review-pr process assertion failed: both reviewer seats must return structured findings')
  }
  const labels = new Set(blueprints.map((seat) => seat.label))
  const models = new Set(blueprints.map((seat) => seatModel(seat)))
  if (labels.size !== blueprints.length || models.size !== blueprints.length) {
    throw new Error('review-pr process assertion failed: the two seats must be distinct in label and model')
  }
}

function findingKey(finding) {
  return `${finding.location}::${finding.defect}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function classifyGroup(entries) {
  const verdicts = new Set(entries.map((entry) => entry.finding.verdict))
  if (verdicts.size > 1) {
    return 'disputed'
  }
  return verdicts.has('confirmed') ? 'confirmed' : 'dropped'
}

function groupFindings(blueprints, results) {
  const groups = new Map()
  results.forEach((result, seatIndex) => {
    const seatLabel = blueprints[seatIndex].label
    result.findings.forEach((finding) => {
      const key = findingKey(finding)
      const existing = groups.get(key) ?? { key, entries: [] }
      existing.entries.push({ seatLabel, finding })
      groups.set(key, existing)
    })
  })
  return [...groups.values()].map((group) => ({ ...group, status: classifyGroup(group.entries) }))
}

function leadFinding(group) {
  const confirmed = group.entries.find((entry) => entry.finding.verdict === 'confirmed')
  return (confirmed ?? group.entries[0]).finding
}

function droppedReason(entries) {
  const reasons = entries.map((entry) => entry.finding.reason).filter(Boolean)
  return reasons.length > 0 ? reasons.join(' | ') : 'dropped by every seat that saw it'
}

function settleGroups(groups, disputes, rulings) {
  const rulingByKey = new Map(disputes.map((group, index) => [group.key, rulings[index]]))
  const confirmed = []
  const dropped = []
  groups.forEach((group) => {
    const lead = leadFinding(group)
    const seats = group.entries.map((entry) => entry.seatLabel)
    if (group.status === 'disputed') {
      const ruling = rulingByKey.get(group.key)
      const record = { ...lead, seats, judge: ruling.reason }
      if (ruling.verdict === 'confirmed') {
        confirmed.push(record)
      } else {
        dropped.push({ ...record, reason: ruling.reason })
      }
      return
    }
    if (group.status === 'confirmed') {
      confirmed.push({ ...lead, seats })
      return
    }
    dropped.push({ ...lead, seats, reason: droppedReason(group.entries) })
  })
  return { confirmed, dropped }
}

export default async function reviewPr() {
  const input = requireArgs(args)

  phase('Review')
  log(`Dispatching two adversarial seats over ${input.diffRange}`)
  const seatResults = await parallel(
    seatBlueprints.map((seat) => () => agent(reviewPrompt(seat, input), seatOptions(seat, findingsSchema))),
  )

  assertDistinctSeats(seatBlueprints, seatResults)

  const grouped = groupFindings(seatBlueprints, seatResults)
  const disputes = grouped.filter((group) => group.status === 'disputed')

  let rulings = []
  if (disputes.length > 0) {
    phase('Judge')
    log(`Escalating ${disputes.length} conflicting finding(s) to the judge`)
    rulings = await parallel(
      disputes.map((group) => () =>
        agent(judgePrompt(group, input), {
          label: `judge-${group.key}`,
          phase: 'Judge',
          model: 'fable',
          effort: 'max',
          schema: judgeSchema,
        }),
      ),
    )
  }

  const settled = settleGroups(grouped, disputes, rulings)
  const confirmedFindings = settled.confirmed
  const droppedFindings = settled.dropped

  phase('Verify')
  const seatLabels = seatBlueprints.map((seat) => seat.label)
  const judgeCalls = disputes.map((group, index) => ({
    finding: group.key,
    verdict: rulings[index].verdict,
    reason: rulings[index].reason,
  }))

  let statusPosted = false
  if (confirmedFindings.length === 0) {
    const posting = await agent(statusPrompt(input), {
      label: 'post-reviewed-status',
      phase: 'Verify',
      schema: statusSchema,
    })
    statusPosted = posting.posted === true
  } else {
    log(`${confirmedFindings.length} finding(s) survived; withholding the reviewed status for the fix cycle`)
  }

  return {
    confirmedFindings,
    droppedFindings,
    seatLabels,
    judgeCalls,
    statusPosted,
  }
}
