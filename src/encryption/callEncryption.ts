export const setupEncryptedCall = (localStream: MediaStream, remoteStreamCallback: (stream: MediaStream) => void) => {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        remoteStreamCallback(remoteStream);
    };

    // DTLS обеспечивает шифрование для звонков
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // Отправляем ICE-кандидаты на сервер
        }
    };

    return peerConnection;
};
