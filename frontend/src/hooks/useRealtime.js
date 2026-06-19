/**
 * useRealtime — opens a duplex WebRTC connection between the browser and
 * OpenAI's Realtime API using an ephemeral client_secret minted by FastAPI.
 *
 * The backend is NEVER in the audio path. The local microphone track and
 * remote model audio flow peer-to-peer with OpenAI. The backend only mints the
 * ephemeral token (resolving the room UUID -> candidate) and later receives the
 * compiled transcript at /complete to trigger Agent 5.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Interviews } from "../services/api.js";

// GA WebRTC SDP-exchange endpoint. The legacy beta shape (POST to /v1/realtime)
// is rejected with `beta_api_shape_disabled`; GA moved the call to /v1/realtime/calls.
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function useRealtime(roomId) {
  const [status, setStatus] = useState("idle"); // idle | connecting | live | error | closed
  const [error, setError] = useState(null);
  // Resolved from the room token mint; needed for the /complete call at End time.
  const [candidateId, setCandidateId] = useState(null);
  const pcRef = useRef(null);
  const remoteAudioRef = useRef(null); // bound to a physical <audio autoPlay> in InterviewRoom
  const dcRef = useRef(null);
  // Ordered conversation log accumulated from data-channel transcript events.
  // A ref (not state) so appends never trigger re-renders mid-interview.
  const transcriptRef = useRef([]); // [{ role: "Interviewer" | "Candidate", text }]

  const connect = useCallback(async () => {
    if (!roomId) return;
    setStatus("connecting");
    transcriptRef.current = []; // fresh log per session (handles reconnects)
    try {
      // Room flow: resolve ?room=<UUID> -> { token, model, candidate_id }. This call
      // also flips the candidate SHORTLISTED -> INTERVIEWING server-side.
      const { token, model, candidate_id } = await Interviews.getWebRtcTokenByRoom(roomId);
      setCandidateId(candidate_id);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // Free Google STUN to fix ICE failures
        ],
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
        el.play().catch(console.error);
      };

      // Local mic capture.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel for transcript + tool events (audio is on media tracks).
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      // Accumulate the transcript from the Realtime stream:
      //  - response.audio_transcript.done                         -> interviewer (model) speech
      //  - conversation.item.input_audio_transcription.completed  -> candidate (mic) speech
      // We capture the FINAL events (not deltas) so each utterance is logged once, in
      // arrival order, which is good enough for Agent 5's transcript-based grading.
      dc.onmessage = (e) => {
        let event;
        try {
          event = JSON.parse(e.data);
        } catch (err) {
          console.error("oai-event parse failed", err, e.data);
          return;
        }
        console.log("oai-event", event.type, event);
        if (event.type === "response.audio_transcript.done" && event.transcript) {
          transcriptRef.current.push({ role: "Interviewer", text: event.transcript });
        } else if (
          event.type === "conversation.item.input_audio_transcription.completed" &&
          event.transcript
        ) {
          transcriptRef.current.push({ role: "Candidate", text: event.transcript });
        }
      };

      // Break the silence: as soon as the channel is open, ask the model to respond so
      // it greets the candidate first instead of waiting for speech.
      dc.onopen = () => {
        console.log("Data channel opened! Triggering agent greeting...");
        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Hello! The interview has started. Please introduce yourself and ask me the first technical question.",
                },
              ],
            },
          }),
        );
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // GA SDP exchange. The ephemeral key carries the session, and ?model lets the
      // /calls endpoint resolve the model explicitly — together they avoid the 404 you
      // get when the model can't be resolved.
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
        // Surface OpenAI's reason instead of a bare status — this is where the real
        // 404 cause ("model_not_found", etc.) lives.
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

  // Phase 3: push the Monaco editor's code DIRECTLY into the live OpenAI Realtime
  // session over the WebRTC data channel (no backend hop), then trigger a spoken
  // response so the interviewer immediately interrogates what was just submitted.
  // Returns false (without sending) if the session isn't live yet, so the caller can
  // surface that to the candidate instead of silently dropping the submit.
  const sendCodeToAI = useCallback((codeString) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      console.warn("sendCodeToAI: data channel not open — start the interview first");
      return false;
    }

    // Built with string concatenation (not a template literal) so the markdown ```
    // fences around the code don't collide with JS backtick delimiters.
    const text =
      "The candidate has submitted the following code in the editor:\n\n" +
      "```\n" +
      (codeString ?? "") +
      "\n```\n" +
      "Do not write new code. Immediately ask brief, technical follow-up questions " +
      "interrogating their logic, time complexity, or design choices.";

    // 1) conversation.item.create — inject the code as a system message (input_text).
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [{ type: "input_text", text }],
        },
      }),
    );
    // 2) response.create — make the model actually speak its interrogation aloud.
    dc.send(JSON.stringify({ type: "response.create" }));
    return true;
  }, []);

  // Compile the accumulated conversation into a single formatted string for Agent 5.
  const getTranscript = useCallback(
    () => transcriptRef.current.map(({ role, text }) => `${role}: ${text}`).join("\n"),
    [],
  );

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    status,
    error,
    candidateId,
    connect,
    disconnect,
    sendCodeToAI,
    getTranscript,
    dataChannel: dcRef,
    remoteAudioRef,
  };
}
