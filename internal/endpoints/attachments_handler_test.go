package endpoints

import "testing"

func TestResolveAttachmentMIME(t *testing.T) {
	tests := []struct {
		name                 string
		detected             string
		multipartContentType string
		filename             string
		want                 string
	}{
		{
			name:                 "uses detected mime when valid",
			detected:             "image/png",
			multipartContentType: "application/octet-stream",
			filename:             "sample.png",
			want:                 "image/png",
		},
		{
			name:                 "falls back to multipart content type",
			detected:             "application/octet-stream",
			multipartContentType: "video/mp4",
			filename:             "video.bin",
			want:                 "video/mp4",
		},
		{
			name:                 "falls back to extension when needed",
			detected:             "application/octet-stream",
			multipartContentType: "application/octet-stream",
			filename:             "camera_upload.MP4",
			want:                 "video/mp4",
		},
		{
			name:                 "normalizes content type params",
			detected:             "application/octet-stream",
			multipartContentType: "video/mp4; charset=utf-8",
			filename:             "clip.unknown",
			want:                 "video/mp4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveAttachmentMIME(tt.detected, tt.multipartContentType, tt.filename)
			if got != tt.want {
				t.Fatalf("resolveAttachmentMIME() = %q, want %q", got, tt.want)
			}
		})
	}
}
