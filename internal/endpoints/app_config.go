package endpoints

import "github.com/AliKefall/Gravital/internal/app"

// This is a bad design I know it but for now this fixes my problem. I will change this ASAP after I finished with tests.

type Handler struct {
	App *app.App
}
