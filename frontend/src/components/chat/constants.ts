
import { getApiBaseUrl, getWebSocketBaseUrl } from "../../api/config"

export const WS_BASE_URL = getWebSocketBaseUrl()
export const API_BASE_URL = getApiBaseUrl()

const parseUrls = (value: string | undefined) =>
    value
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? []

const buildRtcConfiguration = (): RTCConfiguration => {
    const stunFromEnv = parseUrls(import.meta.env.VITE_STUN_URLS as string | undefined)
    const turnFromEnv = parseUrls(import.meta.env.VITE_TURN_URLS as string | undefined)

    const iceServers: RTCIceServer[] = []

    const fallbackStun = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
    iceServers.push({ urls: stunFromEnv.length > 0 ? stunFromEnv : fallbackStun })

    if (turnFromEnv.length > 0) {
        iceServers.push({
            urls: turnFromEnv,
            username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
            credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
        })
    }

    return {
        iceServers,
        iceTransportPolicy: "all",
    }
}

export const WEBRTC_CONFIGURATION = buildRtcConfiguration()

export const buildAddFriendToRoomPayload = (roomId: string, friendUsername: string) => ({
    type: "add_to_room",
    room_id: roomId,
    to: friendUsername,
})
