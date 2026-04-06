import { getApiBaseUrl } from "./config"

const API_BASE_URL = getApiBaseUrl()

type Friend = {
  username: string
  online?: boolean
}

type FriendPayload = {
  friends: Friend[]
}

export type FriendRequestPayload = {
  incoming: string[]
  outgoing: string[]
}

const FRIEND_ENDPOINTS = ["/auth/friends", "/friends"] as const

const getAuthHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
})

const parseError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as {
      message?: string
      error?: string
    }

    return payload.message ?? payload.error ?? fallback
  } catch {
    return fallback
  }
}

const normalizeFriends = (payload: unknown): FriendPayload => {
  if (Array.isArray(payload)) {
    return {
      friends: payload
        .map((item) => {
          if (typeof item === "string") {
            return { username: item }
          }

          if (item && typeof item === "object" && "username" in item) {
            const username = String((item as { username: unknown }).username)
            const onlineValue = (item as { online?: unknown }).online
            return { username, online: typeof onlineValue === "boolean" ? onlineValue : undefined }
          }

          return null
        })
        .filter((item): item is Friend => item !== null),
    }
  }

  if (!payload || typeof payload !== "object") {
    return { friends: [] }
  }

  const record = payload as Record<string, unknown>
  const friendList = record.friends ?? record.data ?? []

  if (!Array.isArray(friendList)) {
    return { friends: [] }
  }

  return normalizeFriends(friendList)
}

const requestFriends = (token: string, endpoint: string) => {
  return fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: getAuthHeaders(token),
    credentials: "include",
  })
}

export const fetchFriends = async (token: string): Promise<FriendPayload> => {
  let errorMessage = "Could not fetch friend list."

  for (const endpoint of FRIEND_ENDPOINTS) {
    const response = await requestFriends(token, endpoint)

    if (!response.ok) {
      errorMessage = await parseError(response, errorMessage)
      continue
    }

    const payload = (await response.json()) as unknown
    return normalizeFriends(payload)
  }

  throw new Error(errorMessage)
}

const addFriendRequestBodyCandidates = (username: string) => [
  { username },
  { friend_username: username },
  { friendUsername: username },
]

export const addFriend = async (
  token: string,
  username: string
): Promise<FriendPayload> => {
  let errorMessage = "Could not add friend."

  for (const endpoint of FRIEND_ENDPOINTS) {
    for (const body of addFriendRequestBodyCandidates(username)) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: getAuthHeaders(token),
        credentials: "include",
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        errorMessage = await parseError(response, errorMessage)
        continue
      }

      const payload = (await response.json()) as unknown
      return normalizeFriends(payload)
    }
  }

  throw new Error(errorMessage)
}

export const fetchFriendRequests = async (token: string): Promise<FriendRequestPayload> => {
  const response = await fetch(`${API_BASE_URL}/auth/friends/requests`, {
    method: "GET",
    headers: getAuthHeaders(token),
    credentials: "include",
  })

  if (!response.ok) {
    const message = await parseError(response, "Could not fetch friend requests.")
    throw new Error(message)
  }

  const payload = (await response.json()) as Partial<FriendRequestPayload>
  return {
    incoming: Array.isArray(payload.incoming) ? payload.incoming.map(String) : [],
    outgoing: Array.isArray(payload.outgoing) ? payload.outgoing.map(String) : [],
  }
}

const mutateFriendRequest = async (token: string, username: string, action: "accept" | "reject") => {
  const response = await fetch(`${API_BASE_URL}/auth/friends/requests/${encodeURIComponent(username)}/${action}`, {
    method: "POST",
    headers: getAuthHeaders(token),
    credentials: "include",
  })
  if (!response.ok) {
    const message = await parseError(response, `Friend request could not be ${action === "accept" ? "accepted" : "rejected"}.`)
    throw new Error(message)
  }
}

export const acceptFriendRequest = async (token: string, username: string) => {
  await mutateFriendRequest(token, username, "accept")
}

export const rejectFriendRequest = async (token: string, username: string) => {
  await mutateFriendRequest(token, username, "reject")
}
