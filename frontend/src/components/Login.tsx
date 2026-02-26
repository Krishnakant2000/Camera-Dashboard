import { useState } from 'react';
import { Activity, Lock } from 'lucide-react';

interface Props {
    onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('http://localhost:3000/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Success! Pass the token back to App.tsx
            onLoginSuccess(data.token);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-8 shadow-2xl">
                <div className="flex flex-col items-center mb-8 text-blue-400">
                    <Activity size={48} className="mb-4" />
                    <h1 className="text-2xl font-bold text-white">VisionOS Command Center</h1>
                    <p className="text-sm text-gray-500 mt-2">Authorized Personnel Only</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-sm text-center font-medium">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="Enter your username"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                    >
                        {isLoading ? 'Authenticating...' : (
                            <>
                                <Lock size={18} /> Access System
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}