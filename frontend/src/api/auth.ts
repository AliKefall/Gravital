import { getApiBaseUrl } from "./config"
import type {
  ApiError,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  SocialProvidersResponse,
} from "../types/auth"




const API_BASE_URL = getApiBaseUrl()

const getErrorMessage = (payload: ApiError, fallback: string): string => {
  return payload.message ?? payload.messasge ?? payload.error ?? fallback
}

const parseResponseError = async (response: Response, fallback: string): Promise<never> => {
  let payload: ApiError = {}
  try {
    payload = (await response.json()) as ApiError
  } catch {
    payload = {}
  }

  throw new Error(getErrorMessage(payload, fallback))
}

const postJSON = async <TResponse>(
  path: string,
  body: unknown,
  fallbackError: string,
): Promise<TResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  })

  if (!response.ok) {

    return parseResponseError(response, fallbackError)
  }

  return (await response.json()) as TResponse
}

const postWithoutBody = async <TResponse>(path: string, fallbackError: string): Promise<TResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    return parseResponseError(response, fallbackError)
  }

  return (await response.json()) as TResponse
}

export const registerUser = async (input: RegisterRequest): Promise<RegisterResponse> => {
  return postJSON<RegisterResponse>("/auth/register", input, "Registration failed. Please try again.")
}

export const loginUser = async (input: LoginRequest): Promise<LoginResponse> => {
  return postJSON<LoginResponse>("/auth/login", input, "Login failed. Please try again.")
}

export const refreshSession = async (): Promise<{ access_token: string }> => {
  return postWithoutBody<{ access_token: string }>("/auth/refresh", "Session refresh failed")
}

export const fetchCurrentUser = async (token: string): Promise<AuthUser> => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    return parseResponseError(response, "Could not fetch account")
  }

  return (await response.json()) as AuthUser
}

export const logoutUser = async (token: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    await parseResponseError(response, "Logout failed")
  }
}

export const requestPasswordReset = async (input: ForgotPasswordRequest): Promise<{ message: string }> => {
  return postJSON<{ message: string }>("/auth/forgot-password", input, "Password reset request failed.")
}

export const resetPasswordWithCode = async (input: ResetPasswordRequest): Promise<{ message: string }> => {
  return postJSON<{ message: string }>("/auth/reset-password", input, "Password reset failed.")
}

export const fetchSocialProviders = async (): Promise<SocialProvidersResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/providers`, {
    method: "GET",
    credentials: "include",
  })

  if (!response.ok) {
    return parseResponseError(response, "Could not load social providers")
  }

  return (await response.json()) as SocialProvidersResponse
}
