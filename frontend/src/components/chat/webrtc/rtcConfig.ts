
const parseUrls = (value: string | undefined) =>
    value
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? []

const stunFromEnv = parseUrls(import.meta.env.VITE_STUN_URLS as string | undefined)
const turnFromEnv = parseUrls(import.meta.env.VITE_TURN_URLS as string | undefined)

const fallbackStun = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]

type RuntimeIceConfig = {
    stunUrls: string[]
    turnUrls: string[]
    turnUsername?: string
    turnCredential?: string
}

const runtimeIceConfig: RuntimeIceConfig = {
    stunUrls: stunFromEnv.length > 0 ? stunFromEnv : fallbackStun,
    turnUrls: turnFromEnv,
    turnUsername: import.meta.env.VITE_TURN_USERNAME as string | undefined,
    turnCredential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
}

const buildTurnServer = (): RTCIceServer | null => runtimeIceConfig.turnUrls.length > 0
    ? {
        urls: runtimeIceConfig.turnUrls,
        username: runtimeIceConfig.turnUsername,
        credential: runtimeIceConfig.turnCredential,
    }
    : null

const buildStunServer = (): RTCIceServer => ({ urls: runtimeIceConfig.stunUrls })

const syncConfigurations = () => {
    const turnServer = buildTurnServer()
    const stunServer = buildStunServer()
    WEBRTC_CONFIGURATION = {
        iceServers: turnServer ? [stunServer, turnServer] : [stunServer],
        iceTransportPolicy: "all",
    }

    WEBRTC_RELAY_CONFIGURATION = {
        iceServers: turnServer ? [turnServer, stunServer] : [stunServer],
        iceTransportPolicy: turnServer ? "relay" : "all",
    }
}

export let WEBRTC_CONFIGURATION: RTCConfiguration = { iceServers: [] }
export let WEBRTC_RELAY_CONFIGURATION: RTCConfiguration = { iceServers: [] }
syncConfigurations()

export const applyRuntimeIceConfig = (config: Partial<RuntimeIceConfig>) => {
    if (Array.isArray(config.stunUrls) && config.stunUrls.length > 0) {
        runtimeIceConfig.stunUrls = config.stunUrls
    }
    if (Array.isArray(config.turnUrls)) {
        runtimeIceConfig.turnUrls = config.turnUrls
    }
    if (typeof config.turnUsername === "string") {
        runtimeIceConfig.turnUsername = config.turnUsername
    }
    if (typeof config.turnCredential === "string") {
        runtimeIceConfig.turnCredential = config.turnCredential
    }
    syncConfigurations()
}

export const hasTurnServer = () => runtimeIceConfig.turnUrls.length > 0
