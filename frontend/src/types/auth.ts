export type RegisterRequest = {
  email: string
  username: string
  password: string
}

export type RegisterResponse = {
  user_id: string
  username: string
  email: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  user: AuthUser
}

export type ApiError = {
  error?: string
  message?: string
  messasge?: string
}


export type AuthUser = {
  user_id: string
  username: string
  email?: string
}


export type ForgotPasswordRequest = {
  email: string
}

export type ResetPasswordRequest = {
  email: string
  code: string
  new_password: string
}

export type SocialProvidersResponse = {
  google?: string
  github?: string
}
