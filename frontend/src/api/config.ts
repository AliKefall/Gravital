const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const isLocalHost = (hostname: string) => hostname === "localhost" || hostname === "127.0.0.1"

const buildApiSubdomainUrl = (location: Location): string => {
  const hostname = location.hostname
  if (hostname.startsWith("api.")) {
    return trimTrailingSlash(location.origin)
  }

  const apiHost = `api.${hostname}`
  const port = location.port ? `:${location.port}` : ""
  return `${location.protocol}//${apiHost}${port}`
}

export const getApiBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl)
  }

  if (typeof window !== "undefined") {
    if (isLocalHost(window.location.hostname)) {
      return "http://localhost:8080"
    }

    return buildApiSubdomainUrl(window.location)
  }

  return "http://localhost:8080"
}

export const getWebSocketBaseUrl = (): string => {
  const configuredWebSocketUrl = import.meta.env.VITE_WS_BASE_URL
  if (configuredWebSocketUrl) {
    return trimTrailingSlash(configuredWebSocketUrl)
  }

  const apiBaseUrl = getApiBaseUrl()
  const parsed = new URL(apiBaseUrl)
  parsed.protocol = parsed.protocol === "https:" ? "wss" : "ws"
  parsed.pathname = "/ws"
  parsed.search = ""
  parsed.hash = ""
  return trimTrailingSlash(parsed.toString())
}
