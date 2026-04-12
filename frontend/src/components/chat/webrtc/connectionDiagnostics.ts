
export type ConnectionRoute = "p2p" | "turn-relay" | "unknown"
export type ConnectionTransport = "udp" | "tcp" | "tls" | "unknown"

export interface IceCandidateSnapshot {
    candidateType: string
    protocol: ConnectionTransport
    address: string
    port: number
    networkType: string
}

export interface ConnectionDiagnostics {
    route: ConnectionRoute
    protocol: ConnectionTransport
    iceState: RTCIceConnectionState
    connectionState: RTCPeerConnectionState
    rttMs: number
    availableOutgoingKbps: number
    localCandidate: IceCandidateSnapshot | null
    remoteCandidate: IceCandidateSnapshot | null
    lastUpdatedAt: string
}

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0)
const asString = (value: unknown) => (typeof value === "string" ? value : "")

const toProtocol = (value: unknown): ConnectionTransport => {
    const protocol = asString(value).toLowerCase()
    if (protocol === "udp" || protocol === "tcp" || protocol === "tls") return protocol
    return "unknown"
}

const candidateFromStats = (stats: Record<string, unknown> | undefined): IceCandidateSnapshot | null => {
    if (!stats) return null
    return {
        candidateType: asString(stats.candidateType) || "unknown",
        protocol: toProtocol(stats.protocol),
        address: asString(stats.address) || asString(stats.ip) || "unknown",
        port: asNumber(stats.port),
        networkType: asString(stats.networkType) || "unknown",
    }
}

export const inferRoute = (localCandidateType: string, remoteCandidateType: string): ConnectionRoute => {
    const localType = localCandidateType.toLowerCase()
    const remoteType = remoteCandidateType.toLowerCase()
    if (!localType && !remoteType) return "unknown"
    if (localType === "relay" || remoteType === "relay") return "turn-relay"
    if (["host", "srflx", "prflx"].includes(localType) || ["host", "srflx", "prflx"].includes(remoteType)) return "p2p"
    return "unknown"
}

export const extractDiagnosticsFromRtcStats = (
    stats: RTCStatsReport,
    peer: RTCPeerConnection,
): ConnectionDiagnostics => {
    const byID = new Map<string, Record<string, unknown>>()
    let selectedPair: Record<string, unknown> | null = null
    let selectedPairFromTransport: Record<string, unknown> | null = null

    stats.forEach((entry) => {
        const typedEntry = entry as unknown as Record<string, unknown>
        const id = asString(typedEntry.id)
        if (id) byID.set(id, typedEntry)
        if (typedEntry.type === "transport") {
            const selectedPairID = asString(typedEntry.selectedCandidatePairId)
            if (selectedPairID && byID.has(selectedPairID)) {
                selectedPairFromTransport = byID.get(selectedPairID) ?? null
            }
        }
        if (typedEntry.type === "candidate-pair" && typedEntry.state === "succeeded" && (typedEntry.nominated === true || typedEntry.selected === true)) {
            selectedPair = typedEntry
        }
    })

    if (!selectedPair && selectedPairFromTransport) {
        selectedPair = selectedPairFromTransport
    }
    if (!selectedPair) {
        stats.forEach((entry) => {
            const typedEntry = entry as unknown as Record<string, unknown>
            if (!selectedPair && typedEntry.type === "candidate-pair" && typedEntry.state === "succeeded") {
                selectedPair = typedEntry
            }
        })
    }

    const localCandidateID = asString(selectedPair?.["localCandidateId"])
    const remoteCandidateID = asString(selectedPair?.["remoteCandidateId"])
    const localCandidate = candidateFromStats(byID.get(localCandidateID))
    const remoteCandidate = candidateFromStats(byID.get(remoteCandidateID))
    const protocol = localCandidate?.protocol ?? toProtocol(selectedPair?.["protocol"])
    const route = inferRoute(localCandidate?.candidateType ?? "", remoteCandidate?.candidateType ?? "")

    return {
        route,
        protocol,
        iceState: peer.iceConnectionState,
        connectionState: peer.connectionState,
        rttMs: Math.round(asNumber(selectedPair?.["currentRoundTripTime"]) * 1000),
        availableOutgoingKbps: Number((asNumber(selectedPair?.["availableOutgoingBitrate"]) / 1000).toFixed(1)),
        localCandidate,
        remoteCandidate,
        lastUpdatedAt: new Date().toISOString(),
    }
}

