import { getApiBaseUrl, getWebSocketBaseUrl } from "../../api/config"
export { WEBRTC_CONFIGURATION, WEBRTC_RELAY_CONFIGURATION, applyRuntimeIceConfig, hasTurnServer } from "./webrtc/rtcConfig"

export const WS_BASE_URL = getWebSocketBaseUrl()
export const API_BASE_URL = getApiBaseUrl()


export const buildAddFriendToRoomPayload = (roomId: string, friendUsername: string) => ({
    type: "add_to_room",
    room_id: roomId,
    to: friendUsername,
})
