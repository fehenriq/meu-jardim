import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { InvitePage } from "./invite-page"
import { INVITE_TOKEN_KEY } from "./rules"

const mocks = vi.hoisted(() => ({
  inspectInvite: vi.fn(),
  acceptInvite: vi.fn(),
  refresh: vi.fn(),
  selectGarden: vi.fn(),
  preferGarden: vi.fn(),
  auth: { authenticated: false },
}))

vi.mock("./api", () => ({
  inspectInvite: (...args: unknown[]) => mocks.inspectInvite(...args),
  acceptInvite: (...args: unknown[]) => mocks.acceptInvite(...args),
}))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.authenticated ? { id: "user-1" } : null, loading: false }) }))
vi.mock("@/features/gardens/garden-context", () => ({
  useGarden: () => ({ refresh: mocks.refresh, selectGarden: mocks.selectGarden }),
  preferGarden: (...args: unknown[]) => mocks.preferGarden(...args),
}))

describe("fluxo da página de convite", () => {
  beforeEach(() => {
    mocks.auth.authenticated = false
    sessionStorage.clear()
    window.history.replaceState({}, "", "/invite")
    mocks.inspectInvite.mockResolvedValue({ invite_status: "valid", garden_name: "Jardim Família" })
    mocks.acceptInvite.mockResolvedValue({ accept_status: "accepted", garden_id: "garden-1" })
    mocks.refresh.mockResolvedValue(undefined)
  })

  afterEach(() => vi.clearAllMocks())

  it("inspeciona o token capturado e mantém o convite para login na mesma aba", async () => {
    window.history.replaceState({}, "", "/invite#token=secret-token")
    render(<MemoryRouter><InvitePage /></MemoryRouter>)

    await screen.findByText(/Jardim Família/)
    expect(mocks.inspectInvite).toHaveBeenCalledWith("secret-token")
    expect(window.location.hash).toBe("")
    expect(sessionStorage.getItem(INVITE_TOKEN_KEY)).toBe("secret-token")
    expect(screen.getByRole("link", { name: "Entrar para aceitar" })).toHaveAttribute("href", "/login")
  })

  it("aceita depois da autenticação e descarta o token", async () => {
    mocks.auth.authenticated = true
    sessionStorage.setItem(INVITE_TOKEN_KEY, "same-tab-token")
    render(<MemoryRouter><InvitePage /></MemoryRouter>)

    await userEvent.click(await screen.findByRole("button", { name: "Aceitar convite" }))
    await waitFor(() => expect(mocks.acceptInvite).toHaveBeenCalledWith("same-tab-token"))
    expect(sessionStorage.getItem(INVITE_TOKEN_KEY)).toBeNull()
    expect(mocks.preferGarden).toHaveBeenCalledWith("garden-1")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(mocks.selectGarden).toHaveBeenCalledWith("garden-1")
  })

  it("descarta token terminal e orienta a reabrir o link em outro contexto", async () => {
    mocks.inspectInvite.mockResolvedValue({ invite_status: "expired", garden_name: null })
    window.history.replaceState({}, "", "/invite#token=expired-token")
    const { unmount } = render(<MemoryRouter><InvitePage /></MemoryRouter>)

    await screen.findByText(/expirado, sido revogado ou já utilizado/)
    expect(sessionStorage.getItem(INVITE_TOKEN_KEY)).toBeNull()
    unmount()
    render(<MemoryRouter><InvitePage /></MemoryRouter>)
    expect(screen.getByText(/Abra novamente o link original/)).toBeInTheDocument()
  })
})
