type ManualRegisterInput = {
  firstName: string
  lastName: string
  avatarUrl: string
  email: string
  password: string
  username: string
}

type GoogleLoginInput = {
  idToken: string
  username?: string
  avatarUrl?: string
}

type UpdateMyProfileInput = {
  firstName: string
  lastName: string
  avatarUrl: string
  username: string
  email: string
}

type CreateRoomInput = {
  name: string
  description: string
}

type UpdateRoomInput = {
  name?: string
  description?: string
}

export type UserProfile = {
  uid: string
  email: string
  firstName: string
  lastName: string
  username: string
  usernameNormalized: string
  provider: "manual" | "google"
  displayName: string
  avatarUrl: string
  createdAt: string | null
  updatedAt: string | null
}

export type Room = {
  id: string
  name: string
  description: string
  creatorUid: string
  createdAt: string | null
  updatedAt: string | null
}

export type GoogleLoginResponse =
  | {
      requiresUsername: false
      isNewUser: boolean
      user: UserProfile
    }
  | {
      requiresUsername: true
      googleProfile: {
        email: string
        firstName: string
        lastName: string
        avatarUrl: string
      }
    }

type ApiErrorPayload = {
  error?: string
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "http://localhost:3000"

const postJson = async <TResponse, TBody>(path: string, body: TBody): Promise<TResponse> => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la solicitud")
  }

  return payload
}

const postJsonWithAuth = async <TResponse, TBody>(path: string, body: TBody, idToken: string): Promise<TResponse> => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la solicitud")
  }

  return payload
}

const patchJson = async <TResponse, TBody>(path: string, body: TBody, idToken: string): Promise<TResponse> => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la solicitud")
  }

  return payload
}

const deleteJsonWithAuth = async <TResponse>(path: string, idToken: string): Promise<TResponse> => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })

  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la solicitud")
  }

  return payload
}

const getJson = async <TResponse>(path: string): Promise<TResponse> => {
  const response = await fetch(`${baseUrl}/api${path}`)
  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la solicitud")
  }

  return payload
}

const getJsonWithAuth = async <TResponse>(path: string, idToken: string): Promise<TResponse> => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })

  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la solicitud")
  }

  return payload
}

export const registerManualUser = async (input: ManualRegisterInput) => {
  return postJson<{ message: string; user: UserProfile }, ManualRegisterInput>("/users/manual-register", input)
}

export const loginWithGoogleApi = async (input: GoogleLoginInput) => {
  return postJson<GoogleLoginResponse, GoogleLoginInput>("/users/google-login", input)
}

export const checkUsernameAvailability = async (username: string) => {
  return getJson<{ available: boolean }>(`/users/username/${encodeURIComponent(username)}/availability`)
}

export const getMyProfile = async (idToken: string) => {
  return getJsonWithAuth<{ user: UserProfile }>("/users/me", idToken)
}

export const updateMyProfile = async (idToken: string, input: UpdateMyProfileInput) => {
  return patchJson<{ message: string; user: UserProfile }, UpdateMyProfileInput>("/users/me", input, idToken)
}

export const deleteUserByUid = async (uid: string, idToken: string) => {
  return deleteJsonWithAuth<{ message: string }>(`/users/${encodeURIComponent(uid)}`, idToken)
}

export const getMyRooms = async (idToken: string) => {
  return getJsonWithAuth<{ rooms: Room[] }>("/rooms/mine", idToken)
}

export const createRoom = async (idToken: string, input: CreateRoomInput) => {
  return postJsonWithAuth<{ message: string; room: Room }, CreateRoomInput>("/rooms", input, idToken)
}

export const getRoomById = async (roomId: string, idToken: string) => {
  return getJsonWithAuth<{ room: Room }>(`/rooms/${encodeURIComponent(roomId)}`, idToken)
}

export const updateRoomById = async (roomId: string, idToken: string, input: UpdateRoomInput) => {
  return patchJson<{ message: string; room: Room }, UpdateRoomInput>(`/rooms/${encodeURIComponent(roomId)}`, input, idToken)
}

export const deleteRoomById = async (roomId: string, idToken: string) => {
  return deleteJsonWithAuth<{ message: string }>(`/rooms/${encodeURIComponent(roomId)}`, idToken)
}
