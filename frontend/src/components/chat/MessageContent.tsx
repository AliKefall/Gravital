
import { useState } from "react"
import { API_BASE_URL } from "./constants"
import type { ChatMessage } from "./types"

interface MessageContentProps {
  message: ChatMessage
}

export const MessageContent = ({ message }: MessageContentProps) => {
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const kind = message.kind

  if (kind === "image" && message.media_url) {
    const source = `${API_BASE_URL}${message.media_url}`
    return (
      <>
        <figure className="message-media">
          <button
            type="button"
            className="message-image-trigger"
            onClick={() => setIsImagePreviewOpen(true)}
            title="Open image preview"
          >
            <img src={source} alt={message.file_name ?? "image"} />
          </button>
          <div className="message-media-actions">
            <button type="button" onClick={() => setIsImagePreviewOpen(true)}>
              Büyüt
            </button>
            <a href={source} download={message.file_name ?? true} target="_blank" rel="noreferrer">
              İndir
            </a>
          </div>
          {message.file_name && <figcaption>{message.file_name}</figcaption>}
        </figure>

        {isImagePreviewOpen && (
          <div
            className="image-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={() => setIsImagePreviewOpen(false)}
          >
            <div className="image-preview-content" onClick={(event) => event.stopPropagation()}>
              <header>
                <strong>{message.file_name ?? "Image preview"}</strong>
                <button type="button" onClick={() => setIsImagePreviewOpen(false)}>
                  Kapat
                </button>
              </header>
              <img src={source} alt={message.file_name ?? "image"} />
              <a href={source} download={message.file_name ?? true} target="_blank" rel="noreferrer">
                İndir
              </a>
            </div>
          </div>
        )}
      </>
    )
  }

  if (kind === "video" && message.media_url) {
    const source = `${API_BASE_URL}${message.media_url}`
    return (
      <figure className="message-media">
        <video controls preload="metadata">
          <source src={source} type={message.mime_type ?? "video/mp4"} />
          Your browser does not support video playback.
        </video>
        {message.file_name && <figcaption>{message.file_name}</figcaption>}
      </figure>
    )
  }

  if (kind === "file" && message.media_url) {
    const source = `${API_BASE_URL}${message.media_url}`

    const rarMimes = [
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/octet-stream",
    ]

    const isRar =
      rarMimes.includes(message.mime_type ?? "") ||
      message.file_name?.toLowerCase().endsWith(".rar")

    if (isRar) {
      return (
        <div className="message-file">
          <span>RAR</span>
          <a href={source} download target="_blank" rel="noreferrer">
            {message.file_name || "RAR file"}
          </a>
        </div>
      )
    }

    return (
      <a className="message-link" href={source} target="_blank" rel="noreferrer">
        {message.file_name ?? message.content ?? "Download file"}
      </a>
    )
  }

  const text = message.content ?? ""
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls = text.match(urlRegex)
  if (urls && urls.length > 0) {
    return (
      <div className="message-rich">
        <p>{text}</p>
        <a className="message-link" href={urls[0]} target="_blank" rel="noreferrer">
          Open link
        </a>
      </div>
    )
  }

  return <p>{text}</p>
}
