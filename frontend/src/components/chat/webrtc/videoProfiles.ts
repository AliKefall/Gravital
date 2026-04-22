
export type NetworkProfile = "poor" | "degraded" | "fair" | "good" | "excellent"
export type VideoMode = "screen" | "camera"

export interface VideoProfile {
    maxBitrate: number
    maxFramerate: number
    scaleResolutionDownBy: number
    degradationPreference: RTCDegradationPreference
}

export const VIDEO_PROFILE_SETTINGS: Record<VideoMode, Record<NetworkProfile, VideoProfile>> = {
    camera: {
        excellent: { maxBitrate: 2_000_000, maxFramerate: 30, scaleResolutionDownBy: 1, degradationPreference: "balanced" },
        good: { maxBitrate: 1_500_000, maxFramerate: 30, scaleResolutionDownBy: 1.1, degradationPreference: "balanced" },
        fair: { maxBitrate: 1_150_000, maxFramerate: 30, scaleResolutionDownBy: 1.2, degradationPreference: "balanced" },
        degraded: { maxBitrate: 900_000, maxFramerate: 30, scaleResolutionDownBy: 1.3, degradationPreference: "maintain-framerate" },
        poor: { maxBitrate: 700_000, maxFramerate: 30, scaleResolutionDownBy: 1.45, degradationPreference: "maintain-framerate" },
    },
    screen: {
        excellent: { maxBitrate: 3_200_000, maxFramerate: 30, scaleResolutionDownBy: 1, degradationPreference: "maintain-resolution" },
        good: { maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1.05, degradationPreference: "maintain-resolution" },
        fair: { maxBitrate: 1_800_000, maxFramerate: 30, scaleResolutionDownBy: 1.12, degradationPreference: "maintain-resolution" },
        degraded: { maxBitrate: 1_250_000, maxFramerate: 30, scaleResolutionDownBy: 1.25, degradationPreference: "balanced" },
        poor: { maxBitrate: 900_000, maxFramerate: 30, scaleResolutionDownBy: 1.4, degradationPreference: "maintain-framerate" },
    },
}

export const NETWORK_PROFILE_ORDER: NetworkProfile[] = ["poor", "degraded", "fair", "good", "excellent"]
