import { describe, expect, it } from "vitest"
import { protectedRouteState } from "./route-state"

describe("proteção de rotas", () => {
  it("espera o bootstrap antes de decidir", () => { expect(protectedRouteState(true, false)).toBe("loading") })
  it("redireciona visitante e libera usuário autenticado", () => { expect(protectedRouteState(false, false)).toBe("redirect"); expect(protectedRouteState(false, true)).toBe("allow") })
})
