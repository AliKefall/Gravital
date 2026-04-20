
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react"
import { MessageContent } from "./MessageContent"
import type { ChatMessage, ConnectionDiagnostics, RemoteAudio, RemoteScreen, RoomMeta, StreamStats } from "./types"
import { AppIcon } from "../common/AppIcon"


interface WorkspaceChatPanelProps {
  status: "connecting" | "online" | "reconnecting" | "offline"
  activeRoom: string
  activeDirectFriend: string
  messageText: string
  uploading: boolean
  voiceConnected: boolean
  micMuted: boolean
  outputMuted: boolean
  outputVolume: number
  micVolume: number
  noiseGateDb: number
  screenSharing: boolean
  cameraSharing: boolean
  remoteScreens: RemoteScreen[]
  localPreviewScreen: RemoteScreen | null
  remoteAudios: RemoteAudio[]
  selectedScreenUser: string | null
  streamStatsByUser: Record<string, StreamStats>
  connectionDiagnosticsByUser: Record<string, ConnectionDiagnostics>
  isJoiningVoice: boolean
  visibleMessages: ChatMessage[]
  activeRoomMeta?: RoomMeta
  isActiveRoomOwner: boolean
  activeRoomScreenSharers: string[]
  isCurrentUserSharingScreen: boolean
  messageListRef: RefObject<HTMLDivElement | null>
  onMessageTextChange: (value: string) => void
  onSendMessage: () => void
  onToggleVoice: () => void
  onToggleMic: () => void
  onToggleOutput: () => void
  onToggleScreenShare: () => void
  onToggleCameraShare: () => void
  onOutputVolumeChange: (value: number) => void
  onMicVolumeChange: (value: number) => void
  onNoiseGateDbChange: (value: number) => void
  onLeaveRoom: () => void
  onCloseRoom: () => void
  onUploadAttachment: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onSelectedScreenUser: (username: string | null) => void
  onLogout: () => Promise<void>
}

export const WorkspaceChatPanel = ({
  status,
  activeRoom,
  activeDirectFriend,
  messageText,
  uploading,
  voiceConnected,
  micMuted,
  outputMuted,
  outputVolume,
  micVolume,
  noiseGateDb,
  screenSharing,
  cameraSharing,
  remoteScreens,
  localPreviewScreen,
  remoteAudios,
  visibleMessages,
  activeRoomMeta,
  isActiveRoomOwner,
  activeRoomScreenSharers,
  isCurrentUserSharingScreen,
  messageListRef,
  selectedScreenUser,
  streamStatsByUser,
  connectionDiagnosticsByUser,
  isJoiningVoice,
  onMessageTextChange,
  onSendMessage,
  onToggleVoice,
  onToggleMic,
  onToggleOutput,
  onToggleScreenShare,
  onToggleCameraShare,
  onOutputVolumeChange,
  onMicVolumeChange,
  onNoiseGateDbChange,
  onLeaveRoom,
  onCloseRoom,
  onUploadAttachment,
  onSelectedScreenUser,
  onLogout,
}: WorkspaceChatPanelProps) => {
  const [activeTab, setActiveTab] = useState<"chat" | "audio">("chat")
  const [messageFilter, setMessageFilter] = useState("")
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [selectedInputId, setSelectedInputId] = useState("")
  const [selectedOutputId, setSelectedOutputId] = useState("")
  const [showLiveMetrics, setShowLiveMetrics] = useState(false)
  const selectedScreenVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const remoteAnalyzersRef = useRef<Map<string, { context: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(new Map())
  const selectedScreen = selectedScreenUser ? remoteScreens.find((screen) => screen.username === selectedScreenUser) : null

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const inputs = devices.filter((device) => device.kind === "audioinput")
        const outputs = devices.filter((device) => device.kind === "audiooutput")
        setAudioInputs(inputs)
        setAudioOutputs(outputs)
        setSelectedInputId((previous) => previous || inputs[0]?.deviceId || "")
        setSelectedOutputId((previous) => previous || outputs[0]?.deviceId || "")
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !window.AudioContext) return
    const interval = window.setInterval(() => {
      remoteAnalyzersRef.current.forEach((entry, username) => {
        const bins = new Uint8Array(entry.analyser.frequencyBinCount)
        entry.analyser.getByteTimeDomainData(bins)
        let sum = 0
        for (const value of bins) {
          const normalized = (value - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / bins.length)
        const db = rms > 0 ? 20 * Math.log10(rms) : -100
        const element = remoteAudioElementsRef.current.get(username)
        if (element) element.muted = outputMuted || db < noiseGateDb
      })
    }, 150)
    return () => {
      window.clearInterval(interval)
    }
  }, [noiseGateDb, outputMuted])

  const requestFullscreen = async () => {
    const video = selectedScreenVideoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
      return
    }
    await video.requestFullscreen?.().catch(() => undefined)
  }


  const filteredMessages = useMemo(() => {
    const query = messageFilter.trim().toLocaleLowerCase("tr-TR")
    if (!query) return visibleMessages
    return visibleMessages.filter((message) => {
      const text = `${message.from ?? ""} ${message.content ?? ""}`.toLocaleLowerCase("tr-TR")
      return text.includes(query)
    })
  }, [messageFilter, visibleMessages])

  const systemMessageCount = useMemo(() => visibleMessages.filter((message) => message.type === "system").length, [visibleMessages])
  const streamStatsRows = useMemo(
    () => Object.values(streamStatsByUser).sort((a, b) => a.username.localeCompare(b.username)),
    [streamStatsByUser],
  )
  const pendingScreenSharers = useMemo(() => {
    const renderedUsers = new Set<string>(remoteScreens.map((item) => item.username))
    if (localPreviewScreen) renderedUsers.add(localPreviewScreen.username)
    return activeRoomScreenSharers.filter((member) => !renderedUsers.has(member))
  }, [activeRoomScreenSharers, localPreviewScreen, remoteScreens])

  return (
    <section className="chat-panel">
      <header className="chat-header compact-chat-header">
        <div>
          <h1>{activeDirectFriend ? `#${activeDirectFriend}` : activeRoom ? `#${activeRoom}` : "No room selected"}</h1>
          <p>{status === "online" ? "Live" : status === "connecting" ? "Connecting" : status === "reconnecting" ? "Reconnecting" : "Offline"}</p>
        </div>

        <div className="header-actions compact-actions">
          <button className={`secondary icon-button ${activeTab === "chat" ? "active-tab" : ""}`} onClick={() => setActiveTab("chat")}>
            <AppIcon name="chat" />
            <span>Chat</span>
          </button>
          <button className={`secondary ${activeTab === "audio" ? "active-tab" : ""}`} onClick={() => setActiveTab("audio")} title="Audio settings">
            <AppIcon name="audio" />
            <span>Audio</span>
          </button>
          <button className="secondary" onClick={onToggleVoice} disabled={status !== "online" || !activeRoom || isJoiningVoice}>
            <AppIcon name="voice" />
            <span>{isJoiningVoice ? "Connecting..." : voiceConnected ? "Leave Voice" : "Join Voice"}</span>
          </button>
          <button className="secondary" onClick={onToggleMic} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="mic" />
            <span>{micMuted ? "Unmute Mic" : "Mute Mic"}</span>
          </button>
          <button className="secondary" onClick={onToggleOutput} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="speaker" />
            <span>{outputMuted ? "Unmute Output" : "Mute Output"}</span>
          </button>
          <button className="secondary" onClick={onToggleScreenShare} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="screen" />
            <span>{screenSharing ? "Stop Sharing" : "Share Screen"}</span>
          </button>
          <button className="secondary" onClick={onToggleCameraShare} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="camera" />
            <span>{cameraSharing ? "Stop Camera" : "Share Camera"}</span>
          </button>
          <button
            className="secondary"
            onClick={onLeaveRoom}
            disabled={status !== "online" || !activeRoom || isActiveRoomOwner}
            title={!activeRoom ? "Select a room first" : isActiveRoomOwner ? "Room owner cannot leave room" : undefined}
          >
            <AppIcon name="leave" />
            <span>Leave Room</span>
          </button>
          <button
            className="secondary"
            onClick={onCloseRoom}
            disabled={!isActiveRoomOwner || status !== "online"}
            title={!activeRoom ? "Select a room first" : !isActiveRoomOwner ? "Only the room owner can close the room" : undefined}
          >
            <AppIcon name="trash" />
            <span>Close Room</span>
          </button>
          <button className="danger" onClick={() => void onLogout()}>
            <AppIcon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="chat-kpi-row modern-kpi-row">
        <article className="kpi-card">
          <span>Total messages</span>
          <strong>{visibleMessages.length}</strong>
        </article>
        <article className="kpi-card">
          <span>System notices</span>
          <strong>{systemMessageCount}</strong>
        </article>
        <article className="kpi-card">
          <span>Live participants</span>
          <strong>{activeRoomMeta?.activeUsers.length ?? 0}</strong>
        </article>
      </div>

      {activeTab === "chat" ? (
        <section className="chat-tab-layout">
          <section className="screen-share-area">
            <header className="screen-share-header">
              <h3>Screen Share Window</h3>
              <p>{isCurrentUserSharingScreen ? "You are sharing your screen now." : "Screen share is off."}</p>
            </header>
            <button className="secondary metrics-toggle" onClick={() => setShowLiveMetrics((prev) => !prev)}>
              <AppIcon name="search" />
              <span>{showLiveMetrics ? "Hide live metrics" : "Show live metrics"}</span>
            </button>
            <div className="screen-share-stats">
              <p><strong>Voice participants:</strong> {remoteAudios.length}</p>
              <p><strong>Screen sharing:</strong> {activeRoomScreenSharers.length}</p>
              <p><strong>Room owner:</strong> @{activeRoomMeta?.owner || "unknown"}</p>
            </div>

            <ul className="screen-share-users">
              {activeRoomScreenSharers.length === 0 ? (
                <li>No one is sharing screen in this room right now.</li>
              ) : (
                activeRoomScreenSharers.map((member) => <li key={`screen-sharer-${member}`}>@{member}</li>)
              )}
            </ul>

            <div className="screen-grid">
              {localPreviewScreen && (
                <article className="screen-card">
                  <div className="screen-card-header">
                    <h4>@{localPreviewScreen.username} (You)</h4>
                  </div>
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(element) => {
                      if (!element) return
                      if (element.srcObject !== localPreviewScreen.stream) element.srcObject = localPreviewScreen.stream
                    }}
                  />
                  <div className="stream-stats-inline">
                    <span>Preview: active</span>
                    <span>Type: {screenSharing ? "Screen" : cameraSharing ? "Camera" : "-"}</span>
                  </div>
                </article>
              )}
              {remoteScreens.map((remoteScreen) => (
                <article key={remoteScreen.username} className="screen-card">
                  <div className="screen-card-header">
                    <h4>@{remoteScreen.username}</h4>
                    <button className="secondary" onClick={() => onSelectedScreenUser(remoteScreen.username)}>
                      <AppIcon name="screen" />
                      <span>Resize</span>
                    </button>
                  </div>
                  <video
                    autoPlay
                    playsInline
                    ref={(element) => {
                      if (!element) return
                      if (element.srcObject !== remoteScreen.stream) element.srcObject = remoteScreen.stream
                    }}
                  />
                  <div className="stream-stats-inline">
                    <span>FPS: {streamStatsByUser[remoteScreen.username]?.fps?.toFixed(1) ?? "-"}</span>
                    <span>MS: {Math.round(streamStatsByUser[remoteScreen.username]?.latencyMs ?? 0) || "-"}</span>
                    <span>Bitrate: {streamStatsByUser[remoteScreen.username]?.bitrateKbps?.toFixed(0) ?? "-"} kbps</span>
                    <span>Net: {streamStatsByUser[remoteScreen.username]?.networkQuality ?? "-"}</span>
                  </div>
                </article>
              ))}
              {pendingScreenSharers.map((member) => (
                <article key={`pending-screen-${member}`} className="screen-card">
                  <div className="screen-card-header">
                    <h4>@{member}</h4>
                  </div>
                  <div className="stream-stats-inline">
                    <span>Broadcast is active, stream is connecting...</span>
                  </div>
                </article>
              ))}
            </div>
            {showLiveMetrics && <section className="stream-metrics-panel">
              <h4>Connection route monitor (UDP/TURN/P2P)</h4>
              <p>Track active ICE route, protocol (UDP/TCP/TLS), and relay state for each peer.</p>
              {Object.entries(connectionDiagnosticsByUser).length === 0 ? (
                <p>No connection diagnostics yet. Join voice and wait to connect with another user.</p>
              ) : (
                <div className="stream-metrics-table-wrap">
                  <table className="stream-metrics-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Route</th>
                        <th>Protocol</th>
                        <th>ICE</th>
                        <th>RTT</th>
                        <th>UpLink</th>
                        <th>Local Candidate</th>
                        <th>Remote Candidate</th>
                        <th>Local Network</th>
                        <th>Remote Network</th>
                        <th>Connection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(connectionDiagnosticsByUser).map(([username, diagnostics]) => (
                        <tr key={`conn-diag-${username}`}>
                          <td>@{username}</td>
                          <td>{diagnostics.route}</td>
                          <td>{diagnostics.protocol}</td>
                          <td>{diagnostics.iceState}</td>
                          <td>{diagnostics.rttMs} ms</td>
                          <td>{diagnostics.availableOutgoingKbps.toFixed(0)} kbps</td>
                          <td>{diagnostics.localCandidate ? `${diagnostics.localCandidate.candidateType}/${diagnostics.localCandidate.protocol}` : "-"}</td>
                          <td>{diagnostics.remoteCandidate ? `${diagnostics.remoteCandidate.candidateType}/${diagnostics.remoteCandidate.protocol}` : "-"}</td>
                          <td>{diagnostics.localCandidate?.networkType ?? "-"}</td>
                          <td>{diagnostics.remoteCandidate?.networkType ?? "-"}</td>
                          <td>{diagnostics.connectionState}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>}
            {showLiveMetrics && <section className="stream-metrics-panel">
              <h4>Live streaming metrics</h4>
              <p>Monitor latency and connection quality for webcam/screen streams.</p>
              {streamStatsRows.length === 0 ? (
                <p>No stream metrics yet. Join voice and start webcam/screen sharing.</p>
              ) : (
                <div className="stream-metrics-table-wrap">
                  <table className="stream-metrics-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Latency</th>
                        <th>FPS</th>
                        <th>Bitrate</th>
                        <th>Audio</th>
                        <th>Loss</th>
                        <th>Jitter</th>
                        <th>UpLink</th>
                        <th>Reason</th>
                        <th>Resolution</th>
                        <th>Quality</th>
                        <th>Target Bitrate</th>
                        <th>Frame Drop</th>
                        <th>Encoder</th>
                        <th>Encode</th>
                        <th>Retransmit</th>
                        <th>Freeze</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streamStatsRows.map((stats) => (
                        <tr key={`stream-stats-${stats.username}`}>
                          <td>@{stats.username}</td>
                          <td>{Math.round(stats.latencyMs)} ms</td>
                          <td>{stats.fps.toFixed(1)}</td>
                          <td>{stats.bitrateKbps.toFixed(0)} kbps</td>
                          <td>{stats.audioBitrateKbps.toFixed(0)} kbps</td>
                          <td>{stats.packetLossPct.toFixed(1)}%</td>
                          <td>{stats.jitterMs.toFixed(1)} ms</td>
                          <td>{stats.availableOutgoingKbps.toFixed(0)} kbps</td>
                          <td>{stats.qualityLimitationReason}</td>
                          <td>{stats.width > 0 && stats.height > 0 ? `${stats.width}x${stats.height}` : "-"}</td>
                          <td>{stats.networkQuality}</td>
                          <td>{stats.targetBitrateKbps.toFixed(0)} kbps</td>
                          <td>{stats.frameDropPct.toFixed(1)}%</td>
                          <td>{stats.encoderImplementation}</td>
                          <td>{stats.encodeMs.toFixed(2)} ms</td>
                          <td>{stats.retransmittedPackets}/{stats.packetsSent}</td>
                          <td>{stats.freezeCount} / {stats.totalFreezesDurationMs.toFixed(0)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>}
          </section>

          <div className="message-toolbar">
            <input
              value={messageFilter}
              onChange={(event) => setMessageFilter(event.target.value)}
              placeholder="Search messages (user or content)"
              aria-label="Search messages"
            />
            <AppIcon name="search" className="toolbar-icon" />
            <span>{filteredMessages.length} results</span>
          </div>
          <div className="message-list" ref={messageListRef}>
            {filteredMessages.length === 0 && <p className="message-empty-state">No messages for this filter. Try a different phrase.</p>}
            {filteredMessages.map((message, index) => (
              <article className="message-item" key={`${message.type}-${message.timestamp ?? "na"}-${index}`}>
                <strong>{message.from ?? "system"}</strong>
                <MessageContent message={message} />
              </article>
            ))}
          </div>
          <footer className="composer compact-composer">
            <input
              value={messageText}
              onChange={(event) => onMessageTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  onSendMessage()
                }
              }}
              placeholder={activeDirectFriend ? `Write a message to @${activeDirectFriend}...` : "Write your message..."}
            />
            <button onClick={onSendMessage} disabled={status !== "online" || (!activeRoom && !activeDirectFriend)}>
              <AppIcon name="send" />
              <span>Send</span>
            </button>
            <label className="upload-button">
              <AppIcon name="file" />
              <span>{uploading ? "Uploading..." : "File"}</span>
              <input
                type="file"
                accept="image/*,video/*,application/pdf,text/plain,.rar,application/x-rar-compressed"
                onChange={(event) => void onUploadAttachment(event)}
                disabled={status !== "online" || !activeRoom || uploading}
              />
            </label>

            <span className="composer-hint">Press Enter to send • {messageText.length} chars</span>
          </footer>
        </section>
      ) : (
        <section className="audio-settings-panel compact-audio">
          <h3>Audio Settings</h3>
          <p>Microphone/speaker selection and volume levels are stored here (reset on page refresh).</p>
          <label>
            Select Microphone
            <select value={selectedInputId} onChange={(event) => setSelectedInputId(event.target.value)}>
              {audioInputs.length === 0 ? (
                <option value="">Default microphone</option>
              ) : (
                audioInputs.map((device, index) => <option key={`${device.deviceId}-${index}`} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)
              )}
            </select>
          </label>

          <label>
            Select Headphones/Speaker
            <select value={selectedOutputId} onChange={(event) => setSelectedOutputId(event.target.value)}>
              {audioOutputs.length === 0 ? (
                <option value="">Default output</option>
              ) : (
                audioOutputs.map((device, index) => <option key={`${device.deviceId}-${index}`} value={device.deviceId}>{device.label || `Output ${index + 1}`}</option>)
              )}
            </select>
          </label>

          <div className="audio-grid">
            <article className="audio-control-card">
              <strong>Output Volume</strong>
              <span>{outputVolume}%</span>
              <input type="range" min={0} max={100} value={outputVolume} onChange={(event) => onOutputVolumeChange(Number(event.target.value))} />
            </article>
            <article className="audio-control-card">
              <strong>Mic Volume</strong>
              <span>{micVolume}%</span>
              <input type="range" min={0} max={100} value={micVolume} onChange={(event) => onMicVolumeChange(Number(event.target.value))} />
            </article>
            <article className="audio-control-card" style={{ gridColumn: "1 / -1" }}>
              <strong>Noise Gate</strong>
              <span>{noiseGateDb} dB</span>
              <input type="range" min={-80} max={0} value={noiseGateDb} onChange={(event) => onNoiseGateDbChange(Number(event.target.value))} />
            </article>
          </div>

          <div className="audio-toggle-row">
            <button className="secondary" onClick={onToggleMic} disabled={status !== "online" || !activeRoom || !voiceConnected}>
              <AppIcon name="mic" />
              <span>{micMuted ? "Unmute Mic" : "Mute Mic"}</span>
            </button>
            <button className="secondary" onClick={onToggleOutput} disabled={status !== "online" || !activeRoom || !voiceConnected}>
              <AppIcon name="speaker" />
              <span>{outputMuted ? "Unmute Output" : "Mute Output"}</span>
            </button>
          </div>
        </section>
      )}

      {selectedScreen && (
        <div className="screen-modal" role="dialog" aria-modal="true">
          <div className="screen-modal-content">
            <header>
              <h3>@{selectedScreen.username} - Fullscreen view</h3>

              <div className="modal-actions">
                <button className="secondary" onClick={() => void requestFullscreen()}>
                  <AppIcon name="screen" />
                  <span>Video Mode</span>
                </button>
                <button className="danger" onClick={() => onSelectedScreenUser(null)}>
                  <AppIcon name="close" />
                  <span>Close</span>
                </button>
              </div>
            </header>
            <video
              autoPlay
              playsInline
              controls
              ref={(element) => {
                selectedScreenVideoRef.current = element
                if (!element) return
                if (element.srcObject !== selectedScreen.stream) element.srcObject = selectedScreen.stream
              }}
              onDoubleClick={() => void requestFullscreen()}
            />
          </div>
        </div>
      )}

      {remoteAudios.map((remoteAudio) => (
        <audio
          key={`audio-${remoteAudio.username}`}
          autoPlay
          ref={(element) => {
            if (!element) {
              const previous = remoteAnalyzersRef.current.get(remoteAudio.username)
              if (previous) {
                previous.source.disconnect()
                previous.analyser.disconnect()
                void previous.context.close().catch(() => undefined)
                remoteAnalyzersRef.current.delete(remoteAudio.username)
              }
              remoteAudioElementsRef.current.delete(remoteAudio.username)
              return
            }
            remoteAudioElementsRef.current.set(remoteAudio.username, element)
            if (element.srcObject !== remoteAudio.stream) element.srcObject = remoteAudio.stream
            if (!remoteAnalyzersRef.current.has(remoteAudio.username) && window.AudioContext) {
              if (remoteAudio.stream.getAudioTracks().length === 0) {
                element.muted = true
                return
              }
              const context = new window.AudioContext()
              let source: MediaStreamAudioSourceNode
              try {
                source = context.createMediaStreamSource(remoteAudio.stream)
              } catch {
                element.muted = true
                void context.close().catch(() => undefined)
                return
              }
              const analyser = context.createAnalyser()
              analyser.fftSize = 256
              source.connect(analyser)
              remoteAnalyzersRef.current.set(remoteAudio.username, { context, source, analyser })
            }
            element.muted = outputMuted
            element.volume = outputVolume / 100
          }}
        />
      ))}

    </section>
  )
}
