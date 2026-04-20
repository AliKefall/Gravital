import type { SVGProps } from "react"

type IconName =
  | "plus"
  | "userPlus"
  | "invite"
  | "check"
  | "close"
  | "chat"
  | "audio"
  | "voice"
  | "mic"
  | "speaker"
  | "screen"
  | "camera"
  | "leave"
  | "trash"
  | "logout"
  | "send"
  | "search"
  | "file"
  | "eye"
  | "eyeOff"

interface AppIconProps extends SVGProps<SVGSVGElement> {
  name: IconName
}

const PATHS: Record<IconName, string> = {
  plus: "M12 5v14m-7-7h14",
  userPlus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18-8v6m3-3h-6M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  invite: "M16 7h6m-3-3v6M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 9h8M9 13h8M9 17h4",
  check: "M20 6 9 17l-5-5",
  close: "M18 6 6 18M6 6l12 12",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  audio: "M11 5 6 9H2v6h4l5 4zm8.5 7a4.5 4.5 0 0 0-2.5-4.03M19.5 12a8.5 8.5 0 0 0-4.5-7.5",
  voice: "M12 2a3 3 0 0 0-3 3v7a3 3 0 1 0 6 0V5a3 3 0 0 0-3-3zm7 10a7 7 0 0 1-14 0M12 19v3",
  mic: "M12 1v11m0 0a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3zM5 10a7 7 0 0 0 14 0M12 17v6",
  speaker: "M11 5 6 9H2v6h4l5 4zm5.5 2.5a8 8 0 0 1 0 9",
  screen: "M3 4h18v12H3zM8 20h8M12 16v4",
  camera: "M23 7l-7 5 7 5zM1 5h15v14H1z",
  leave: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9",
  trash: "M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 12 5-5-5-5M21 12H9",
  send: "M22 2 11 13M22 2 15 22l-4-9-9-4z",
  search: "m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "m3 3 18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.9 18.9 0 0 1-5.1 5.7M6.6 6.6C3.3 8.5 1 12 1 12s4 8 11 8a10.9 10.9 0 0 0 4.2-.8",
}

export const AppIcon = ({ name, className, ...props }: AppIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={["ui-icon", className].filter(Boolean).join(" ")}
    {...props}
  >
    <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
