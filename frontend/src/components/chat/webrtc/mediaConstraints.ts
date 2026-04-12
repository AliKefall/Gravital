
import type { VideoMode } from "./videoProfiles"

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48_000,
    channelCount: 1,
    sampleSize: 16,
    ...({ googEchoCancellation: true, googNoiseSuppression: true, googHighpassFilter: true } as Record<string, unknown>),
}

export const SCREEN_SHARE_CONSTRAINTS: DisplayMediaStreamOptions = {
    video: {
        frameRate: { ideal: 24, max: 30 },
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1440 },
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48_000,
    },
}

export const CAMERA_SHARE_CONSTRAINTS: MediaStreamConstraints = {
    video: {
        frameRate: { ideal: 24, max: 30 },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: "user",
    },
    audio: false,
}

export const VIDEO_TRACK_HINT: Record<VideoMode, "detail" | "motion"> = {
    screen: "detail",
    camera: "motion",
}
