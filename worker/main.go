package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// We define a struct that matches the JSON from our Node API
type Camera struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	RTSPUrl  string `json:"rtspUrl"`
	Status   string `json:"status"`
}

func main() {
	fmt.Println("🚀 Go Worker Started: Waiting for cameras...")

	// Create an infinite loop that checks for new cameras every 5 seconds
	for {
		fetchAndProcessCameras()
		time.Sleep(5 * time.Second)
	}
}

func fetchAndProcessCameras() {
	// 1. Call the Node.js API
	resp, err := http.Get("http://localhost:3000/cameras")
	if err != nil {
		fmt.Println("❌ Error connecting to Backend API:", err)
		return
	}
	defer resp.Body.Close()

	// 2. Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("❌ Error reading response:", err)
		return
	}

	// 3. Convert JSON into our Go struct
	var cameras []Camera
	if err := json.Unmarshal(body, &cameras); err != nil {
		fmt.Println("❌ Error parsing JSON:", err)
		return
	}

	// 4. Print what we found
	fmt.Printf("✅ Found %d active cameras in the database.\n", len(cameras))
	for _, cam := range cameras {
		fmt.Printf("   -> Processing Camera: %s (URL: %s)\n", cam.Name, cam.RTSPUrl)
	}
	fmt.Println("---------------------------------------------------")
}