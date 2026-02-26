# 🛡️ VisionOS: Real-Time AI Camera Command Center

![VisionOS Banner](https://via.placeholder.com/1200x300/111827/3B82F6?text=VisionOS+Command+Center)

A distributed, full-stack security camera management dashboard. VisionOS leverages a microservices architecture to ingest RTSP video streams, transcode them for ultra-low latency WebRTC browser playback, and run parallel AI face-detection pipelines that broadcast real-time alerts via WebSockets.

## ✨ Key Features

* **Ultra-Low Latency Streaming:** Converts heavy RTSP camera streams into WebRTC for sub-second browser playback.
* **Dual-Pipeline AI Processing:** Utilizes a Go-based worker to extract 1-FPS frames and run lightweight Haar Cascade face detection without interrupting the main video feed.
* **Real-Time Alerting:** Pushes AI detection events to the frontend instantly via WebSockets.
* **Command & Control:** Remotely toggle video streams and AI processing on a per-camera basis.
* **Secure Vault:** Full JWT-based authentication for administrative access.

---

## 🏗️ System Architecture

VisionOS relies on four distinct microservices communicating in real-time:

1.  **The Infrastructure:** Dockerized PostgreSQL database and MediaMTX WebRTC server.
2.  **The API Gateway (Node.js/Hono):** Handles JWT auth, CRUD operations via Prisma, and broadcasts WebSocket messages to connected clients.
3.  **The AI Worker (Go):** Polls the backend, spins up FFmpeg processes to route video to MediaMTX, and runs `Pigo` face detection on extracted frames.
4.  **The Dashboard (React/Vite):** A dark-mode UI that negotiates WebRTC streams (WHEP) and maintains a live WebSocket connection for event logging.

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
* **Backend:** Node.js, Hono, Prisma ORM, WebSockets, JWT (bcryptjs)
* **Worker:** Go (Golang), FFmpeg, Pigo (Pure Go Face Detection)
* **Database & Media:** PostgreSQL, MediaMTX (Docker)

---

## 🚀 Getting Started

Because this is a microservices architecture, you will need to start the infrastructure, backend, worker, and frontend separately.

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.
* [Node.js](https://nodejs.org/) (v18+) & npm.
* [Go](https://go.dev/doc/install) (v1.20+).
* [FFmpeg](https://ffmpeg.org/download.html) installed and added to your system PATH.

### 1. Start the Infrastructure (Database & Media Server)
```bash
# In the root directory
docker-compose up -d
```

### 2. Start the Backend (API Gateway)
```bash
cd backend
npm install
npx prisma db push    # Sync the database schema
npx prisma generate   # Generate Prisma client
npm run dev           # Starts on http://localhost:3000
```

### 3. Start the AI Worker
```bash
cd worker
go mod tidy
go run main.go        # Starts polling the backend and managing FFmpeg
```

### 4. Start the Dashboard (Frontend)
```bash
cd frontend
npm install
npm run dev           # Starts on http://localhost:5173
```

### Usage Instructions

1. **Access the System:** Navigate to http://localhost:5173 and click "Register" to create your admin account. You will be automatically logged in.
2. **Add a Camera:** Click "Add Camera" in the top right.
3. **Test Stream:** To test the system without a physical IP camera, use this public MP4 stream link in the RTSP URL field:
```bash
http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
```

4. **Monitor:** Watch as the Go Worker spins up FFmpeg, the WebRTC video appears in your dashboard, and real-time AI alerts begin populating under the video feed!

### 🛡️ License
This project is for educational and portfolio purposes.