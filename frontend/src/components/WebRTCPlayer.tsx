import { useEffect, useRef } from 'react';

interface Props {
    cameraId: string;
}

export default function WebRTCPlayer({ cameraId }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // 1. Create a new WebRTC Connection
        const peerConnection = new RTCPeerConnection();

        // 2. Tell the connection we only want to RECEIVE video/audio
        peerConnection.addTransceiver('video', { direction: 'recvonly' });
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });

        // 3. When the video stream arrives, attach it to our <video> HTML element
        peerConnection.ontrack = (event) => {
            if (videoRef.current && event.streams[0]) {
                videoRef.current.srcObject = event.streams[0];
            }
        };

        // 4. The Signaling Process (The "Handshake" with MediaMTX)
        const negotiateStream = async () => {
            try {
                // Create an offer and set it locally
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                // Send the offer to MediaMTX's WHEP endpoint
                const response = await fetch(`http://localhost:8889/${cameraId}/whep`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/sdp' },
                    body: offer.sdp,
                });

                if (!response.ok) throw new Error("Stream not available yet");

                // Receive the answer and set it
                const answerSdp = await response.text();
                await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
            } catch (error) {
                console.error(`WebRTC Connection failed for ${cameraId}:`, error);
            }
        };

        negotiateStream();

        // Cleanup when the component is removed from the screen
        return () => {
            peerConnection.close();
        };
    }, [cameraId]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
        />
    );
}