import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202611190001_care_schedules_and_events.sql"),
  "utf8",
)

describe("contrato estático da migration de cuidados", () => {
  it("cria agendas e eventos com vínculos compostos e sem exclusão em cascata", () => {
    expect(migration).toMatch(/create table public\.care_schedules/i)
    expect(migration).toMatch(/create table public\.care_events/i)
    expect(migration).toMatch(/foreign key \(plant_id, garden_id\) references public\.plants\(id, garden_id\) on delete restrict/i)
    expect(migration).toMatch(/foreign key \(schedule_id, garden_id, plant_id\) references public\.care_schedules\(id, garden_id, plant_id\) on delete restrict/i)
    expect(migration).not.toMatch(/on public\.(care_schedules|care_events) for delete/i)
  })

  it("protege autoria, escopo e privilégios mínimos", () => {
    expect(migration).toMatch(/new\.garden_id := resolved_garden_id/i)
    expect(migration).toMatch(/new\.created_by := auth\.uid\(\)/i)
    expect(migration).toMatch(/actor_id, request_id[\s\S]*?uid, p_request_id/i)
    expect(migration).toMatch(/revoke all on table public\.care_schedules, public\.care_events from authenticated/i)
    expect(migration).not.toMatch(/grant (insert|update|delete).*public\.care_events/i)
  })

  it("mantém RLS, função restrita e view pendente sem plantas arquivadas", () => {
    expect(migration).toMatch(/alter table public\.care_schedules enable row level security/i)
    expect(migration).toMatch(/alter table public\.care_events enable row level security/i)
    expect(migration).toMatch(/security definer\s+set search_path = ''/i)
    expect(migration).toMatch(/revoke all on function public\.record_care_action[\s\S]*?from public/i)
    expect(migration).toMatch(/with \(security_invoker = true\)/i)
    expect(migration).toMatch(/p\.status <> 'archived'/i)
  })

  it("distingue rega, umidade, adiamento e outros cuidados", () => {
    expect(migration).toContain("'watered', 'moisture_checked', 'deferred', 'care_completed'")
    expect(migration).toMatch(/care_type = 'custom' and custom_title is not null/i)
    expect(migration).toMatch(/p_action = 'watered' and target_schedule\.care_type = 'watering_check'/i)
    expect(migration).toMatch(/p_action = 'moisture_checked'[\s\S]*?coalesce\([\s\S]*?, 2\)/i)
    expect(migration).toMatch(/p_action = 'deferred'[\s\S]*?p_defer_days not between 1 and 365/i)
    expect(migration).toMatch(/p_action = 'care_completed' and target_schedule\.care_type <> 'watering_check'/i)
  })

  it("calcula data civil no timezone do jardim e não recalcula agenda espontânea", () => {
    expect(migration).toMatch(/\(p_event_at at time zone garden_timezone\)::date/i)
    expect(migration).toMatch(/if p_schedule_id is null then[\s\S]*?p_action <> 'watered'/i)
    expect(migration).toMatch(/else[\s\S]*?update public\.care_schedules[\s\S]*?set next_due_date = next_date/i)
  })

  it("serializa ações e retorna resposta estável para retry idempotente", () => {
    expect(migration).toMatch(/constraint care_events_request_unique unique \(garden_id, actor_id, request_id\)/i)
    expect(migration).toMatch(/from public\.plants p[\s\S]*?for update/i)
    expect(migration).toMatch(/from public\.care_schedules s[\s\S]*?for update/i)
    expect(migration).toMatch(/if existing_event\.id is not null then\s+return existing_event/i)
    expect(migration).toMatch(/when unique_violation then/i)
  })
})
