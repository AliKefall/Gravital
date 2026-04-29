
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
  language: "en" | "tr"
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
  language,
}: WorkspaceChatPanelProps) => {
  const isEnglish = language === "en"
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
  const noiseGateStateRef = useRef<Map<string, { mutedByGate: boolean; lastActiveAt: number }>>(new Map())
  const visibleRemoteScreens = useMemo(
    () => remoteScreens.filter((screen) => !screen.roomId || screen.roomId === activeRoom),
    [activeRoom, remoteScreens],
  )
  const selectedScreen = selectedScreenUser ? visibleRemoteScreens.find((screen) => screen.username === selectedScreenUser) : null

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
        if (!element) return
        const now = Date.now()
        const current = noiseGateStateRef.current.get(username) ?? { mutedByGate: false, lastActiveAt: now }
        const releaseThreshold = noiseGateDb + 4
        if (db > releaseThreshold) current.lastActiveAt = now
        if (db < noiseGateDb && now - current.lastActiveAt > 350) current.mutedByGate = true
        if (db > releaseThreshold) current.mutedByGate = false
        noiseGateStateRef.current.set(username, current)
        element.muted = outputMuted || current.mutedByGate
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
    () => Object.values(streamStatsByUser).filter((stats) => !activeRoom || stats.roomId === activeRoom).sort((a, b) => a.username.localeCompare(b.username)),
    [activeRoom, streamStatsByUser],
  )
  const pendingScreenSharers = useMemo(() => {
    const renderedUsers = new Set<string>(visibleRemoteScreens.map((item) => item.username))
    if (localPreviewScreen) renderedUsers.add(localPreviewScreen.username)
    return activeRoomScreenSharers.filter((member) => !renderedUsers.has(member))
  }, [activeRoomScreenSharers, localPreviewScreen, visibleRemoteScreens])

  const connectionQuality = useMemo<"good" | "medium" | "poor" | "unknown">(() => {
    if (streamStatsRows.length === 0) return "unknown"
    if (streamStatsRows.some((row) => row.networkQuality === "poor")) return "poor"
    if (streamStatsRows.some((row) => row.networkQuality === "degraded" || row.networkQuality === "fair")) return "medium"
    return "good"
  }, [streamStatsRows])

  const connectionQualityLabel = connectionQuality === "unknown"
    ? (isEnglish ? "No data" : "Veri yok")
    : connectionQuality === "good"
      ? (isEnglish ? "Good" : "İyi")
      : connectionQuality === "medium"
        ? (isEnglish ? "Medium" : "Orta")
        : (isEnglish ? "Poor" : "Zayıf")

  return (
    <section className="chat-panel">
      <header className="chat-header compact-chat-header">
        <div>
          <h1>{activeDirectFriend ? `#${activeDirectFriend}` : activeRoom ? `#${activeRoom}` : (isEnglish ? "No room selected" : "Oda seçilmedi")}</h1>
          <p>{status === "online" ? (isEnglish ? "Live" : "Canlı") : status === "connecting" ? (isEnglish ? "Connecting" : "Bağlanıyor") : status === "reconnecting" ? (isEnglish ? "Reconnecting" : "Yeniden bağlanıyor") : (isEnglish ? "Offline" : "Çevrimdışı")}</p>
        </div>

        <div className="header-actions compact-actions">
          <button className={`secondary icon-button ${activeTab === "chat" ? "active-tab" : ""}`} onClick={() => setActiveTab("chat")}>
            <AppIcon name="chat" />
            <span>Chat</span>
          </button>
          <button className={`secondary ${activeTab === "audio" ? "active-tab" : ""}`} onClick={() => setActiveTab("audio")} title="Audio settings">
            <AppIcon name="audio" />
            <span>{isEnglish ? "Audio" : "Ses"}</span>
          </button>
          <button className="secondary" onClick={onToggleVoice} disabled={status !== "online" || !activeRoom || isJoiningVoice}>
            <AppIcon name="voice" />
            <span>{isJoiningVoice ? (isEnglish ? "Connecting..." : "Bağlanıyor...") : voiceConnected ? (isEnglish ? "Leave Voice" : "Sesten Ayrıl") : (isEnglish ? "Join Voice" : "Sese Katıl")}</span>
          </button>
          <button className="secondary" onClick={onToggleMic} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="mic" />
            <span>{micMuted ? (isEnglish ? "Unmute Mic" : "Mikrofonu Aç") : (isEnglish ? "Mute Mic" : "Mikrofonu Kapat")}</span>
          </button>
          <button className="secondary" onClick={onToggleOutput} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="speaker" />
            <span>{outputMuted ? (isEnglish ? "Unmute Output" : "Sesi Aç") : (isEnglish ? "Mute Output" : "Sesi Kapat")}</span>
          </button>
          <button className="secondary" onClick={onToggleScreenShare} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="screen" />
            <span>{screenSharing ? (isEnglish ? "Stop Sharing" : "Paylaşımı Durdur") : (isEnglish ? "Share Screen" : "Ekran Paylaş")}</span>
          </button>
          <button className="secondary" onClick={onToggleCameraShare} disabled={status !== "online" || !activeRoom || !voiceConnected}>
            <AppIcon name="camera" />
            <span>{cameraSharing ? (isEnglish ? "Stop Camera" : "Kamerayı Durdur") : (isEnglish ? "Share Camera" : "Kamera Paylaş")}</span>
          </button>
          <button
            className="secondary"
            onClick={onLeaveRoom}
            disabled={status !== "online" || !activeRoom || isActiveRoomOwner}
            title={!activeRoom ? "Select a room first" : isActiveRoomOwner ? "Room owner cannot leave room" : undefined}
          >
            <AppIcon name="leave" />
            <span>{isEnglish ? "Leave Room" : "Odadan Ayrıl"}</span>
          </button>
          <button
            className="secondary"
            onClick={onCloseRoom}
            disabled={!isActiveRoomOwner || status !== "online"}
            title={!activeRoom ? "Select a room first" : !isActiveRoomOwner ? "Only the room owner can close the room" : undefined}
          >
            <AppIcon name="trash" />
            <span>{isEnglish ? "Close Room" : "Odayı Kapat"}</span>
          </button>
          <button className="danger" onClick={() => void onLogout()}>
            <AppIcon name="logout" />
            <span>{isEnglish ? "Logout" : "Çıkış"}</span>
          </button>
        </div>
      </header>

      <div className="chat-kpi-row modern-kpi-row">
        <article className="kpi-card">
          <span>{isEnglish ? "Total messages" : "Toplam mesaj"}</span>
          <strong>{visibleMessages.length}</strong>
        </article>
        <article className="kpi-card">
          <span>{isEnglish ? "System notices" : "Sistem bildirimi"}</span>
          <strong>{systemMessageCount}</strong>
        </article>
        <article className="kpi-card">
          <span>{isEnglish ? "Live participants" : "Canlı katılımcı"}</span>
          <strong>{activeRoomMeta?.activeUsers.length ?? 0}</strong>
        </article>
        <article className="kpi-card">
          <span>{isEnglish ? "Connection quality" : "Bağlantı kalitesi"}</span>
          <strong className={`network-chip ${connectionQuality}`}>{connectionQualityLabel}</strong>
        </article>
      </div>

      {activeTab === "chat" ? (
        <section className="chat-tab-layout">
          <section className="screen-share-area">
            <header className="screen-share-header">
              <h3>{isEnglish ? "Screen Share Window" : "Ekran Paylaşım Penceresi"}</h3>
              <p>{isCurrentUserSharingScreen ? (isEnglish ? "You are sharing your screen now." : "Şu anda ekranınızı paylaşıyorsunuz.") : (isEnglish ? "Screen share is off." : "Ekran paylaşımı kapalı.")}</p>
            </header>
            <button className="secondary metrics-toggle" onClick={() => setShowLiveMetrics((prev) => !prev)}>
              <AppIcon name="search" />
              <span>{showLiveMetrics ? (isEnglish ? "Hide live metrics" : "Canlı metrikleri gizle") : (isEnglish ? "Show live metrics" : "Canlı metrikleri göster")}</span>
            </button>
            <div className="screen-share-stats">
              <p><strong>{isEnglish ? "Voice participants:" : "Ses katılımcıları:"}</strong> {remoteAudios.length}</p>
              <p><strong>{isEnglish ? "Screen sharing:" : "Ekran paylaşanlar:"}</strong> {activeRoomScreenSharers.length}</p>
              <p><strong>{isEnglish ? "Room owner:" : "Oda sahibi:"}</strong> @{activeRoomMeta?.owner || "unknown"}</p>
            </div>

            <ul className="screen-share-users">
              {activeRoomScreenSharers.length === 0 ? (
                <li>{isEnglish ? "No one is sharing screen in this room right now." : "Bu odada şu anda kimse ekran paylaşmıyor."}</li>
              ) : (
                activeRoomScreenSharers.map((member) => <li key={`screen-sharer-${member}`}>@{member}</li>)
              )}
            </ul>

            <div className="screen-grid">
              {localPreviewScreen && (
                <article className="screen-card">
                  <div className="screen-card-header">
                    <h4>@{localPreviewScreen.username} ({isEnglish ? "You" : "Sen"})</h4>
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
              {visibleRemoteScreens.map((remoteScreen) => (
                <article key={remoteScreen.username} className="screen-card">
                  <div className="screen-card-header">
                    <h4>@{remoteScreen.username}</h4>
                    <button className="secondary" onClick={() => onSelectedScreenUser(remoteScreen.username)}>
                      <AppIcon name="screen" />
                      <span>{isEnglish ? "Resize" : "Büyüt"}</span>
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
                    <span>{isEnglish ? "Broadcast is active, stream is connecting..." : "Yayın aktif, akış bağlanıyor..."}</span>
                  </div>
                </article>
              ))}
            </div>
            {showLiveMetrics && <section className="stream-metrics-panel">
              <h4>{isEnglish ? "Connection route monitor (UDP/TURN/P2P)" : "Bağlantı rota monitörü (UDP/TURN/P2P)"}</h4>
              <p>{isEnglish ? "Track active ICE route, protocol (UDP/TCP/TLS), and relay state for each peer." : "Her eş için aktif ICE rotasını, protokolü (UDP/TCP/TLS) ve relay durumunu izleyin."}</p>
              {Object.entries(connectionDiagnosticsByUser).length === 0 ? (
                <p>{isEnglish ? "No connection diagnostics yet. Join voice and wait to connect with another user." : "Henüz bağlantı tanılaması yok. Sese katılın ve başka bir kullanıcıyla bağlanmayı bekleyin."}</p>
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
              <h4>{isEnglish ? "Live streaming metrics" : "Canlı yayın metrikleri"}</h4>
              <p>{isEnglish ? "Monitor latency and connection quality for webcam/screen streams." : "Webcam/ekran akışları için gecikme ve bağlantı kalitesini izleyin."}</p>
              {streamStatsRows.length === 0 ? (
                <p>{isEnglish ? "No stream metrics yet. Join voice and start webcam/screen sharing." : "Henüz akış metriği yok. Sese katılın ve webcam/ekran paylaşımını başlatın."}</p>
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
                          <td>{Number.isFinite(stats.latencyMs) ? `${Math.round(stats.latencyMs)} ms` : "-"}</td>
                          <td>{Number.isFinite(stats.fps) ? stats.fps.toFixed(1) : "-"}</td>
                          <td>{Number.isFinite(stats.bitrateKbps) ? `${stats.bitrateKbps.toFixed(0)} kbps` : "-"}</td>
                          <td>{Number.isFinite(stats.audioBitrateKbps) ? `${stats.audioBitrateKbps.toFixed(0)} kbps` : "-"}</td>
                          <td>{Number.isFinite(stats.packetLossPct) ? `${stats.packetLossPct.toFixed(1)}%` : "-"}</td>
                          <td>{Number.isFinite(stats.jitterMs) ? `${stats.jitterMs.toFixed(1)} ms` : "-"}</td>
                          <td>{Number.isFinite(stats.availableOutgoingKbps) ? `${stats.availableOutgoingKbps.toFixed(0)} kbps` : "-"}</td>
                          <td>{stats.qualityLimitationReason}</td>
                          <td>{stats.width > 0 && stats.height > 0 ? `${stats.width}x${stats.height}` : "-"}</td>
                          <td>{stats.networkQuality}</td>
                          <td>{Number.isFinite(stats.targetBitrateKbps) ? `${stats.targetBitrateKbps.toFixed(0)} kbps` : "-"}</td>
                          <td>{Number.isFinite(stats.frameDropPct) ? `${stats.frameDropPct.toFixed(1)}%` : "-"}</td>
                          <td>{stats.encoderImplementation}</td>
                          <td>{Number.isFinite(stats.encodeMs) ? `${stats.encodeMs.toFixed(2)} ms` : "-"}</td>
                          <td>{stats.retransmittedPackets}/{stats.packetsSent}</td>
                          <td>{stats.freezeCount} / {Number.isFinite(stats.totalFreezesDurationMs) ? stats.totalFreezesDurationMs.toFixed(0) : "-"} ms</td>
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
                <MessageContent message={message} language={language} />
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
              <span>{isEnglish ? "Send" : "Gönder"}</span>
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
          <h3>{isEnglish ? "Voice & Audio Settings" : "Ses Ayarları"}</h3>
          <p>{isEnglish ? "Manage your microphone, speaker and levels in a cleaner layout." : "Mikrofon, hoparlör ve seviye ayarlarınızı burada yönetin."}</p>
          <label>
            {isEnglish ? "Microphone" : "Mikrofon"}
            <select value={selectedInputId} onChange={(event) => setSelectedInputId(event.target.value)}>
              {audioInputs.length === 0 ? (
                <option value="">Default microphone</option>
              ) : (
                audioInputs.map((device, index) => <option key={`${device.deviceId}-${index}`} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)
              )}
            </select>
          </label>

          <label>
            {isEnglish ? "Speaker / Headphones" : "Hoparlör / Kulaklık"}
            <select value={selectedOutputId} onChange={(event) => setSelectedOutputId(event.target.value)}>
              {audioOutputs.length === 0 ? (
                <option value="">Default output</option>
              ) : (
                audioOutputs.map((device, index) => <option key={`${device.deviceId}-${index}`} value={device.deviceId}>{device.label || `Output ${index + 1}`}</option>)
              )}
            </select>
          </label>

          <div className="audio-grid modern-audio-grid">
            <article className="audio-control-card">
              <strong>{isEnglish ? "Output Volume" : "Çıkış Sesi"}</strong>
              <span>{outputVolume}%</span>
              <input type="range" min={0} max={100} value={outputVolume} onChange={(event) => onOutputVolumeChange(Number(event.target.value))} />
            </article>
            <article className="audio-control-card">
              <strong>{isEnglish ? "Mic Volume" : "Mikrofon Seviyesi"}</strong>
              <span>{micVolume}%</span>
              <input type="range" min={0} max={100} value={micVolume} onChange={(event) => onMicVolumeChange(Number(event.target.value))} />
            </article>
            <article className="audio-control-card" style={{ gridColumn: "1 / -1" }}>
              <strong>{isEnglish ? "Noise Gate" : "Gürültü Eşiği"}</strong>
              <span>{noiseGateDb} dB</span>
              <input type="range" min={-80} max={0} value={noiseGateDb} onChange={(event) => onNoiseGateDbChange(Number(event.target.value))} />
            </article>
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
