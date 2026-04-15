
export type NetworkProfile = "good" | "medium" | "poor"
export type VideoMode = "screen" | "camera"

export interface VideoProfile {
    maxBitrate: number
    maxFramerate: number
    scaleResolutionDownBy: number
    degradationPreference: RTCDegradationPreference
}

export const VIDEO_PROFILE_SETTINGS: Record<VideoMode, Record<NetworkProfile, VideoProfile>> = {
    camera: {
        good: { maxBitrate: 1_600_000, maxFramerate: 30, scaleResolutionDownBy: 1, degradationPreference: "balanced" },
        medium: { maxBitrate: 1_000_000, maxFramerate: 24, scaleResolutionDownBy: 1.2, degradationPreference: "balanced" },
        poor: { maxBitrate: 700_000, maxFramerate: 16, scaleResolutionDownBy: 1.45, degradationPreference: "maintain-framerate" },

    },
    screen: {
        good: { maxBitrate: 1_500_000, maxFramerate: 30, scaleResolutionDownBy: 1, degradationPreference: "maintain-resolution" },
        medium: { maxBitrate: 1_200_000, maxFramerate: 30, scaleResolutionDownBy: 1.05, degradationPreference: "maintain-resolution" },
        poor: { maxBitrate: 850_000, maxFramerate: 20, scaleResolutionDownBy: 1.3, degradationPreference: "balanced" },

    },
}

export const NETWORK_PROFILE_ORDER: NetworkProfile[] = ["poor", "medium", "good"]
