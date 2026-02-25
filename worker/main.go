package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"time"

	pigo "github.com/esimov/pigo/core"
)

type Camera struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	RTSPUrl string `json:"rtspUrl"`
	Status  string `json:"status"`
}

var activeStreams = make(map[string]*exec.Cmd)
var activeAI = make(map[string]*exec.Cmd)
var classifier *pigo.Pigo

func main() {
	fmt.Println("🚀 Initializing AI Worker...")
	setupAI()

	// Create a folder for our temporary 1-FPS images
	os.MkdirAll("frames", os.ModePerm)

	fmt.Println("📡 Waiting for cameras...")
	for {
		fetchAndProcessCameras()
		time.Sleep(5 * time.Second)
	}
}

// --- AI SETUP & DOWNLOADING ---
func setupAI() {
	cascadeFile := "cascades/facefinder"
	os.MkdirAll("cascades", os.ModePerm)

	// If the brain doesn't exist, download it
	if _, err := os.Stat(cascadeFile); os.IsNotExist(err) {
		fmt.Println("🧠 Downloading AI Face Cascade Model...")
		resp, _ := http.Get("https://raw.githubusercontent.com/esimov/pigo/master/cascade/facefinder")
		defer resp.Body.Close()
		out, _ := os.Create(cascadeFile)
		defer out.Close()
		io.Copy(out, resp.Body)
		fmt.Println("✅ AI Model downloaded!")
	}

	// Load the brain into memory
	cascade, err := os.ReadFile(cascadeFile)
	if err != nil {
		panic("Failed to read cascade file")
	}

	p := pigo.NewPigo()
	classifier, err = p.Unpack(cascade)
	if err != nil {
		panic("Failed to unpack cascade file")
	}
	fmt.Println("✅ AI Classifier Ready.")
}

// --- POLLING NODE.JS API ---
func fetchAndProcessCameras() {
	resp, err := http.Get("http://localhost:3000/cameras")
	if err != nil {
		fmt.Println("❌ Error connecting to Backend:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var cameras []Camera
	json.Unmarshal(body, &cameras)

	dbCameras := make(map[string]bool)

	for _, cam := range cameras {
		dbCameras[cam.ID] = true

		if _, exists := activeStreams[cam.ID]; !exists {
			fmt.Printf("🎬 Starting Video Stream: %s\n", cam.Name)
			startStream(cam)
			
			fmt.Printf("🤖 Starting AI Pipeline: %s\n", cam.Name)
			startAIPipeline(cam)
		}
	}

	for id, cmd := range activeStreams {
		if !dbCameras[id] {
			cmd.Process.Kill()
			delete(activeStreams, id)
			
			if aiCmd, ok := activeAI[id]; ok {
				aiCmd.Process.Kill()
				delete(activeAI, id)
			}
		}
	}
}

// --- PIPELINE 1: LIVE VIDEO ---
func startStream(cam Camera) {
	mediaMtxURL := "rtsp://localhost:8554/" + cam.ID
	cmd := exec.Command("ffmpeg", "-stream_loop", "-1", "-re", "-i", cam.RTSPUrl, "-c:v", "libx264", "-preset", "ultrafast", "-bf", "0", "-an", "-f", "rtsp", mediaMtxURL)
	activeStreams[cam.ID] = cmd
	cmd.Start()
}

// --- PIPELINE 2: AI FACE DETECTION ---
func startAIPipeline(cam Camera) {
	framePath := fmt.Sprintf("frames/%s.jpg", cam.ID)

	// FFmpeg extracts 1 frame per second (-r 1) and constantly overwrites the same .jpg file (-update 1)
	cmd := exec.Command("ffmpeg", "-stream_loop", "-1", "-i", cam.RTSPUrl, "-r", "1", "-update", "1", "-y", framePath)
	activeAI[cam.ID] = cmd
	cmd.Start()

	// Start a Go routine to analyze that picture every second
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		for range ticker.C {
			// If the camera was deleted, stop analyzing
			if _, exists := activeAI[cam.ID]; !exists {
				ticker.Stop()
				return
			}

			// Read the extracted frame
			imgBytes, err := os.ReadFile(framePath)
			if err != nil {
				continue // File might not be written yet
			}

			// Run Face Detection
			detectFaces(cam, imgBytes)
		}
	}()
}

// --- THE DETECTOR ---
func detectFaces(cam Camera, imgBytes []byte) {
	// Pigo requires the image to be converted to a specific format
	cParams := pigo.CascadeParams{
		MinSize:     50,
		MaxSize:     1000,
		ShiftFactor: 0.1,
		ScaleFactor: 1.1,
		ImageParams: pigo.ImageParams{
			Pixels: imgBytes,
			Rows:   480, // Default fallback
			Cols:   640, // Default fallback
			Dim:    640,
		},
	}

	// Because we are reading raw bytes, we need to decode them
	img, err := pigo.DecodeImage(bytes.NewReader(imgBytes))
	if err != nil {
		return
	}

	// Update params with actual image dimensions
	cParams.Pixels = pigo.RgbToGrayscale(img)
	cParams.Cols, cParams.Rows = img.Bounds().Max.X, img.Bounds().Max.Y
	cParams.Dim = cParams.Cols

	// Search for faces!
	dets := classifier.RunCascade(cParams, 0)
	dets = classifier.ClusterDetections(dets, 0.2) // Group overlapping detections

	if len(dets) > 0 {
		fmt.Printf("🚨 ALERT! Found %d face(s) on %s\n", len(dets), cam.Name)
		sendAlertToBackend(cam.ID, fmt.Sprintf("Detected %d face(s)", len(dets)))
	}
}

// --- SEND TO NODE.JS ---
func sendAlertToBackend(cameraId string, message string) {
	payload := map[string]string{
		"cameraId": cameraId,
		"message":  message,
	}
	jsonData, _ := json.Marshal(payload)

	http.Post("http://localhost:3000/alerts", "application/json", bytes.NewBuffer(jsonData))
}