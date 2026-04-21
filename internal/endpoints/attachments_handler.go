package endpoints

import (
	"database/sql"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/endpoints/middlewares"
	"github.com/AliKefall/Gravital/internal/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// 100 MB is too much for production, also put limitations for each user,
// I only added them because I wanted to send a short movie to my other computer
// if you don't have any idea how much it would be great even 100MB is okay,
// But put maximum limitations for each user.
// You can change maximum limit of upload size from the environment.
const defaultMaxAttachmentUploadSize int64 = 100 << 20

type UploadAttachmentResponse struct {
	Message string `json:"message"`
	URL     string `json:"url"`
	Kind    string `json:"kind"`
}

func resolveUploadDir() string {
	uploadDir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	return uploadDir
}

func detectAttachmentKind(mimeType string) string {
	if strings.HasPrefix(mimeType, "image/") {
		return "image"
	}
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	return "file"
}

func isAllowedAttachmentMIME(mimeType string) bool {
	mimeType = normalizeMIME(mimeType)
	if strings.HasPrefix(mimeType, "image/") {
		return true
	}
	if strings.HasPrefix(mimeType, "video/") {
		return true
	}
	allowedDocs := map[string]bool{
		"application/pdf":              true,
		"text/plain":                   true,
		"application/x-rar-compressed": true,
		"application/vnd.rar":          true,
	}
	return allowedDocs[mimeType]
}

func normalizeMIME(value string) string {

	parsed, _, err := mime.ParseMediaType(strings.TrimSpace(value))
	if err == nil {
		return strings.ToLower(parsed)
	}
	return strings.ToLower(strings.TrimSpace(value))
}

func mimeFromExtension(filename string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(filename)))
	if ext == "" {
		return ""
	}

	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4", ".m4v":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".pdf":
		return "application/pdf"
	case ".txt":
		return "text/plain"
	case ".rar":
		return "application/x-rar-compressed"
	default:
		return ""
	}
}

func isAllowedAttachmentExtension(filename string) bool {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(filename)))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".m4v", ".webm", ".mov", ".pdf", ".txt", ".rar":
		return true
	default:
		return false
	}
}

func resolveAttachmentMIME(detected, multipartContentType, filename string) string {
	detected = normalizeMIME(detected)
	if isAllowedAttachmentMIME(detected) && detected != "application/octet-stream" {
		return detected
	}

	headerType := normalizeMIME(multipartContentType)
	if isAllowedAttachmentMIME(headerType) && headerType != "application/octet-stream" {
		return headerType
	}

	byExt := mimeFromExtension(filename)
	if isAllowedAttachmentMIME(byExt) {
		return byExt
	}

	return detected
}

func resolveMaxAttachmentUploadSize() int64 {
	raw := strings.TrimSpace(os.Getenv("MAX_ATTACHMENT_UPLOAD_SIZE_MB"))
	if raw == "" {
		return defaultMaxAttachmentUploadSize
	}
	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || parsed <= 0 {
		return defaultMaxAttachmentUploadSize
	}
	return parsed << 20
}

func (h *Handler) UploadAttachmentHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	username := middlewares.GetUsernameFromContext(r.Context())
	if userID == "" || username == "" {
		RespondWithError(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	roomID := strings.TrimSpace(chi.URLParam(r, "roomID"))
	if roomID == "" {
		RespondWithError(w, http.StatusBadRequest, "room id is required", nil)
		return
	}

	members, err := h.App.DB.ListActiveRoomMembersByRoomID(r.Context(), roomID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "failed to validate room membership", err)
		return
	}

	isMember := false
	for _, member := range members {
		if member.UserID == userID {
			isMember = true
			break
		}
	}
	if !isMember {
		RespondWithError(w, http.StatusForbidden, "you are not a member of this room", nil)
		return
	}
	maxAttachmentUploadSize := resolveMaxAttachmentUploadSize()
	r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentUploadSize)
	if err := r.ParseMultipartForm(maxAttachmentUploadSize); err != nil {
		RespondWithError(w, http.StatusBadRequest, "invalid file upload", err)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "file is required", err)
		return
	}
	defer file.Close()

	if header.Size <= 0 {
		RespondWithError(w, http.StatusBadRequest, "file can not be empty", nil)
		return
	}

	if !isAllowedAttachmentExtension(header.Filename) {
		RespondWithError(w, http.StatusBadRequest, "unsupported file extension", nil)
		return
	}

	buffer := make([]byte, 512)
	readBytes, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		RespondWithError(w, http.StatusBadRequest, "could not read uploaded file", err)
		return
	}

	detectedMimeType := http.DetectContentType(buffer[:readBytes])
	mimeType := resolveAttachmentMIME(detectedMimeType, header.Header.Get("Content-Type"), header.Filename)

	if !isAllowedAttachmentMIME(mimeType) {
		RespondWithError(w, http.StatusBadRequest, "unsupported file type", nil)
		return
	}

	if _, err := file.Seek(0, 0); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "could not process uploaded file", err)
		return
	}

	uploadDir := resolveUploadDir()
	if info, statErr := os.Stat(uploadDir); statErr == nil && !info.IsDir() {
		RespondWithError(w, http.StatusInternalServerError, "upload path exists but is not a directory", nil)
		return
	} else if statErr != nil && !os.IsNotExist(statErr) {
		RespondWithError(w, http.StatusInternalServerError, "could not inspect upload directory", statErr)
		return
	}

	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "could not initialize upload directory", err)
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))

	storedName := fmt.Sprintf("%s%s", uuid.NewString(), ext)
	storedPath := filepath.Join(uploadDir, storedName)

	destination, err := os.Create(storedPath)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "could not persist uploaded file", err)
		return
	}
	defer destination.Close()

	written, err := io.Copy(destination, file)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "could not save uploaded file", err)
		return
	}

	kind := detectAttachmentKind(mimeType)
	mediaURL := "/uploads/" + storedName
	createdAt := time.Now().UTC().Format(time.RFC3339)
	messageID := fmt.Sprintf("%s-%s", time.Now().UTC().Format("20060102150405.000000000"), userID)

	if err := h.App.DB.CreateChatMessage(r.Context(), db.CreateChatMessageParams{
		ID:             messageID,
		RoomID:         roomID,
		SenderID:       userID,
		SenderUsername: username,
		Content:        header.Filename,
		Kind:           kind,
		MediaUrl:       sql.NullString{String: mediaURL, Valid: true},
		MimeType:       sql.NullString{String: mimeType, Valid: true},
		FileName:       sql.NullString{String: header.Filename, Valid: true},
		FileSize:       written,
		CreatedAt:      createdAt,
	}); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "could not save attachment message", err)
		return
	}

	h.App.Hub.PublishRoomMessage(websocket.Message{
		Type:      websocket.TypeRoomMessage,
		RoomID:    roomID,
		From:      username,
		Content:   header.Filename,
		Kind:      kind,
		MediaURL:  mediaURL,
		MimeType:  mimeType,
		FileName:  header.Filename,
		FileSize:  written,
		TimeStamp: createdAt,
	})

	RespondWithJson(w, http.StatusCreated, UploadAttachmentResponse{
		Message: "attachment uploaded",
		URL:     mediaURL,
		Kind:    kind,
	})
}
