
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { logoutUser } from "../../api/auth"
import { acceptFriendRequest, addFriend, fetchFriendRequests, fetchFriends, rejectFriendRequest } from "../../api/friends"
import { API_BASE_URL, WEBRTC_CONFIGURATION, WEBRTC_RELAY_CONFIGURATION, WS_BASE_URL, applyRuntimeIceConfig, buildAddFriendToRoomPayload, hasTurnServer } from "./constants"
import type {
    ChatMessage,
    ChatWorkspaceProps,
    ConnectionStatus,
    Friend,
    HistoryPayload,
    OutgoingPayload,
    PresencePayload,
    SocialEventPayload,
    RemoteAudio,
    RemoteScreen,
    RoomMeta,
    RoomMetaPayload,
    RoomsPayload,
    RoomScreenStatePayload,
    StreamStats,
    ConnectionDiagnostics,
} from "./types"
import { NETWORK_PROFILE_ORDER, VIDEO_PROFILE_SETTINGS, type NetworkProfile, type VideoMode } from "./webrtc/videoProfiles"
import { AUDIO_CONSTRAINTS, CAMERA_SHARE_CONSTRAINTS, SCREEN_SHARE_CONSTRAINTS, VIDEO_TRACK_HINT } from "./webrtc/mediaConstraints"
import { extractDiagnosticsFromRtcStats } from "./webrtc/connectionDiagnostics"

export const useWorkspaceController = ({ username, token, onLogout }: ChatWorkspaceProps) => {
    const wsRef = useRef<WebSocket | null>(null)
    const messageListRef = useRef<HTMLDivElement | null>(null)

    const [rooms, setRooms] = useState<string[]>([])
    const [activeRoom, setActiveRoom] = useState("")
    const [newRoom, setNewRoom] = useState("")
    const [friends, setFriends] = useState<Friend[]>([])
    const [activeDirectFriend, setActiveDirectFriend] = useState("")
    const [newFriend, setNewFriend] = useState("")
    const [pendingIncomingRequests, setPendingIncomingRequests] = useState<string[]>([])
    const [pendingOutgoingRequests, setPendingOutgoingRequests] = useState<string[]>([])
    const [unreadCountByRoom, setUnreadCountByRoom] = useState<Record<string, number>>({})
    const [messageText, setMessageText] = useState("")
    const [selectedFriendForRoom, setSelectedFriendForRoom] = useState("")
    const [voiceConnected, setVoiceConnected] = useState(false)
    const [micMuted, setMicMuted] = useState(false)
    const [outputMuted, setOutputMuted] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [screenSharing, setScreenSharing] = useState(false)
    const [cameraSharing, setCameraSharing] = useState(false)
    const [remoteScreens, setRemoteScreens] = useState<RemoteScreen[]>([])
    const [localPreviewScreen, setLocalPreviewScreen] = useState<RemoteScreen | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [status, setStatus] = useState<ConnectionStatus>("connecting")
    const [roomMeta, setRoomMeta] = useState<Record<string, RoomMeta>>({})
    const [remoteAudios, setRemoteAudios] = useState<RemoteAudio[]>([])
    const [screenSharersByRoom, setScreenSharersByRoom] = useState<Record<string, string[]>>({})
    const [selectedScreenUser, setSelectedScreenUser] = useState<string | null>(null)
    const [streamStatsByUser, setStreamStatsByUser] = useState<Record<string, StreamStats>>({})
    const [connectionDiagnosticsByUser, setConnectionDiagnosticsByUser] = useState<Record<string, ConnectionDiagnostics>>({})
    const [outputVolume, setOutputVolume] = useState(100)
    const [micVolume, setMicVolume] = useState(100)
    const [noiseGateDb, setNoiseGateDb] = useState(-55)
    const screenShareAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const processedLocalStreamRef = useRef<MediaStream | null>(null)
    const localAudioContextRef = useRef<AudioContext | null>(null)
    const localGainNodeRef = useRef<GainNode | null>(null)
    const [isJoiningVoice, setIsJoiningVoice] = useState(false)
    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const peerDisconnectTimeoutsRef = useRef<Map<string, number>>(new Map())
    const joinedRoomsRef = useRef(new Set<string>())
    const streamMetricsIntervalRef = useRef<number | null>(null)
    const reconnectTimeoutRef = useRef<number | null>(null)
    const keepAliveIntervalRef = useRef<number | null>(null)
    const reconnectAttemptRef = useRef(0)
    const peerNetworkProfileRef = useRef<Map<string, NetworkProfile>>(new Map())
    const outboundBitrateWindowRef = useRef<Map<string, { bytesSent: number, timestampMs: number }>>(new Map())
    const outboundAudioBitrateWindowRef = useRef<Map<string, { bytesSent: number, timestampMs: number }>>(new Map())
    const smoothedVideoBitrateRef = useRef<Map<string, number>>(new Map())
    const smoothedFpsRef = useRef<Map<string, number>>(new Map())
    const activeVideoModeRef = useRef<VideoMode>("screen")
    const activeRoomRef = useRef(activeRoom)
    const voiceConnectedRef = useRef(voiceConnected)
    const currentMessageContextRef = useRef({ activeRoom: "", activeDirectFriend: "" })
    const peerProfileStabilityRef = useRef<Map<string, { candidate: NetworkProfile, hits: number }>>(new Map())


    useEffect(() => {
        voiceConnectedRef.current = voiceConnected
    }, [voiceConnected])

    useEffect(() => {
        currentMessageContextRef.current = { activeRoom, activeDirectFriend }
    }, [activeRoom, activeDirectFriend])

    useEffect(() => {
        const controller = new AbortController()
        void (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/webrtc/config`, { signal: controller.signal })
                if (!response.ok) return
                const payload = await response.json() as {
                    stun_urls?: string[]
                    turn_urls?: string[]
                    turn_username?: string
                    turn_credential?: string
                }
                applyRuntimeIceConfig({
                    stunUrls: payload.stun_urls,
                    turnUrls: payload.turn_urls,
                    turnUsername: payload.turn_username,
                    turnCredential: payload.turn_credential,
                })
            } catch {
                // keep env-based defaults
            }
        })()
        return () => controller.abort()
    }, [])

    const cleanupVoiceConnections = () => {
        if (streamMetricsIntervalRef.current) {
            window.clearInterval(streamMetricsIntervalRef.current)
            streamMetricsIntervalRef.current = null
        }
        peerConnectionsRef.current.forEach((peer) => peer.close())
        peerConnectionsRef.current.clear()
        pendingCandidatesRef.current.clear()
        localStreamRef.current?.getTracks().forEach((track) => track.stop())
        processedLocalStreamRef.current?.getTracks().forEach((track) => track.stop())
        localAudioContextRef.current?.close().catch(() => undefined)
        localAudioContextRef.current = null
        localGainNodeRef.current = null
        screenShareAudioSourceRef.current = null
        processedLocalStreamRef.current = null

        peerDisconnectTimeoutsRef.current.forEach((timerID) => window.clearTimeout(timerID))
        peerDisconnectTimeoutsRef.current.clear()
        screenStreamRef.current?.getTracks().forEach((track) => track.stop())
        screenStreamRef.current = null
        localStreamRef.current = null
        setScreenSharing(false)
        setCameraSharing(false)
        setRemoteAudios([])
        setRemoteScreens([])
        setLocalPreviewScreen(null)
        setConnectionDiagnosticsByUser({})
        setStreamStatsByUser({})
        setConnectionDiagnosticsByUser({})
        outboundBitrateWindowRef.current.clear()
        outboundAudioBitrateWindowRef.current.clear()
        smoothedVideoBitrateRef.current.clear()
        smoothedFpsRef.current.clear()
        peerNetworkProfileRef.current.clear()
        peerProfileStabilityRef.current.clear()
        setSelectedScreenUser(null)
        setIsJoiningVoice(false)
    }

    const sendRealtimeLeaveSignals = (roomId: string) => {
        if (!roomId) return
        if (screenStreamRef.current) {
            send({ type: "screen_share_stop", room_id: roomId, timestamp: new Date().toISOString() })
        }
        if (voiceConnectedRef.current) {
            send({ type: "voice_leave", room_id: roomId, timestamp: new Date().toISOString() })
        }
    }

    const queueCandidate = (remoteUser: string, candidate: RTCIceCandidateInit) => {
        const existing = pendingCandidatesRef.current.get(remoteUser) ?? []
        pendingCandidatesRef.current.set(remoteUser, [...existing, candidate])
    }

    const flushPendingCandidates = async (remoteUser: string, peer: RTCPeerConnection) => {
        const pending = pendingCandidatesRef.current.get(remoteUser) ?? []
        if (pending.length === 0) return
        for (const candidate of pending) {
            await peer.addIceCandidate(candidate)
        }
        pendingCandidatesRef.current.delete(remoteUser)
    }

    const publishLocalStreamMetrics = () => {
        if (!activeRoomRef.current) return
        peerConnectionsRef.current.forEach((peer, remoteUser) => {
            peer.getStats().then((stats) => {
                let outboundVideo: Record<string, unknown> | undefined
                let outboundAudio: Record<string, unknown> | undefined
                let candidatePair: Record<string, unknown> | undefined
                let remoteInboundVideo: Record<string, unknown> | undefined
                let mediaSourceVideo: Record<string, unknown> | undefined
                stats.forEach((item) => {
                    const typedItem = item as unknown as Record<string, unknown>
                    if (typedItem.type === "outbound-rtp" && typedItem.kind === "video") outboundVideo = typedItem
                    if (typedItem.type === "outbound-rtp" && typedItem.kind === "audio") outboundAudio = typedItem
                    if (typedItem.type === "candidate-pair" && typedItem.state === "succeeded" && typeof typedItem.currentRoundTripTime === "number") candidatePair = typedItem
                    if (typedItem.type === "remote-inbound-rtp" && typedItem.kind === "video") remoteInboundVideo = typedItem
                    if (typedItem.type === "media-source" && typedItem.kind === "video") mediaSourceVideo = typedItem
                })
                const diagnostics = extractDiagnosticsFromRtcStats(stats, peer)
                setConnectionDiagnosticsByUser((prev) => ({ ...prev, [remoteUser]: diagnostics }))
                if (!outboundVideo) return
                const instantaneousFps = Number(outboundVideo.framesPerSecond ?? mediaSourceVideo?.framesPerSecond ?? 0)
                const previousFps = smoothedFpsRef.current.get(remoteUser) ?? instantaneousFps
                const fps = previousFps > 0 ? (previousFps * 0.7) + (instantaneousFps * 0.3) : instantaneousFps
                smoothedFpsRef.current.set(remoteUser, fps)
                const currentBytesSent = Number(outboundVideo.bytesSent ?? 0)
                const currentTimestampMs = Number(outboundVideo.timestamp ?? Date.now())
                const previousSnapshot = outboundBitrateWindowRef.current.get(remoteUser)
                let bitrateKbps = 0
                if (previousSnapshot) {
                    const bytesDelta = Math.max(0, currentBytesSent - previousSnapshot.bytesSent)
                    const elapsedMs = Math.max(1, currentTimestampMs - previousSnapshot.timestampMs)
                    bitrateKbps = (bytesDelta * 8) / elapsedMs
                }
                const previousSmoothedBitrate = smoothedVideoBitrateRef.current.get(remoteUser) ?? bitrateKbps
                const smoothedBitrateKbps = previousSmoothedBitrate > 0 ? (previousSmoothedBitrate * 0.75) + (bitrateKbps * 0.25) : bitrateKbps
                smoothedVideoBitrateRef.current.set(remoteUser, smoothedBitrateKbps)
                outboundBitrateWindowRef.current.set(remoteUser, { bytesSent: currentBytesSent, timestampMs: currentTimestampMs })
                const currentAudioBytesSent = Number(outboundAudio?.bytesSent ?? 0)
                const currentAudioTimestampMs = Number(outboundAudio?.timestamp ?? Date.now())
                const previousAudioSnapshot = outboundAudioBitrateWindowRef.current.get(remoteUser)
                let audioBitrateKbps = 0
                if (previousAudioSnapshot) {
                    const bytesDelta = Math.max(0, currentAudioBytesSent - previousAudioSnapshot.bytesSent)
                    const elapsedMs = Math.max(1, currentAudioTimestampMs - previousAudioSnapshot.timestampMs)
                    audioBitrateKbps = (bytesDelta * 8) / elapsedMs
                }
                outboundAudioBitrateWindowRef.current.set(remoteUser, { bytesSent: currentAudioBytesSent, timestampMs: currentAudioTimestampMs })
                const latencyMs = Math.round(Number(candidatePair?.currentRoundTripTime ?? 0) * 1000)
                const packetLossPct = Number(remoteInboundVideo?.fractionLost ?? 0) * 100
                const jitterMs = Number(remoteInboundVideo?.jitter ?? 0) * 1000
                const availableOutgoingKbps = Number(candidatePair?.availableOutgoingBitrate ?? 0) / 1000
                const outboundTrack = peer.getSenders().find((sender) => sender.track?.kind === "video")?.track
                const outboundTrackSettings = outboundTrack?.getSettings?.()
                const width = Number(outboundVideo.frameWidth ?? mediaSourceVideo?.width ?? outboundTrackSettings?.width ?? 0)
                const height = Number(outboundVideo.frameHeight ?? mediaSourceVideo?.height ?? outboundTrackSettings?.height ?? 0)
                const qualityLimitationReason = String(outboundVideo.qualityLimitationReason ?? "none")
                const targetBitrateKbps = Number(outboundVideo.targetBitrate ?? 0) / 1000
                const framesEncoded = Number(outboundVideo.framesEncoded ?? 0)
                const framesSent = Number(outboundVideo.framesSent ?? 0)
                const frameDropPct = framesEncoded > 0 ? Math.max(0, ((framesEncoded - framesSent) / framesEncoded) * 100) : 0
                const packetsSent = Number(outboundVideo.packetsSent ?? 0)
                const retransmittedPackets = Number(outboundVideo.retransmittedPacketsSent ?? 0)
                const encoderImplementation = String(outboundVideo.encoderImplementation ?? "unknown")
                const encodeMs = Number(outboundVideo.totalEncodeTime ?? 0) > 0 && framesEncoded > 0
                    ? (Number(outboundVideo.totalEncodeTime ?? 0) / Math.max(1, framesEncoded)) * 1000
                    : 0
                const freezeCount = Number(remoteInboundVideo?.freezeCount ?? 0)
                const totalFreezesDurationMs = Number(remoteInboundVideo?.totalFreezesDuration ?? 0) * 1000
                const quality = classifyNetworkQuality(latencyMs, fps, packetLossPct, smoothedBitrateKbps)
                send({
                    type: "stream_metrics",
                    room_id: activeRoomRef.current,
                    to: remoteUser,
                    fps: Number(fps.toFixed(1)),
                    latency_ms: latencyMs,
                    bitrate_kbps: Number(smoothedBitrateKbps.toFixed(1)),
                    packet_loss_pct: Number(packetLossPct.toFixed(1)),
                    jitter_ms: Number(jitterMs.toFixed(1)),
                    available_outgoing_kbps: Number(availableOutgoingKbps.toFixed(1)),
                    width,
                    height,
                    audio_bitrate_kbps: Number(audioBitrateKbps.toFixed(1)),
                    quality_limitation_reason: qualityLimitationReason,
                    target_bitrate_kbps: Number(targetBitrateKbps.toFixed(1)),
                    frame_drop_pct: Number(frameDropPct.toFixed(1)),
                    packets_sent: packetsSent,
                    retransmitted_packets_sent: retransmittedPackets,
                    encoder_implementation: encoderImplementation,
                    avg_encode_time_ms: Number(encodeMs.toFixed(2)),
                    freeze_count: freezeCount,
                    total_freezes_duration_ms: Number(totalFreezesDurationMs.toFixed(1)),
                    network_status: quality,
                    timestamp: new Date().toISOString(),
                })
                const profile = quality
                adaptVideoSenderForNetwork(peer, remoteUser, profile)
            }).catch(() => undefined)



        })
    }

    const ensureMetricsLoop = () => {
        if (streamMetricsIntervalRef.current) return
        streamMetricsIntervalRef.current = window.setInterval(() => {
            publishLocalStreamMetrics()
        }, 2000)
    }

    const classifyNetworkQuality = (latencyMs: number, fps: number, packetLossPct: number, bitrateKbps: number) => {

        if (latencyMs <= 180 && fps >= 24 && packetLossPct < 2.5 && bitrateKbps >= 650) return "good"
        if (latencyMs <= 380 && fps >= 8 && packetLossPct < 8) return "medium"
        if (bitrateKbps >= 550 && packetLossPct < 5) return "medium"
        return "poor"
    }

    const tunePeerSender = (peer: RTCPeerConnection, kind: "audio" | "video", profile: NetworkProfile = "medium") => {
        for (const sender of peer.getSenders()) {
            if (sender.track?.kind !== kind) continue
            const parameters = sender.getParameters()
            parameters.encodings = parameters.encodings ?? [{}]
            if (kind === "video") {
                const videoProfile = VIDEO_PROFILE_SETTINGS[activeVideoModeRef.current][profile]
                parameters.encodings[0].maxBitrate = videoProfile.maxBitrate
                parameters.encodings[0].maxFramerate = videoProfile.maxFramerate
                parameters.encodings[0].scaleResolutionDownBy = videoProfile.scaleResolutionDownBy
                parameters.degradationPreference = videoProfile.degradationPreference
                parameters.encodings[0].priority = profile === "poor" ? "low" : "medium"
            } else {
                parameters.encodings[0].maxBitrate = profile === "poor" ? 96_000 : profile === "good" ? 160_000 : 128_000
                parameters.encodings[0].priority = "high"
            }
            void sender.setParameters(parameters).catch(() => undefined)
        }
    }

    const adaptVideoSenderForNetwork = (peer: RTCPeerConnection, remoteUser: string, profile: NetworkProfile) => {
        const currentProfile = peerNetworkProfileRef.current.get(remoteUser)

        if (!currentProfile) {
            peerNetworkProfileRef.current.set(remoteUser, profile)
            tunePeerSender(peer, "video", profile)
            tunePeerSender(peer, "audio", profile)
            return
        }
        if (currentProfile === profile) {
            peerProfileStabilityRef.current.delete(remoteUser)
            return
        }

        const previousCandidate = peerProfileStabilityRef.current.get(remoteUser)
        const stableCandidate = previousCandidate?.candidate === profile
            ? { candidate: profile, hits: previousCandidate.hits + 1 }
            : { candidate: profile, hits: 1 }
        peerProfileStabilityRef.current.set(remoteUser, stableCandidate)

        const currentOrder = NETWORK_PROFILE_ORDER.indexOf(currentProfile)
        const nextOrder = NETWORK_PROFILE_ORDER.indexOf(profile)
        const isDowngrade = nextOrder < currentOrder
        const requiredHits = isDowngrade ? 4 : 3
        if (stableCandidate.hits < requiredHits) return

        peerNetworkProfileRef.current.set(remoteUser, profile)
        peerProfileStabilityRef.current.delete(remoteUser)
        tunePeerSender(peer, "video", profile)
        tunePeerSender(peer, "audio", profile)
    }
    const ensureLocalAudioStream = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Your browser does not support voice chat")
        }
        if (localStreamRef.current) return localStreamRef.current

        const stream = await navigator.mediaDevices.getUserMedia({

            audio: AUDIO_CONSTRAINTS,
            video: false,
        })

        localStreamRef.current = stream
        return stream
    }


    const ensureOutgoingAudioStream = async () => {
        const localStream = await ensureLocalAudioStream()
        if (!window.AudioContext) return localStream
        if (processedLocalStreamRef.current) return processedLocalStreamRef.current

        if (localStream.getAudioTracks().length === 0) {
            throw new Error("No audio tracks in microphone stream")
        }

        const audioContext = new window.AudioContext()
        let source: MediaStreamAudioSourceNode
        try {
            source = audioContext.createMediaStreamSource(localStream)
        } catch {
            void audioContext.close().catch(() => undefined)
            return localStream
        }
        const gainNode = audioContext.createGain()
        const highPass = audioContext.createBiquadFilter()
        highPass.type = "highpass"
        highPass.frequency.value = 120
        const compressor = audioContext.createDynamicsCompressor()
        compressor.threshold.value = -30
        compressor.knee.value = 30
        compressor.ratio.value = 8
        compressor.attack.value = 0.003
        compressor.release.value = 0.25
        gainNode.gain.value = micVolume / 100
        const destination = audioContext.createMediaStreamDestination()
        source.connect(highPass)
        highPass.connect(compressor)
        compressor.connect(gainNode)
        gainNode.connect(destination)
        localAudioContextRef.current = audioContext
        localGainNodeRef.current = gainNode
        processedLocalStreamRef.current = destination.stream
        return destination.stream
    }

    const detachScreenShareAudioFromMix = () => {
        if (!screenShareAudioSourceRef.current) return
        screenShareAudioSourceRef.current.disconnect()
        screenShareAudioSourceRef.current = null
    }

    const attachScreenShareAudioToMix = async (stream: MediaStream) => {
        if (stream.getAudioTracks().length === 0) {
            detachScreenShareAudioFromMix()
            return
        }
        await ensureOutgoingAudioStream()
        const audioContext = localAudioContextRef.current
        const gainNode = localGainNodeRef.current
        if (!audioContext || !gainNode) return
        detachScreenShareAudioFromMix()
        let screenShareSource: MediaStreamAudioSourceNode
        try {
            screenShareSource = audioContext.createMediaStreamSource(stream)
        } catch {
            detachScreenShareAudioFromMix()
            return
        }
        screenShareSource.connect(gainNode)
        screenShareAudioSourceRef.current = screenShareSource
    }

    const upsertRemoteAudio = (remoteUser: string, stream: MediaStream) => {
        setRemoteAudios((prev) => [...prev.filter((item) => item.username !== remoteUser), { username: remoteUser, stream }])
    }

    const upsertRemoteScreen = (remoteUser: string, stream: MediaStream) => {
        setRemoteScreens((prev) => [...prev.filter((item) => item.username !== remoteUser), { username: remoteUser, stream }])
    }

    const removeRemoteAudio = (remoteUser: string) => {
        setRemoteAudios((prev) => prev.filter((audio) => audio.username !== remoteUser))
    }

    const removeRemoteScreen = (remoteUser: string) => {
        setRemoteScreens((prev) => prev.filter((screen) => screen.username !== remoteUser))
    }

    const clearPeerDisconnectTimer = (remoteUser: string) => {
        const timerID = peerDisconnectTimeoutsRef.current.get(remoteUser)
        if (!timerID) return
        window.clearTimeout(timerID)
        peerDisconnectTimeoutsRef.current.delete(remoteUser)
    }

    const updateScreenSharers = (roomId: string, updater: (current: string[]) => string[]) => {
        setScreenSharersByRoom((prev) => {
            const current = prev[roomId] ?? []
            return {
                ...prev,
                [roomId]: Array.from(new Set(updater(current))),
            }
        })
    }

    const send = (payload: OutgoingPayload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        wsRef.current.send(JSON.stringify(payload))
    }

    const refreshFriendsAndRequests = async () => {
        const [latestFriends, requests] = await Promise.all([fetchFriends(token), fetchFriendRequests(token)])
        setFriends(latestFriends.friends)
        setPendingIncomingRequests(requests.incoming)
        setPendingOutgoingRequests(requests.outgoing)
    }

    const renegotiateWith = async (remoteUser: string, roomId: string) => {
        const peer = peerConnectionsRef.current.get(remoteUser)
        if (!peer) return
        if (peer.signalingState !== "stable") return
        const shouldForceIceRestart = ["failed", "disconnected"].includes(peer.iceConnectionState)
        const offer = await peer.createOffer(shouldForceIceRestart ? { iceRestart: true } : undefined)
        await peer.setLocalDescription(offer)
        send({
            type: "webrtc_offer",
            room_id: roomId,
            to: remoteUser,
            sdp: offer.sdp ?? "",
            timestamp: new Date().toISOString(),
        })
    }

    const ensurePeerConnection = async (remoteUser: string, roomId: string, options?: { preferRelay?: boolean }) => {
        const existing = peerConnectionsRef.current.get(remoteUser)
        if (existing) return existing


        const shouldPreferRelay = Boolean(options?.preferRelay && hasTurnServer())
        const peer = new RTCPeerConnection(shouldPreferRelay ? WEBRTC_RELAY_CONFIGURATION : WEBRTC_CONFIGURATION)

        peerConnectionsRef.current.set(remoteUser, peer)

        const localStream = await ensureOutgoingAudioStream()
        localStream.getTracks().forEach((track) => peer.addTrack(track, localStream))
        tunePeerSender(peer, "audio", "medium")
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => peer.addTrack(track, screenStreamRef.current as MediaStream))
            tunePeerSender(peer, "video", "medium")
        }

        peer.onicecandidate = (event) => {
            if (!event.candidate || !roomId) return
            send({
                type: "webrtc_ice_candidate",
                room_id: roomId,
                to: remoteUser,
                candidate: event.candidate.candidate,
                sdp_mid: event.candidate.sdpMid ?? "",
                sdp_mline_index: event.candidate.sdpMLineIndex ?? 0,
                timestamp: new Date().toISOString(),
            })
        }

        peer.ontrack = (event) => {

            const [firstStream] = event.streams
            const stream = firstStream ?? new MediaStream([event.track])

            if (event.track.kind === "video") {
                upsertRemoteScreen(remoteUser, stream)
            } else {
                upsertRemoteAudio(remoteUser, stream)
            }
        }


        peer.onconnectionstatechange = () => {
            if (peer.connectionState === "connected") {
                clearPeerDisconnectTimer(remoteUser)
                return
            }
            if (peer.connectionState === "disconnected") {
                if (peerDisconnectTimeoutsRef.current.has(remoteUser)) return
                const timeoutID = window.setTimeout(() => {
                    const latestPeer = peerConnectionsRef.current.get(remoteUser)
                    if (!latestPeer) return
                    if (latestPeer.connectionState === "disconnected" || latestPeer.connectionState === "failed") {
                        latestPeer.close()
                        peerConnectionsRef.current.delete(remoteUser)
                        clearPeerDisconnectTimer(remoteUser)
                        removeRemoteAudio(remoteUser)
                        removeRemoteScreen(remoteUser)
                    }
                }, 25_000)
                peerDisconnectTimeoutsRef.current.set(remoteUser, timeoutID)
                return
            }
            if (["failed", "closed"].includes(peer.connectionState)) {
                clearPeerDisconnectTimer(remoteUser)
                peer.close()
                peerConnectionsRef.current.delete(remoteUser)
                removeRemoteAudio(remoteUser)
                removeRemoteScreen(remoteUser)
            }
        }




        let attemptedIceRestart = false
        let attemptedRelayFallback = shouldPreferRelay
        peer.oniceconnectionstatechange = () => {
            if (!roomId || !["failed", "disconnected"].includes(peer.iceConnectionState)) return
            if (!attemptedIceRestart) {
                attemptedIceRestart = true
                try {
                    peer.restartIce()
                } catch {
                    return
                }
                if (shouldInitiateOffer(username, remoteUser)) {
                    void renegotiateWith(remoteUser, roomId)
                }
                return
            }
            if (!attemptedRelayFallback && hasTurnServer() && !shouldPreferRelay) {
                attemptedRelayFallback = true
                peer.close()
                peerConnectionsRef.current.delete(remoteUser)
                void connectVoicePeerWithRetry(remoteUser, roomId).catch(() => undefined)
            }
        }


        await flushPendingCandidates(remoteUser, peer)
        return peer
    }



    useEffect(() => {
        let isMounted = true
        let manualClose = false

        const clearReconnectTimer = () => {
            if (reconnectTimeoutRef.current !== null) {
                window.clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
        }

        const scheduleReconnect = () => {
            if (!isMounted || manualClose) return
            const attempt = reconnectAttemptRef.current
            const baseDelay = Math.min(30000, 1000 * (2 ** attempt))
            const jitter = Math.floor(baseDelay * (0.2 * Math.random()))
            const delay = baseDelay + jitter
            reconnectAttemptRef.current = attempt + 1

            setStatus("reconnecting")
            setMessages((prev) => [...prev, { type: "system", content: `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s.` }])
            clearReconnectTimer()
            reconnectTimeoutRef.current = window.setTimeout(() => {
                connectWebSocket()
            }, delay)
        }

        const connectWebSocket = () => {
            if (!isMounted || manualClose) return
            const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`)

            ws.onopen = () => {
                reconnectAttemptRef.current = 0
                clearReconnectTimer()
                setStatus("online")
                setMessages((prev) => [...prev, { type: "system", content: "Connection established." }])
            }

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as ChatMessage | RoomsPayload | HistoryPayload | RoomMetaPayload | RoomScreenStatePayload | PresencePayload | SocialEventPayload

                    if (payload.type === "rooms") {
                        const data = payload as RoomsPayload
                        setRooms(data.rooms)
                        setActiveRoom((prev) => prev || data.rooms[0] || "")
                        joinedRoomsRef.current = new Set(data.rooms)
                        setRoomMeta((prev) => Object.fromEntries(Object.entries(prev).filter(([roomId]) => data.rooms.includes(roomId))))
                        setScreenSharersByRoom((prev) => Object.fromEntries(Object.entries(prev).filter(([roomId]) => data.rooms.includes(roomId))))
                        return
                    }

                    if (payload.type === "room_meta") {
                        const details = payload as RoomMetaPayload
                        setRoomMeta((prev) => ({ ...prev, [details.room_id]: { owner: details.owner_username, activeUsers: details.active_users } }))
                        return
                    }

                    if (payload.type === "history") {
                        const historyPayload = payload as HistoryPayload
                        setRooms((prev) => (prev.includes(historyPayload.room_id) ? prev : [...prev, historyPayload.room_id]))
                        setMessages((prev) => [...prev, ...historyPayload.messages])
                        return
                    }

                    if (payload.type === "screen_share_state") {
                        const state = payload as RoomScreenStatePayload
                        setScreenSharersByRoom((prev) => ({ ...prev, [state.room_id]: Array.from(new Set(state.active_users ?? [])) }))
                        if (voiceConnectedRef.current && state.room_id === activeRoomRef.current) {
                            const missingPeers = (state.active_users ?? []).filter((member) => member !== username && !peerConnectionsRef.current.has(member))
                            missingPeers.forEach((member) => {
                                void connectVoicePeerWithRetry(member, state.room_id).catch(() => undefined)
                            })
                        }
                        return
                    }

                    if (payload.type === "presence" && payload.from && typeof payload.online === "boolean") {
                        setFriends((prev) => prev.map((friend) => (
                            friend.username === payload.from ? { ...friend, online: payload.online } : friend
                        )))
                        return
                    }

                    if (payload.type === "social_event") {
                        const eventPayload = payload as SocialEventPayload
                        if (["friend_request_updated", "friend_list_updated", "room_membership_updated"].includes(eventPayload.content)) {
                            void refreshFriendsAndRequests().catch(() => undefined)
                        }
                        return
                    }

                    if (payload.type === "voice_join" && voiceConnectedRef.current && payload.from && payload.from !== username && payload.room_id === activeRoomRef.current) {
                        void (async () => {
                            try {
                                await connectVoicePeerWithRetry(payload.from as string, payload.room_id as string)
                            } catch {
                                setMessages((prev) => [...prev, { type: "system", room_id: payload.room_id, content: "Failed to start WebRTC connection." }])
                            }
                        })()
                    }

                    if (payload.type === "voice_leave" && payload.from && payload.from !== username) {
                        const peer = peerConnectionsRef.current.get(payload.from)
                        if (peer) {
                            clearPeerDisconnectTimer(payload.from)
                            peer.close()
                            peerConnectionsRef.current.delete(payload.from)
                            removeRemoteAudio(payload.from)
                            removeRemoteScreen(payload.from)
                            setStreamStatsByUser((prev) => {
                                const next = { ...prev }
                                delete next[payload.from as string]
                                return next
                            })

                            setConnectionDiagnosticsByUser((prev) => {
                                const next = { ...prev }
                                delete next[payload.from as string]
                                return next
                            })
                        }
                    }

                    if (payload.type === "voice_join" || payload.type === "voice_leave") {
                        const note = payload.type === "voice_join" ? "joined voice chat" : "left voice chat"
                        setMessages((prev) => [...prev, { type: "system", room_id: payload.room_id, content: `@${payload.from} ${note}` }])
                        return
                    }

                    if (payload.type === "voice_state") {
                        return
                    }

                    if (payload.type === "webrtc_offer") {
                        if (!voiceConnectedRef.current || payload.from === username || payload.to !== username || !payload.from || !payload.room_id || !payload.sdp) return
                        const from = payload.from
                        const roomID = payload.room_id
                        const sdp = payload.sdp
                        void (async () => {
                            try {
                                const peer = await ensurePeerConnection(from, roomID)
                                if (peer.signalingState !== "stable") {
                                    try {
                                        await peer.setLocalDescription({ type: "rollback" })
                                    } catch {
                                        return
                                    }
                                }
                                await peer.setRemoteDescription({ type: "offer", sdp })
                                await flushPendingCandidates(from, peer)
                                const answer = await peer.createAnswer()
                                await peer.setLocalDescription(answer)
                                send({ type: "webrtc_answer", room_id: roomID, to: from, sdp: answer.sdp ?? "", timestamp: new Date().toISOString() })
                            } catch {
                                setMessages((prev) => [...prev, { type: "system", room_id: roomID, content: "WebRTC offer islenemedi." }])
                            }
                        })()
                        return
                    }


                    if (payload.type === "webrtc_answer") {
                        if (!voiceConnectedRef.current || payload.from === username || payload.to !== username || !payload.from || !payload.sdp) return
                        const peer = peerConnectionsRef.current.get(payload.from)
                        if (!peer || peer.signalingState !== "have-local-offer") return
                        void peer.setRemoteDescription({ type: "answer", sdp: payload.sdp }).catch(() => undefined)
                        return
                    }


                    if (payload.type === "screen_share_start" || payload.type === "screen_share_stop") {
                        const note = payload.type === "screen_share_start" ? "started screen sharing" : "stopped screen sharing"
                        setMessages((prev) => [...prev, { type: "system", room_id: payload.room_id, content: `@${payload.from} ${note}` }])
                        if (payload.room_id && payload.from) {
                            updateScreenSharers(payload.room_id, (current) =>
                                payload.type === "screen_share_start" ? [...current, payload.from as string] : current.filter((member) => member !== payload.from),
                            )
                        }
                        if (payload.type === "screen_share_stop" && payload.from) removeRemoteScreen(payload.from)
                        return
                    }

                    if (payload.type === "webrtc_ice_candidate") {

                        if (!voiceConnectedRef.current || payload.from === username || payload.to !== username || !payload.from || !payload.candidate) return
                        const candidate: RTCIceCandidateInit = {
                            candidate: payload.candidate,
                            sdpMid: payload.sdp_mid ?? undefined,
                            sdpMLineIndex: payload.sdp_mline_index ?? undefined,
                        }
                        const peer = peerConnectionsRef.current.get(payload.from)
                        if (!peer || !peer.remoteDescription) {
                            queueCandidate(payload.from, candidate)
                            return
                        }
                        void peer.addIceCandidate(candidate)
                        return
                    }

                    if (payload.type === "stream_metrics" && payload.from && payload.room_id) {
                        const latencyMs = Number(payload.latency_ms ?? 0)
                        const fps = Number(payload.fps ?? 0)
                        const bitrateKbps = Number(payload.bitrate_kbps ?? 0)
                        const packetLossPct = Number(payload.packet_loss_pct ?? 0)
                        const jitterMs = Number(payload.jitter_ms ?? 0)
                        const availableOutgoingKbps = Number(payload.available_outgoing_kbps ?? 0)
                        const width = Number(payload.width ?? 0)
                        const height = Number(payload.height ?? 0)
                        const audioBitrateKbps = Number(payload.audio_bitrate_kbps ?? 0)
                        const qualityLimitationReason = String(payload.quality_limitation_reason ?? "none")
                        const targetBitrateKbps = Number(payload.target_bitrate_kbps ?? 0)
                        const frameDropPct = Number(payload.frame_drop_pct ?? 0)
                        const packetsSent = Number(payload.packets_sent ?? 0)
                        const retransmittedPackets = Number(payload.retransmitted_packets_sent ?? 0)
                        const encoderImplementation = String(payload.encoder_implementation ?? "unknown")
                        const encodeMs = Number(payload.avg_encode_time_ms ?? 0)
                        const freezeCount = Number(payload.freeze_count ?? 0)
                        const totalFreezesDurationMs = Number(payload.total_freezes_duration_ms ?? 0)
                        const networkStatus = payload.network_status === "good" || payload.network_status === "medium" || payload.network_status === "poor"
                            ? payload.network_status
                            : classifyNetworkQuality(latencyMs, fps, packetLossPct, bitrateKbps)
                        setStreamStatsByUser((prev) => ({
                            ...prev,
                            [payload.from as string]: {
                                username: payload.from as string,
                                roomId: payload.room_id as string,
                                latencyMs,
                                fps,
                                bitrateKbps,
                                packetLossPct,
                                jitterMs,
                                availableOutgoingKbps,
                                width,
                                height,
                                audioBitrateKbps,
                                qualityLimitationReason,
                                targetBitrateKbps,
                                frameDropPct,
                                packetsSent,
                                retransmittedPackets,
                                encoderImplementation,
                                encodeMs,
                                freezeCount,
                                totalFreezesDurationMs,
                                networkQuality: networkStatus,
                                timestamp: payload.timestamp ?? new Date().toISOString(),
                            },
                        }))
                        return
                    }
                    if (payload.type === "system" && payload.room_id && ["room closed", "left room"].includes(payload.content ?? "")) {
                        const room = payload.room_id
                        setRooms((prev) => {
                            const next = prev.filter((item) => item !== room)
                            setActiveRoom((current) => (current === room ? (next[0] ?? "") : current))
                            return next
                        })
                        joinedRoomsRef.current.delete(room)
                        setRoomMeta((prev) => {
                            const next = { ...prev }
                            delete next[room]
                            return next
                        })
                        setMessages((prev) => [...prev, payload])
                        return
                    }

                    const payloadRoomID = "room_id" in payload ? payload.room_id : undefined
                    if (payloadRoomID && !(payload.type === "system" && payload.content === "room does not exist")) {
                        setRooms((prev) => (prev.includes(payloadRoomID as string) ? prev : [...prev, payloadRoomID as string]))
                    }

                    if (
                        payload.type === "room_message" &&
                        payloadRoomID &&
                        payload.from !== username &&
                        currentMessageContextRef.current.activeRoom !== payloadRoomID
                    ) {
                        setUnreadCountByRoom((prev) => ({ ...prev, [payloadRoomID]: (prev[payloadRoomID] ?? 0) + 1 }))
                    }

                    setMessages((prev) => [...prev, payload])
                } catch {
                    setMessages((prev) => [...prev, { type: "system", content: String(event.data) }])
                }
            }

            ws.onclose = () => {
                wsRef.current = null
                joinedRoomsRef.current.clear()
                voiceConnectedRef.current = false
                cleanupVoiceConnections()
                setVoiceConnected(false)
                setScreenSharersByRoom({})
                if (manualClose || !isMounted) {
                    setStatus("offline")
                    return
                }
                scheduleReconnect()
            }

            wsRef.current = ws
        }

        connectWebSocket()

        return () => {
            isMounted = false
            manualClose = true
            clearReconnectTimer()
            reconnectAttemptRef.current = 0
            if (keepAliveIntervalRef.current !== null) {
                window.clearInterval(keepAliveIntervalRef.current)
                keepAliveIntervalRef.current = null
            }
            sendRealtimeLeaveSignals(activeRoomRef.current)
            cleanupVoiceConnections()
            wsRef.current?.close()
            wsRef.current = null
            setStatus("offline")
        }
    }, [token, username])

    useEffect(() => {
        if (keepAliveIntervalRef.current !== null) {
            window.clearInterval(keepAliveIntervalRef.current)
            keepAliveIntervalRef.current = null
        }
        if (status !== "online" || (!voiceConnected && !screenSharing)) return
        keepAliveIntervalRef.current = window.setInterval(() => {
            if (!activeRoomRef.current) return
            send({ type: "keepalive", room_id: activeRoomRef.current, timestamp: new Date().toISOString() })
        }, 20_000)
        return () => {
            if (keepAliveIntervalRef.current !== null) {
                window.clearInterval(keepAliveIntervalRef.current)
                keepAliveIntervalRef.current = null
            }
        }
    }, [screenSharing, status, voiceConnected])

    useEffect(() => {
        let isMounted = true
        void (async () => {
            try {
                const response = await fetchFriends(token)
                if (isMounted) setFriends(response.friends)
            } catch (error) {
                if (!isMounted) return
                const message = error instanceof Error ? error.message : "Could not fetch friend list"
                setMessages((prev) => [...prev, { type: "system", content: message }])
            }
        })()
        return () => {
            isMounted = false
        }
    }, [token])

    useEffect(() => {
        let isMounted = true
        void (async () => {
            try {
                const requests = await fetchFriendRequests(token)
                if (!isMounted) return
                setPendingIncomingRequests(requests.incoming)
                setPendingOutgoingRequests(requests.outgoing)
            } catch (error) {
                if (!isMounted) return
                const message = error instanceof Error ? error.message : "Could not fetch friend requests"
                setMessages((prev) => [...prev, { type: "system", content: message }])
            }
        })()
        return () => {
            isMounted = false
        }
    }, [token])


    const visibleMessages = useMemo(() => {
        if (activeDirectFriend) {
            return messages.filter((item) => (
                item.type === "direct_message" &&
                ((item.from === username && item.to === activeDirectFriend) || (item.from === activeDirectFriend && item.to === username))
            ))
        }
        return messages.filter((item) => !item.room_id || item.room_id === activeRoom)
    }, [activeDirectFriend, activeRoom, messages, username])



    useEffect(() => {
        messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" })
    }, [visibleMessages])

    useEffect(() => {
        const previousRoom = activeRoomRef.current
        if (previousRoom && previousRoom !== activeRoom) {
            sendRealtimeLeaveSignals(previousRoom)
        }
        cleanupVoiceConnections()
        setVoiceConnected(false)
        setMicMuted(false)
        voiceConnectedRef.current = false
        setOutputMuted(false)
        activeRoomRef.current = activeRoom
    }, [activeRoom])

    useEffect(() => {
        if (selectedScreenUser && !remoteScreens.find((screen) => screen.username === selectedScreenUser)) {
            setSelectedScreenUser(null)
        }
    }, [remoteScreens, selectedScreenUser])

    useEffect(() => {
        if (!localGainNodeRef.current) return
        localGainNodeRef.current.gain.value = micVolume / 100
    }, [micVolume])

    const activeRoomMeta = activeRoom ? roomMeta[activeRoom] : undefined
    const isActiveRoomOwner = Boolean(activeRoom && activeRoomMeta?.owner === username)
    const activeRoomScreenSharers = activeRoom ? screenSharersByRoom[activeRoom] ?? [] : []
    const isCurrentUserSharingScreen = activeRoomScreenSharers.includes(username)

    const handleCreateRoom = () => {
        const roomName = newRoom.trim()
        if (!roomName) return
        send({ type: "create_room", room_id: roomName })
        setNewRoom("")
    }

    const handleSelectRoom = (roomName: string) => {
        setActiveDirectFriend("")
        setActiveRoom(roomName)
        setUnreadCountByRoom((prev) => ({ ...prev, [roomName]: 0 }))
        if (!joinedRoomsRef.current.has(roomName)) {
            send({ type: "join_room", room_id: roomName })
            joinedRoomsRef.current.add(roomName)
        }

    }

    const handleSelectDirectFriend = (friendUsername: string) => {
        setActiveRoom("")
        setActiveDirectFriend(friendUsername)
    }

    const handleCloseRoom = () => {
        if (!activeRoom || !isActiveRoomOwner) return
        send({ type: "close_room", room_id: activeRoom })
    }

    const handleAddFriend = () => {
        const friendName = newFriend.trim()
        if (!friendName) return
        void (async () => {
            try {
                await addFriend(token, friendName)
                await refreshFriendsAndRequests()
                setNewFriend("")
            } catch (error) {
                const message = error instanceof Error ? error.message : "Could not add friend"
                setMessages((prev) => [...prev, { type: "system", content: message }])
            }
        })()
    }

    const handleAcceptFriendRequest = (requesterUsername: string) => {
        void (async () => {
            try {
                await acceptFriendRequest(token, requesterUsername)
                await refreshFriendsAndRequests()
            } catch (error) {
                const message = error instanceof Error ? error.message : "Friend request could not be accepted"
                setMessages((prev) => [...prev, { type: "system", content: message }])
            }
        })()
    }

    const handleRejectFriendRequest = (requesterUsername: string) => {
        void (async () => {
            try {
                await rejectFriendRequest(token, requesterUsername)
                await refreshFriendsAndRequests()
            } catch (error) {
                const message = error instanceof Error ? error.message : "Friend request could not be rejected"
                setMessages((prev) => [...prev, { type: "system", content: message }])
            }
        })()
    }

    const handleAddFriendToRoom = () => {
        const friendUsername = selectedFriendForRoom.trim()
        if (!friendUsername || !activeRoom) return
        send(buildAddFriendToRoomPayload(activeRoom, friendUsername))
        setMessages((prev) => [...prev, { type: "system", room_id: activeRoom, content: `Invite request sent for @${friendUsername}` }])
        setSelectedFriendForRoom("")
    }

    const handleSendRoomMessage = () => {
        const content = messageText.trim()
        if (!content) return
        if (activeDirectFriend) {
            const payload = { type: "direct_message", to: activeDirectFriend, content, timestamp: new Date().toISOString() }
            send(payload)
            setMessages((prev) => [...prev, { ...payload, from: username }])
            setMessageText("")
            return
        }
        if (!activeRoom) return
        send({ type: "room_message", room_id: activeRoom, content, timestamp: new Date().toISOString() })
        setMessageText("")
    }

    const handleLeaveRoom = () => {
        if (!activeRoom || isActiveRoomOwner) return
        sendRealtimeLeaveSignals(activeRoom)
        setVoiceConnected(false)
        send({ type: "leave_room", room_id: activeRoom, timestamp: new Date().toISOString() })
    }

    const stopScreenShare = () => {
        if (!screenStreamRef.current || !activeRoomRef.current) return
        const sharedTrackIds = new Set(screenStreamRef.current.getTracks().map((track) => track.id))
        screenStreamRef.current.getTracks().forEach((track) => track.stop())
        peerConnectionsRef.current.forEach((peer) => {
            peer.getSenders()
                .filter((sender) => sender.track && sharedTrackIds.has(sender.track.id))
                .forEach((sender) => {
                    void peer.removeTrack(sender)
                })
        })
        screenStreamRef.current = null
        setLocalPreviewScreen(null)
        setScreenSharing(false)
        setCameraSharing(false)
            ; (roomMeta[activeRoomRef.current]?.activeUsers ?? []).forEach((remoteUser) => {
                if (remoteUser !== username) void renegotiateWith(remoteUser, activeRoomRef.current)
            })
        send({ type: "screen_share_stop", room_id: activeRoomRef.current, timestamp: new Date().toISOString() })
        updateScreenSharers(activeRoomRef.current, (current) => current.filter((member) => member !== username))
    }

    const startVideoShare = async (mode: "screen" | "camera") => {
        if (!activeRoom || !voiceConnected) return
        activeVideoModeRef.current = mode
        const stream = mode === "screen"
            ? await navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_CONSTRAINTS)
            : await navigator.mediaDevices.getUserMedia(CAMERA_SHARE_CONSTRAINTS)


        stream.getVideoTracks().forEach((track) => {
            track.contentHint = VIDEO_TRACK_HINT[mode]
            void track.applyConstraints({
                frameRate: { ideal: 30, max: 30 }
            }).catch(() => undefined)
            track.addEventListener("ended", stopScreenShare)
        })
        screenStreamRef.current = stream
        if (mode === "screen") {
            await attachScreenShareAudioToMix(stream)
        }
        setLocalPreviewScreen({ username, stream })
        setScreenSharing(mode === "screen")
        setCameraSharing(mode === "camera")

        for (const remoteUser of roomMeta[activeRoom]?.activeUsers ?? []) {
            if (remoteUser === username) continue
            const peer = await ensurePeerConnection(remoteUser, activeRoom)
            stream.getTracks().forEach((track) => peer.addTrack(track, stream))
            tunePeerSender(peer, "video", "medium")
            await renegotiateWith(remoteUser, activeRoom)
        }

        send({ type: "screen_share_start", room_id: activeRoom, timestamp: new Date().toISOString() })
        updateScreenSharers(activeRoom, (current) => [...current, username])
        ensureMetricsLoop()
    }

    const wait = (ms: number) => new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
    })

    const shouldInitiateOffer = (localUser: string, remoteUser: string) => localUser.localeCompare(remoteUser) > 0

    const connectVoicePeerWithRetry = async (remoteUser: string, roomId: string) => {


        const attempts: Array<{ delayMs: number, preferRelay: boolean }> = [
            { delayMs: 0, preferRelay: false },
            { delayMs: 450, preferRelay: hasTurnServer() },
            { delayMs: 1_000, preferRelay: false },
        ]

        for (const attempt of attempts) {
            if (attempt.delayMs > 0) await wait(attempt.delayMs)
            try {

                const existingPeer = peerConnectionsRef.current.get(remoteUser)
                if (existingPeer && attempt.preferRelay && existingPeer.connectionState !== "connected") {
                    existingPeer.close()
                    peerConnectionsRef.current.delete(remoteUser)
                }
                await ensurePeerConnection(remoteUser, roomId, { preferRelay: attempt.preferRelay })
                if (shouldInitiateOffer(username, remoteUser)) {
                    await renegotiateWith(remoteUser, roomId)
                }
                return
            } catch {
                continue
            }
        }
        throw new Error("voice-peer-connect-failed")
    }

    const handleToggleVoice = () => {
        if (!activeRoom || isJoiningVoice) return

        if (!voiceConnected) {
            setIsJoiningVoice(true)
            void (async () => {
                try {
                    await ensureOutgoingAudioStream()
                    voiceConnectedRef.current = true
                    setVoiceConnected(true)
                    send({ type: "voice_join", room_id: activeRoom, timestamp: new Date().toISOString() })

                    const connectTasks = (roomMeta[activeRoom]?.activeUsers ?? [])
                        .filter((remoteUser) => remoteUser !== username)
                        .map(async (remoteUser) => {
                            await connectVoicePeerWithRetry(remoteUser, activeRoom)

                        })
                    await Promise.all(connectTasks)
                    ensureMetricsLoop()
                } catch {
                    setMessages((prev) => [...prev, { type: "system", room_id: activeRoom, content: "Microphone permission denied or voice chat could not be started." }])
                } finally {
                    setIsJoiningVoice(false)
                }
            })()
            return
        }

        send({ type: "voice_leave", room_id: activeRoom, timestamp: new Date().toISOString() })
        cleanupVoiceConnections()
        voiceConnectedRef.current = false
        setVoiceConnected(false)
    }

    const handleToggleScreenShare = () => {
        if (!activeRoom || !voiceConnected) return
        if (screenSharing || cameraSharing) {
            stopScreenShare()
            return
        }

        void (async () => {
            try {
                await startVideoShare("screen")
            } catch {
                setMessages((prev) => [...prev, { type: "system", room_id: activeRoom, content: "Screen share could not be started." }])
            }
        })()
    }

    const handleToggleCameraShare = () => {
        if (!activeRoom || !voiceConnected) return
        if (cameraSharing || screenSharing) {
            stopScreenShare()
            return
        }
        void (async () => {
            try {
                await startVideoShare("camera")
            } catch {
                setMessages((prev) => [...prev, { type: "system", room_id: activeRoom, content: "Camera share could not be started." }])
            }
        })()
    }

    const handleToggleMic = () => {
        if (!activeRoom || !voiceConnected) return
        const nextMuted = !micMuted
        setMicMuted(nextMuted)
        localStreamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = !nextMuted
        })
        send({ type: "voice_state", room_id: activeRoom, content: "mic_state", timestamp: new Date().toISOString(), mic_muted: nextMuted, output_muted: outputMuted })
    }

    const handleToggleOutput = () => {
        if (!activeRoom || !voiceConnected) return
        const nextMuted = !outputMuted
        setOutputMuted(nextMuted)
        send({ type: "voice_state", room_id: activeRoom, content: "output_state", timestamp: new Date().toISOString(), mic_muted: micMuted, output_muted: nextMuted })
    }

    const handleOutputVolumeChange = (nextVolume: number) => {
        const safeVolume = Math.max(0, Math.min(100, nextVolume))
        setOutputVolume(safeVolume)
    }

    const handleMicVolumeChange = (nextVolume: number) => {
        const safeVolume = Math.max(0, Math.min(100, nextVolume))
        setMicVolume(safeVolume)
    }
    const handleUploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file || !activeRoom) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)

            const response = await fetch(`${API_BASE_URL}/auth/rooms/${encodeURIComponent(activeRoom)}/attachments`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            })

            if (!response.ok) {
                let errorMessage = "File upload failed"
                try {
                    const payload = (await response.json()) as { error?: string }
                    if (payload.error) errorMessage = payload.error
                } catch {
                    errorMessage = "File upload failed"
                }
                throw new Error(errorMessage)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "File upload failed"
            setMessages((prev) => [...prev, { type: "system", room_id: activeRoom, content: message }])
        } finally {
            setUploading(false)
        }
    }

    const handleLogout = async () => {
        try {
            sendRealtimeLeaveSignals(activeRoomRef.current)
            await logoutUser(token)
        } finally {
            onLogout()
        }
    }

    return {
        refs: { messageListRef },
        state: {
            status,
            username,
            rooms,
            activeRoom,
            activeDirectFriend,
            newRoom,
            friends,
            newFriend,
            unreadCountByRoom,
            pendingIncomingRequests,
            pendingOutgoingRequests,
            selectedFriendForRoom,
            messageText,
            uploading,
            voiceConnected,
            micMuted,
            outputMuted,
            screenSharing,
            cameraSharing,
            remoteScreens,
            localPreviewScreen,
            outputVolume,
            micVolume,
            noiseGateDb,
            selectedScreenUser,
            streamStatsByUser,
            connectionDiagnosticsByUser,
            isJoiningVoice,
            remoteAudios,
            visibleMessages,
            activeRoomMeta,
            isActiveRoomOwner,
            activeRoomScreenSharers,
            isCurrentUserSharingScreen,
        },
        actions: {
            setNewRoom,
            setNewFriend,
            setSelectedFriendForRoom,
            setMessageText,
            handleCreateRoom,
            handleSelectRoom,
            handleSelectDirectFriend,
            setSelectedScreenUser,
            handleAddFriend,
            handleAcceptFriendRequest,
            handleRejectFriendRequest,
            handleAddFriendToRoom,
            handleOutputVolumeChange,
            handleMicVolumeChange,
            setNoiseGateDb,
            handleSendRoomMessage,
            handleToggleVoice,
            handleToggleMic,
            handleToggleOutput,
            handleToggleScreenShare,
            handleToggleCameraShare,
            handleLeaveRoom,
            handleCloseRoom,
            handleUploadAttachment,
            handleLogout,
        },
    }
}
