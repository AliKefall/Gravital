
const parseUrls = (value: string | undefined) =>
    value
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? []

const stunFromEnv = parseUrls(import.meta.env.VITE_STUN_URLS as string | undefined)
const turnFromEnv = parseUrls(import.meta.env.VITE_TURN_URLS as string | undefined)

const fallbackStun = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]

const turnServer: RTCIceServer | null = turnFromEnv.length > 0
    ? {
        urls: turnFromEnv,
        username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
        credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    }
    : null

const stunServer: RTCIceServer = {
    urls: stunFromEnv.length > 0 ? stunFromEnv : fallbackStun,
}

export const WEBRTC_CONFIGURATION: RTCConfiguration = {
    iceServers: turnServer ? [stunServer, turnServer] : [stunServer],
    iceTransportPolicy: "all",
}

export const WEBRTC_RELAY_CONFIGURATION: RTCConfiguration = {
    iceServers: turnServer ? [turnServer, stunServer] : [stunServer],
    iceTransportPolicy: turnServer ? "relay" : "all",
}

export const hasTurnServer = () => Boolean(turnServer)
