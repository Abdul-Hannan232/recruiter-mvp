/**
 * useRealtime — opens a duplex WebRTC connection between the browser and
 * OpenAI's Realtime API using an ephemeral client_secret minted by FastAPI.
 *
 * The backend is NEVER in the audio path. The local microphone track and
 * remote model audio flow peer-to-peer with OpenAI.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Realtime } from "../services/api.js";

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

export function useRealtime(candidateId) {
  const [status, setStatus] = useState("idle"); // idle | connecting | live | error | closed
  const [error, setError] = useState(null);
  const pcRef = useRef(null);
  const audioRef = useRef(null);
  const dcRef = useRef(null);

  const connect = useCallback(async () => {
    if (!candidateId) return;
    setStatus("connecting");
    try {
      const { client_secret, model } = await Realtime.session(candidateId);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio track from the model.
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      audioRef.current = remoteAudio;
      pc.ontrack = (e) => {
        remoteAudio.srcObject = e.streams[0];
      };

      // Local mic capture.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel for transcript + tool events (audio is on media tracks).
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const resp = await fetch(`${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${client_secret}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!resp.ok) throw new Error(`Realtime SDP exchange failed: ${resp.status}`);
      const answer = { type: "answer", sdp: await resp.text() };
      await pc.setRemoteDescription(answer);

      setStatus("live");
    } catch (e) {
      console.error(e);
      setError(e);
      setStatus("error");
    }
  }, [candidateId]);

  const disconnect = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setStatus("closed");
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, error, connect, disconnect, dataChannel: dcRef };
}
