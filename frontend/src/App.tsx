import { useState, useEffect } from 'react';
import { Camera as CameraIcon, Plus, Activity, LayoutGrid, Trash2 } from 'lucide-react';
import type { Alert, Camera } from './types';
import AddCameraModal from './components/AddCameraModal';
import WebRTCPlayer from './components/WebRTCPlayer';

function App() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch cameras from our Hono Backend
  const fetchCameras = async () => {
    try {
      const res = await fetch('http://localhost:3000/cameras');
      const data = await res.json();
      setCameras(data);
    } catch (error) {
      console.error("Failed to fetch cameras:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for Real-Time Alerts via WebSockets
  useEffect(() => {
    // Connect to the Hono WebSocket route
    const ws = new WebSocket('ws://localhost:3000/ws');

    ws.onopen = () => console.log('🟢 Connected to AI Alert Stream');

    ws.onmessage = (event) => {
      const newAlert = JSON.parse(event.data);
      console.log("🚨 Received Alert:", newAlert);

      // Add the new alert to the top of our list
      setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
    };

    ws.onclose = () => console.log('🔴 Disconnected from Alert Stream');

    // Cleanup when component unmounts
    return () => {
      ws.close();
    };
  }, []);

  // Delete a camera
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this camera?")) return;

    try {
      const res = await fetch(`http://localhost:3000/cameras/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchCameras(); // Refresh the grid to remove the deleted camera
      }
    } catch (error) {
      console.error("Failed to delete camera:", error);
    }
  };

  // Run once when the app loads
  useEffect(() => {
    fetchCameras();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">

      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
        <div className="flex items-center gap-3 mb-8 px-2 text-blue-400">
          <Activity size={28} />
          <h1 className="text-xl font-bold text-white">Camera Dashboard</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/10 text-blue-400 rounded-lg transition-colors">
            <LayoutGrid size={20} />
            <span className="font-medium">Live Grid</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 text-gray-400 hover:text-gray-200 rounded-lg transition-colors">
            <CameraIcon size={20} />
            <span className="font-medium">All Cameras</span>
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col">

        {/* TOP NAVBAR */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-gray-900/50">
          <h2 className="text-lg font-semibold">Live Camera Feeds</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors">
            <Plus size={18} />
            Add Camera
          </button>
        </header>

        {/* CAMERA GRID */}
        <div className="p-8 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : cameras.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CameraIcon size={64} className="mb-4 opacity-20" />
              <p className="text-xl font-medium text-gray-400">No cameras configured</p>
              <p className="mt-2 text-sm">Click 'Add Camera' to register your first stream.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {cameras.map((cam) => (
                <div key={cam.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
                  {/* LIVE VIDEO PLAYER */}
                  <div className="aspect-video bg-black relative flex items-center justify-center border-b border-gray-800">
                    <WebRTCPlayer cameraId={cam.id} />
                    {/* Live Indicator overlay */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 px-2 py-1 rounded text-xs font-bold tracking-widest text-green-500">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      LIVE
                    </div>
                  </div>

                  {/* CAMERA CARD FOOTER */}
                  <div className="p-4 flex items-center justify-between border-b border-gray-800">
                    <div>
                      <h3 className="font-medium text-gray-200">{cam.name}</h3>
                      <p className="text-xs text-gray-500">{cam.location || 'Unknown location'}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(cam.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* REAL-TIME ALERTS FEED */}
                  <div className="p-4 bg-gray-900/50 h-32 overflow-y-auto">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                      <Activity size={14} /> Recent Detections
                    </h4>

                    <div className="space-y-2">
                      {/* Filter alerts for this specific camera and show the 3 most recent */}
                      {alerts
                        .filter((a) => a.cameraId === cam.id)
                        .slice(0, 3)
                        .map((alert) => (
                          <div key={alert.id} className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-md animate-pulse">
                            <span className="font-bold">{alert.message}</span>
                            <span className="text-xs text-red-400/70 block mt-0.5">
                              {new Date(alert.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}

                      {/* Empty state if no alerts yet */}
                      {alerts.filter((a) => a.cameraId === cam.id).length === 0 && (
                        <p className="text-xs text-gray-600 italic">No recent activity</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <AddCameraModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchCameras}
      />
    </div>
  );
}

export default App;