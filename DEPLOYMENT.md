# Gravital Deployment Notlari

Bu dokuman, projede su ana kadar kullanilan canliya alim (deploy) yapisini tek yerde toplar.

## 1) Mimari Ozet

- **Frontend**: Vite ile build edilmis statik dosyalar, `frontend/dist` altinda uretilir ve Nginx ile servis edilir.
- **Backend**: Go server (`server/cmd`) `gravital-server` binary olarak calisir.
- **WebSocket**: `/ws` yolu Nginx uzerinden backend'e proxy edilir.
- **Dosya Yukleme**: Backend `UPLOAD_DIR` dizinine yazar, Nginx API domain'i uzerinden backend'e yonlendirir.
- **WebRTC**: Frontend ICE listesi `VITE_STUN_URLS` + `VITE_TURN_URLS` ile gelir; TURN icin coturn kullanilir.
- **Tunnel/CDN (opsiyonel)**: Cloudflared ile domainler origin'e baglanir.

## 2) Sunucu Uzerinde Yerlesim (onerilen)

- Repo: `/opt/gravital` (veya tek bir sabit dizin)
- Backend binary: `/usr/local/bin/gravital-server`
- Backend env: `/opt/gravital/.env`
- Frontend build cikisi: `/opt/gravital/frontend/dist`
- Upload dizini: `/var/www/gravital-uploads`
- Systemd servis dosyasi: `/etc/systemd/system/gravital-backend.service`
- Nginx site dosyasi: `/etc/nginx/sites-available/gravitall.conf`
- Coturn config: `/etc/turnserver.conf`
- Cloudflared config: `/etc/cloudflared/config.yml`

## 3) Backend Environment (.env)

Backend, `server/cmd/server_config.go` icinde su degiskenleri okur:

- `PORT` (ornek: `8080`)
- `DATABASE_URL` (libsql/turso adresi)
- `DB_AUTH_TOKEN` (turso token)
- `JWT_SECRET` (uzun, tahmin edilmesi zor secret)
- `CORS_ALLOWED_ORIGINS` (virgulle ayrilmis liste)
- `UPLOAD_DIR` (handler tarafinda dosya yazma dizini)

Ornek:

```env
PORT=8080
DATABASE_URL=libsql://<db-host>
DB_AUTH_TOKEN=<secret>
JWT_SECRET=<secret>
CORS_ALLOWED_ORIGINS=https://gravitall.today,https://www.gravitall.today
UPLOAD_DIR=/var/www/gravital-uploads
```

> Not: Gercek secret'lar repoya yazilmaz. Uretim degerlerini sadece sunucuda tut.

## 4) Frontend Environment (`frontend/.env.production`)

- `VITE_API_BASE_URL` (ornek: `https://api.gravitall.today`)
- `VITE_WS_BASE_URL` (ornek: `wss://api.gravitall.today/ws`)
- `VITE_STUN_URLS` (virgulle ayrilmis)
- `VITE_TURN_URLS` (virgulle ayrilmis, turn/turns)
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

Ornek:

```env
VITE_API_BASE_URL=https://api.gravitall.today
VITE_WS_BASE_URL=wss://api.gravitall.today/ws
VITE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
VITE_TURN_URLS=turn:turn.gravitall.today:3478?transport=udp,turns:turn.gravitall.today:5349?transport=tcp
VITE_TURN_USERNAME=<turn-user>
VITE_TURN_CREDENTIAL=<turn-pass>
```

## 5) Systemd: Backend Servisi

`/etc/systemd/system/gravital-backend.service`:

- `EnvironmentFile=/opt/gravital/.env`
- `ExecStart=/usr/local/bin/gravital-server`
- `User/Group`: `www-data` (veya dedike servis kullanicisi)
- `Restart=always`

Degisiklik sonrasi:

```bash
sudo systemctl daemon-reload
sudo systemctl restart gravital-backend
sudo systemctl status gravital-backend --no-pager
```

## 6) Nginx: Frontend + API + WebSocket

Iki server block mantigi:

1. `gravitall.today` + `www.gravitall.today`:
   - `root /opt/gravital/frontend/dist`
   - SPA fallback: `try_files $uri /index.html`

2. `api.gravitall.today`:
   - `/ws` -> `http://127.0.0.1:8080/ws`
   - diger yollar -> `http://127.0.0.1:8080`
   - websocket icin `Upgrade` + `Connection` header'lari

Test ve reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7) coturn (TURN) Kurulumu

WebRTC'nin NAT arkasinda daha stabil calismasi icin:

- Paket: `coturn`
- Config: `/etc/turnserver.conf`
- Portlar:
  - 3478 (TURN TCP/UDP)
  - 5349 (TURNS TLS)
  - relay araligi: ornek `49160-49200` TCP/UDP
- `realm` ve `server-name` TURN domain ile ayni olmali.
- TLS icin sertifika yollari dogru olmali (`cert`, `pkey`).

Servis:

```bash
echo 'TURNSERVER_ENABLED=1' | sudo tee /etc/default/coturn
sudo systemctl enable --now coturn
sudo systemctl status coturn --no-pager
```

## 8) Firewall Kontrol Listesi

Acik olmasi gereken tipik portlar:

- 22/tcp (SSH)
- 80/tcp (HTTP - redirect/ACME)
- 443/tcp (HTTPS)
- 3478/tcp + 3478/udp (TURN)
- 5349/tcp (TURNS)
- 49160-49200 tcp/udp (TURN relay)

## 9) Deploy Akisi (Pratik)

1. Repo guncelle:
   ```bash
   cd /opt/gravital && git pull
   ```
2. Frontend build:
   ```bash
   cd /opt/gravital/frontend && npm ci && npm run build
   ```
3. Backend build:
   ```bash
   cd /opt/gravital && go build -o /tmp/gravital-server ./server/cmd
   sudo mv /tmp/gravital-server /usr/local/bin/gravital-server
   sudo chmod +x /usr/local/bin/gravital-server
   ```
4. Servisleri yenile:
   ```bash
   sudo systemctl restart gravital-backend
   sudo systemctl reload nginx
   ```
5. Health check:
   ```bash
   curl -i https://api.gravitall.today/health
   ```

## 10) Sık Hata Senaryolari

- **WebSocket baglanmiyor**: Nginx `/ws` blokunda upgrade header eksik olabilir.
- **WebRTC goruntu/ses tek yonlu**: TURN bilgileri veya relay portlari/firewall kapali olabilir.
- **401/403**: `JWT_SECRET` farkli ortamlarda ayni degilse tokenlar gecersiz olur.
- **CORS hatasi**: `CORS_ALLOWED_ORIGINS` domain listesini kontrol et.
- **Dosya upload calismiyor**: `UPLOAD_DIR` izinleri (owner/group) yanlis olabilir.

## 11) CSP (Opera/Cloudflare) Uyarilari

Opera/Chromium tabanli tarayicilarda su tur loglar gorulebilir:
- `script-src` / `connect-src 'none'` report-only ihlalleri
- `chrome-extension://... Unexpected token 'export'`

Bu loglarin onemli bir kismi tarayici eklentilerinden veya Cloudflare challenge scriptlerinden gelebilir. Uretimde Nginx tarafinda acik bir CSP tanimi kullanin:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://gravitall.today; script-src-elem 'self' https://static.cloudflareinsights.com https://gravitall.today; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" always;
```

Notlar:
- `connect-src 'none'` kesinlikle kullanmayin; API/WebSocket baglantisini keser.
- Report-only modundan enforce moda gecmeden once staging ortaminda test edin.
- Eklenti kaynakli `chrome-extension://` hatalari uygulama kodundan bagimsiz olabilir.
