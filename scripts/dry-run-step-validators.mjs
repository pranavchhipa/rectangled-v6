// Hotfix PRD §3 (Step A) — dry-run the new SurveyStep validators against
// every step in every prod survey's `steps[]` array.
//
// Read-only: no UPDATE, no DELETE. Prints a per-survey report plus a
// per-step-type pass/fail summary. If anything fails, we share the
// failure list with the user BEFORE tightening `survey.update.steps`
// in the public validator.
//
// Run: `set -a && source .env && set +a && node scripts/dry-run-step-validators.mjs`

import postgres from 'postgres'
import 'dotenv/config'
import { surveyStepsSchema } from '../packages/shared/dist/validators/survey-steps.js'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

function header(s) {
  console.log('\n' + '─'.repeat(72))
  console.log(s)
  console.log('─'.repeat(72))
}

try {
  const surveys = await sql`
    SELECT id, name, slug, template, mode, status,
           jsonb_array_length(steps) AS step_count,
           steps
    FROM surveys
    WHERE jsonb_typeof(steps) = 'array'
    ORDER BY template, slug
  `

  console.log(`Loaded ${surveys.length} surveys from production.`)

  let surveysOk = 0
  let surveysFailed = 0
  const failures = []
  const perTypePass = {}
  const perTypeFail = {}

  for (const s of surveys) {
    const steps = s.steps
    const result = surveyStepsSchema.safeParse(steps)

    if (result.success) {
      surveysOk += 1
      // Tally per-type passes from the parsed (typed) result.
      for (const step of result.data) {
        perTypePass[step.type] = (perTypePass[step.type] ?? 0) + 1
      }
    } else {
      surveysFailed += 1
      // Group issues by step index so we can show which step in the array failed.
      const issuesByStepIdx = new Map()
      for (const issue of result.error.issues) {
        const stepIdx = issue.path[0]
        if (typeof stepIdx === 'number') {
          if (!issuesByStepIdx.has(stepIdx)) issuesByStepIdx.set(stepIdx, [])
          issuesByStepIdx.get(stepIdx).push(issue)
        } else {
          // Top-level array issue (rare, e.g., not an array).
          if (!issuesByStepIdx.has(-1)) issuesByStepIdx.set(-1, [])
          issuesByStepIdx.get(-1).push(issue)
        }
      }
      // Tally per-type passes for steps that DID validate (in array view we
      // don't get partial parses, so we fall back to inspecting raw data).
      for (let i = 0; i < (Array.isArray(steps) ? steps.length : 0); i += 1) {
        const step = steps[i]
        const stepType = step?.type ?? 'UNKNOWN'
        if (issuesByStepIdx.has(i)) {
          perTypeFail[stepType] = (perTypeFail[stepType] ?? 0) + 1
        } else {
          perTypePass[stepType] = (perTypePass[stepType] ?? 0) + 1
        }
      }

      failures.push({
        survey: { id: s.id, name: s.name, slug: s.slug, template: s.template, mode: s.mode },
        stepCount: s.step_count,
        issuesByStepIdx,
        steps,
      })
    }
  }

  header(`Summary — ${surveysOk}/${surveys.length} surveys parsed cleanly`)
  console.log(`  passed: ${surveysOk}`)
  console.log(`  failed: ${surveysFailed}`)

  header('Per-step-type pass / fail counts (across all surveys)')
  const allTypes = new Set([...Object.keys(perTypePass), ...Object.keys(perTypeFail)])
  console.log('  step_type            | pass | fail')
  for (const t of [...allTypes].sort()) {
    console.log(
      `  ${t.padEnd(20)} | ${String(perTypePass[t] ?? 0).padStart(4)} | ${String(perTypeFail[t] ?? 0).padStart(4)}`,
    )
  }

  if (failures.length > 0) {
    header(`Failure detail — ${failures.length} surveys with at least one bad step`)
    for (const f of failures) {
      console.log(`\n  Survey: ${f.survey.name} [${f.survey.slug}]`)
      console.log(
        `    id=${f.survey.id} template=${f.survey.template} mode=${f.survey.mode} steps=${f.stepCount}`,
      )
      for (const [idx, issues] of f.issuesByStepIdx.entries()) {
        const step = idx >= 0 ? f.steps[idx] : null
        const stepLabel =
          idx >= 0
            ? `step[${idx}] type='${step?.type ?? 'UNKNOWN'}' id='${step?.id ?? '?'}'`
            : 'top-level'
        console.log(`    ${stepLabel}:`)
        for (const issue of issues) {
          console.log(
            `      • path=${JSON.stringify(issue.path)} code=${issue.code} message="${issue.message}"`,
          )
        }
      }
    }
  } else {
    header(`🎉 No validator failures — all ${surveys.length} surveys pass strictly.`)
  }
} finally {
  await sql.end()
}
