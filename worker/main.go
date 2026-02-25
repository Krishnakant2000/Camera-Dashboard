package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"net/http"
	"os/exec"
	"time"
)

type Camera struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	RTSPUrl string `json:"rtspUrl"`
	Status  string `json:"status"`
}

// Global map to keep track of running FFmpeg processes
var activeStreams = make(map[string]*exec.Cmd)

func main() {
	fmt.Println("🚀 Go Worker Started: Waiting for cameras...")

	for {
		fetchAndProcessCameras()
		time.Sleep(5 * time.Second)
	}
}

func fetchAndProcessCameras() {
	resp, err := http.Get("http://localhost:3000/cameras")
	if err != nil {
		fmt.Println("❌ Error connecting to Backend:", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	var cameras []Camera
	if err := json.Unmarshal(body, &cameras); err != nil {
		return
	}

	// Create a map of current camera IDs from the DB
	dbCameras := make(map[string]bool)

	for _, cam := range cameras {
		dbCameras[cam.ID] = true

		// If this camera is NOT in our activeStreams map, start it!
		if _, exists := activeStreams[cam.ID]; !exists {
			fmt.Printf("🎬 Starting stream for: %s\n", cam.Name)
			startStream(cam)
		}
	}

	// Cleanup: If a stream is running but was deleted from the DB, stop it
	for id, cmd := range activeStreams {
		if !dbCameras[id] {
			fmt.Printf("🛑 Stopping deleted camera stream: %s\n", id)
			cmd.Process.Kill()
			delete(activeStreams, id)
		}
	}
}

func startStream(cam Camera) {
	// The MediaMTX server is running on localhost:8554 via Docker
	mediaMtxURL := "rtsp://localhost:8554/" + cam.ID

	// Command: ffmpeg -stream_loop -1 -re -i [SOURCE]  -c:v libx264 -preset ultrafast -f rtsp [DESTINATION]
	cmd := exec.Command("ffmpeg", "-stream_loop", "-1", "-re", "-i", cam.RTSPUrl, "-c:v", "libx264", "-preset", "ultrafast", "-bf", "0", "-an", "-f", "rtsp", mediaMtxURL)
	// Save the command so we can kill it later if the user deletes the camera
	activeStreams[cam.ID] = cmd

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Start the process in the background
	err := cmd.Start()
	if err != nil {
		fmt.Printf("❌ Failed to start FFmpeg for %s: %v\n", cam.Name, err)
		delete(activeStreams, cam.ID)
		return
	}

	// Monitor the process to see if it crashes
	go func() {
		cmd.Wait()
		fmt.Printf("⚠️ Stream stopped for: %s\n", cam.Name)
		delete(activeStreams, cam.ID)
	}()
}