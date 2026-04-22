
export interface ChatWorkspaceProps {
    username: string
    token: string
    onLogout: () => void
    language: "en" | "tr"
}

export interface ChatMessage {
    type: string
    room_id?: string
    from?: string
    content?: string
    to?: string
    timestamp?: string
    kind?: string
    media_url?: string
    mime_type?: string
    file_name?: string
    file_size?: number
    mic_muted?: boolean
    output_muted?: boolean

    fps?: number
    latency_ms?: number
    bitrate_kbps?: number
    packet_loss_pct?: number
    jitter_ms?: number
    available_outgoing_kbps?: number
    width?: number
    height?: number
    network_status?: "excellent" | "good" | "fair" | "degraded" | "medium" | "poor"
    audio_bitrate_kbps?: number
    quality_limitation_reason?: string
    target_bitrate_kbps?: number
    frame_drop_pct?: number
    packets_sent?: number
    retransmitted_packets_sent?: number
    encoder_implementation?: string
    avg_encode_time_ms?: number
    freeze_count?: number
    total_freezes_duration_ms?: number
    sdp?: string
    candidate?: string
    sdp_mid?: string
    sdp_mline_index?: number
    online?: boolean
}

export interface ConnectionDiagnostics {
    route: "p2p" | "turn-relay" | "unknown"
    protocol: "udp" | "tcp" | "tls" | "unknown"
    iceState: RTCIceConnectionState
    connectionState: RTCPeerConnectionState
    rttMs: number
    availableOutgoingKbps: number
    localCandidate: {
        candidateType: string
        protocol: "udp" | "tcp" | "tls" | "unknown"
        address: string
        port: number
        networkType: string
    } | null
    remoteCandidate: {
        candidateType: string
        protocol: "udp" | "tcp" | "tls" | "unknown"
        address: string
        port: number
        networkType: string
    } | null
    lastUpdatedAt: string
}
export type OutgoingPayload = Record<string, string | number | boolean>

export interface RoomsPayload {
    room_id: string
    type: "rooms"
    rooms: string[]
}

export interface HistoryPayload {
    type: "history"
    room_id: string
    messages: ChatMessage[]
}

export interface RoomMetaPayload {
    type: "room_meta"
    room_id: string
    owner_username: string
    active_users: string[]
}

export interface RoomScreenStatePayload {
    type: "screen_share_state"
    room_id: string
    active_users: string[]
}

export interface PresencePayload {
    type: "presence"
    from: string
    online: boolean
    timestamp: string
}

export interface SocialEventPayload {
    type: "social_event"
    from: string
    content: "friend_request_updated" | "friend_list_updated" | "room_membership_updated" | string
    timestamp: string
}

export interface Friend {
    username: string
    online?: boolean
}

export interface RemoteAudio {
    username: string
    stream: MediaStream
}

export interface RemoteScreen {
    username: string
    stream: MediaStream
    roomId?: string
}

export interface StreamStats {
    username: string
    roomId: string
    fps: number
    latencyMs: number
    bitrateKbps: number
    packetLossPct: number
    jitterMs: number
    availableOutgoingKbps: number
    width: number
    height: number
    networkQuality: "excellent" | "good" | "fair" | "degraded" | "poor"
    audioBitrateKbps: number
    qualityLimitationReason: string
    targetBitrateKbps: number
    frameDropPct: number
    packetsSent: number
    retransmittedPackets: number
    encoderImplementation: string
    encodeMs: number
    freezeCount: number
    totalFreezesDurationMs: number
    timestamp: string
}

export interface RoomMeta {
    owner: string
    activeUsers: string[]
}

export type ConnectionStatus = "connecting" | "online" | "reconnecting" | "offline"
