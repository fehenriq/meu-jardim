export function protectedRouteState(loading: boolean, authenticated: boolean): "loading" | "redirect" | "allow" {
  if (loading) return "loading"
  return authenticated ? "allow" : "redirect"
}
