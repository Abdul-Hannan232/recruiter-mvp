/**
 * useRealtime — opens a duplex WebRTC connection between the browser and
 * OpenAI's Realtime API using an ephemeral client_secret minted by FastAPI.
 *
 * The backend is NEVER in the audio path. The local microphone track and
 * remote model audio flow peer-to-peer with OpenAI.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Interviews } from "../services/api.js";

// GA WebRTC SDP-exchange endpoint. The legacy beta shape (POST to /v1/realtime)
// is rejected with `beta_api_shape_disabled`; GA moved the call to /v1/realtime/calls.
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function useRealtime(roomId) {
  const [status, setStatus] = useState("idle"); // idle | connecting | live | error | closed
  const [error, setError] = useState(null);
  // The room token endpoint resolves room_id -> candidate_id (+ transitions the
  // candidate to INTERVIEWING). We surface it so the code WS / complete calls,
  // which are keyed by candidate_id, can use it.
  const [candidateId, setCandidateId] = useState(null);
  const pcRef = useRef(null);
  const remoteAudioRef = useRef(null); // bound to a physical <audio autoPlay> in InterviewRoom
  const dcRef = useRef(null);
  // Accumulated interview transcript: [{ role, text }] in spoken order.
  const transcriptRef = useRef([]);

  const connect = useCallback(async () => {
    if (!roomId) return;
    setStatus("connecting");
    transcriptRef.current = []; // fresh transcript per session
    try {
      const { token, model, candidate_id } = await Interviews.getWebRtcTokenByRoom(roomId);
      setCandidateId(candidate_id);

	const pc = new RTCPeerConnection({
	  iceServers: [
	    { urls: "stun:stun.l.google.com:19302" } // Free Google STUN server to fix ICE failures
	  ]
	});
      pcRef.current = pc;

      // Remote model audio -> attach to the on-screen <audio> element. Using a
      // DOM node that's already mounted (rather than an in-memory Audio created
      // after these awaits) preserves the autoplay gesture-trust from the Start
      // click, so the stream isn't blocked.
      pc.ontrack = (e) => {
        const el = remoteAudioRef.current;
        if (!el) return;
        el.srcObject = e.streams[0];
        // Explicitly start playback and surface any autoplay block instead of
        // failing silently.
        el.play().catch(console.error);
      };

      // Local mic capture.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel for transcript + tool events (audio is on media tracks).
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      // Visibility: log everything OpenAI sends back over the channel
      // (response lifecycle, response.audio_transcript.delta, tool calls, etc.).
      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          console.log("oai-event", event.type, event);
          const t = event.type || "";
          // Interviewer (model) speech: final per-response audio transcript.
          // Tolerant to GA naming variants (audio_transcript / output_audio_transcript).
          if (t.endsWith("audio_transcript.done") && event.transcript) {
            transcriptRef.current.push({ role: "Interviewer", text: event.transcript });
          }
          // Candidate (user) speech: final whisper-1 input transcription (needs the
          // input.transcription config enabled when the session was minted).
          if (
            t === "conversation.item.input_audio_transcription.completed" &&
            event.transcript
          ) {
            transcriptRef.current.push({ role: "Candidate", text: event.transcript });
          }
        } catch (err) {
          console.error("oai-event parse failed", err, e.data);
        }
      };

      // Break the silence: as soon as the channel is open, ask the model to
      // respond so it greets the candidate first instead of waiting for speech.
      // Request both modalities explicitly so we always get spoken audio.
      dc.onopen = () => {
  	console.log("Data channel opened! Triggering agent greeting...");
  
	  // 1. Send a hidden text message to set the context
	  const initEvent = {
	    type: "conversation.item.create",
	    item: {
	      type: "message",
	      role: "user",
	      content: [{ 
		type: "input_text", 
		text: "Hello! The interview has started. Please introduce yourself and ask me the first technical question." 
	      }]
	    }
	  };
	  dc.send(JSON.stringify(initEvent));
	  
	  // 2. Instruct the AI to generate a vocal response to the text we just sent
	  dc.send(JSON.stringify({ type: "response.create" }));
	};

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // GA SDP exchange. The ephemeral key carries the session, and ?model lets
      // the /calls endpoint resolve the model explicitly — together they avoid the
      // 404 you get when the model can't be resolved.
      const resp = await fetch(
        `${OPENAI_REALTIME_CALLS_URL}?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
        },
      );
      if (!resp.ok) {
        // Surface OpenAI's reason instead of a bare status — this is where the
        // real 404 cause ("model_not_found", etc.) lives.
        const detail = await resp.text().catch(() => "");
        throw new Error(`Realtime SDP exchange failed: ${resp.status} ${detail}`);
      }
      const answer = { type: "answer", sdp: await resp.text() };
      await pc.setRemoteDescription(answer);

      setStatus("live");
    } catch (e) {
      console.error(e);
      setError(e);
      setStatus("error");
    }
  }, [roomId]);

  const disconnect = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setStatus("closed");
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  // Join the accumulated turns into a single raw transcript string for Agent 5.
  const getTranscript = useCallback(
    () => transcriptRef.current.map((x) => `${x.role}: ${x.text}`).join("\n"),
    [],
  );

  return {
    status,
    error,
    connect,
    disconnect,
    dataChannel: dcRef,
    remoteAudioRef,
    candidateId,
    getTranscript,
  };
}
