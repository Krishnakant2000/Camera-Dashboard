import { useEffect, useRef } from 'react';

interface Props {
    cameraId: string;
}

export default function WebRTCPlayer({ cameraId }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let peerConnection = new RTCPeerConnection();
        let retryTimeout: ReturnType<typeof setTimeout>;

        const setupConnection = async () => {
            // Re-initialize for retries
            if (peerConnection.signalingState === 'closed') {
                peerConnection = new RTCPeerConnection();
            }

            peerConnection.addTransceiver('video', { direction: 'recvonly' });
            peerConnection.addTransceiver('audio', { direction: 'recvonly' });

            peerConnection.ontrack = (event) => {
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                }
            };

            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                const response = await fetch(`http://localhost:8889/${cameraId}/whep`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/sdp' },
                    body: offer.sdp,
                });

                if (!response.ok) throw new Error("Stream not ready");

                const answerSdp = await response.text();
                await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

                console.log(`🟢 WebRTC Connected for ${cameraId}`);
            } catch (error) {
                console.log(`⏳ Waiting for Go Worker to start stream ${cameraId}... retrying in 2s`);
                // If it fails, close this attempt and try again in 2 seconds
                peerConnection.close();
                retryTimeout = setTimeout(setupConnection, 2000);
            }
        };

        setupConnection();

        return () => {
            clearTimeout(retryTimeout);
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