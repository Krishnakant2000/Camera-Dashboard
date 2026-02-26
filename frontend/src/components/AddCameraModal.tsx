import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // Triggered so we can refresh the grid
}

export default function AddCameraModal({ isOpen, onClose, onSuccess }: Props) {
    const [name, setName] = useState('');
    const [rtspUrl, setRtspUrl] = useState('');
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const res = await fetch('http://localhost:3000/cameras', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('vision_token')}`
                },
                body: JSON.stringify({ name, rtspUrl, location }),
            });

            if (!res.ok) throw new Error('Failed to add camera');

            onSuccess(); // Tell the parent to refresh the grid
            onClose();   // Close the modal

            // Reset form
            setName('');
            setRtspUrl('');
            setLocation('');
        } catch (err) {
            setError('Failed to connect to the server.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900/50">
                    <h3 className="text-lg font-semibold text-white">Add New Camera</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 rounded-md text-sm">{error}</div>}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Camera Name</label>
                        <input
                            type="text" required value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. Front Gate"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">RTSP Stream URL</label>
                        <input
                            type="text" required value={rtspUrl} onChange={(e) => setRtspUrl(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="rtsp://admin:pass@192.168.1.100:554/stream"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Location (Optional)</label>
                        <input
                            type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. North Entrance"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50">
                            {isSubmitting ? 'Saving...' : 'Add Camera'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}