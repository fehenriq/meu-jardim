import { validateRedirect, validateRequestDestination } from "./environment.ts"

export async function restrictedFetch(
  input: string,
  init: RequestInit,
  fetchImplementation: typeof fetch = fetch,
) {
  const url = validateRequestDestination(input)
  const response = await fetchImplementation(url, { ...init, redirect: "manual" })
  if (response.status >= 300 && response.status < 400) {
    validateRedirect(response.headers.get("location"))
    throw new Error("REDIRECT_NOT_FOLLOWED")
  }
  return response
}
