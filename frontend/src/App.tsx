import { useState, useEffect } from 'react';
import { Camera as CameraIcon, Plus, Activity, LayoutGrid, Trash2, Brain, Power } from 'lucide-react';
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
                <div key={cam.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col group transition-all hover:border-gray-700">

                  {/* VIDEO PLAYER (No changes here) */}
                  <div className="aspect-video bg-black relative flex items-center justify-center border-b border-gray-800 group-hover:border-gray-700 transition-colors">
                    <WebRTCPlayer cameraId={cam.id} />

                    <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest text-green-500 border border-green-500/20">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      LIVE
                    </div>
                  </div>

                  {/* POLISHED CARD HEADER & CONTROLS */}
                  <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-100 flex items-center gap-2">
                        {cam.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{cam.location || 'Unknown location'} • {cam.rtspUrl.split('@').pop()?.split('/')[0] || 'Local'}</p>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-lg border border-gray-800">
                      <button
                        title="Toggle AI Face Detection"
                        className={`p-2 rounded-md transition-all ${cam.aiEnabled !== false ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        <Brain size={16} />
                      </button>
                      <button
                        title="Start/Stop Stream"
                        className={`p-2 rounded-md transition-all ${cam.status === 'active' ? 'text-green-400 bg-green-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        <Power size={16} />
                      </button>
                      <div className="w-px h-4 bg-gray-800 mx-1"></div>
                      <button
                        title="Delete Camera"
                        onClick={() => handleDelete(cam.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* ALERTS FEED */}
                  <div className="p-3 bg-gray-950/50 h-32 overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={12} /> Live Event Log
                    </h4>

                    <div className="space-y-1.5">
                      {alerts.filter((a) => a.cameraId === cam.id).slice(0, 4).map((alert) => (
                        <div key={alert.id} className="text-sm border-l-2 border-red-500 bg-gradient-to-r from-red-500/10 to-transparent pl-3 py-1.5 pr-2 animate-in slide-in-from-left-2 duration-300">
                          <span className="font-medium text-red-400">{alert.message}</span>
                          <span className="text-[10px] text-gray-500 block">
                            {new Date(alert.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                      {alerts.filter((a) => a.cameraId === cam.id).length === 0 && (
                        <p className="text-xs text-gray-600 italic px-2">Monitoring active. No events.</p>
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