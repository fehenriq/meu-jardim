import { describe, expect, it } from "vitest"
import { firstName, formatLocalDate } from "./utils"

describe("utilitários de apresentação", () => {
  it("usa somente o primeiro nome e trata nome vazio", () => { expect(firstName("  Ana Maria ")).toBe("Ana"); expect(firstName(" ")).toBe("jardineiro") })
  it("formata a data no fuso do jardim", () => { expect(formatLocalDate(new Date("2026-11-18T01:00:00Z"), "America/Sao_Paulo")).toBe("17/11/2026") })
})
