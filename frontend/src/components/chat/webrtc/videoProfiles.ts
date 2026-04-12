
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
        good: { maxBitrate: 1_800_000, maxFramerate: 30, scaleResolutionDownBy: 1, degradationPreference: "balanced" },
        medium: { maxBitrate: 1_100_000, maxFramerate: 24, scaleResolutionDownBy: 1.15, degradationPreference: "balanced" },



        poor: { maxBitrate: 700_000, maxFramerate: 16, scaleResolutionDownBy: 1.45, degradationPreference: "maintain-framerate" },

    },
    screen: {
        good: { maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1, degradationPreference: "maintain-resolution" },
        medium: { maxBitrate: 1_600_000, maxFramerate: 24, scaleResolutionDownBy: 1.25, degradationPreference: "balanced" },

        poor: { maxBitrate: 1_000_000, maxFramerate: 14, scaleResolutionDownBy: 1.6, degradationPreference: "maintain-framerate" },

    },
}

export const NETWORK_PROFILE_ORDER: NetworkProfile[] = ["poor", "medium", "good"]
