import { securityCases, groupsInOrder } from "./cases.ts"
import { loadSecurityEnvironment, AUTHORIZED_PROJECT_REF, REMOTE_TRANSPORT_ENABLED } from "./environment.ts"
import { loadAuthorization, loadFixtureManifest } from "./guards.ts"
import { selectCases } from "./runner.ts"

function option(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

function has(name: string) {
  return process.argv.includes(`--${name}`)
}

function printCases(cases: typeof securityCases) {
  for (const item of cases) {
    console.log([item.id, item.group, item.actor, item.mode, item.mutation ? "mutation" : "read", item.operation].join(" | "))
  }
  const counts = Object.fromEntries(["automated", "hybrid", "manual"].map((mode) => [mode, cases.filter((item) => item.mode === mode).length]))
  console.log(`TOTAL=${cases.length} AUTOMATED=${counts.automated} HYBRID=${counts.hybrid} MANUAL=${counts.manual}`)
}

function main() {
  const root = process.cwd()
  loadSecurityEnvironment(root)
  const group = option("group")
  const caseId = option("case")
  if (group && !groupsInOrder.includes(group)) throw new Error("UNKNOWN_GROUP")
  const selected = selectCases(securityCases, { group, caseId })

  if (!has("remote")) {
    printCases(selected)
    console.log("MODE=OFFLINE NETWORK=DISABLED RESULTS=NOT_EXECUTED")
    return
  }

  if (option("confirm-target") !== AUTHORIZED_PROJECT_REF) throw new Error("EXPLICIT_TARGET_CONFIRMATION_REQUIRED")
  const mutation = selected.some((item) => item.mutation)
  loadAuthorization(root, mutation)
  loadFixtureManifest(root)
  if (!REMOTE_TRANSPORT_ENABLED) throw new Error("REMOTE_TRANSPORT_NOT_ENABLED_IN_THIS_DELIVERY")
  throw new Error("REMOTE_TRANSPORT_ADAPTER_MISSING")
}

try {
  main()
} catch (error) {
  const code = error instanceof Error ? error.message.split(":")[0] : "UNEXPECTED_FAILURE"
  console.error(`SECURITY_EXECUTOR_FAILED code=${code}`)
  process.exitCode = 1
}
