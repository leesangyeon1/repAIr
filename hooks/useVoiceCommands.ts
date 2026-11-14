"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not part of TypeScript's DOM lib). */
type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative; length: number };
type SpeechResultEvent = { resultIndex: number; results: { length: number; [index: number]: SpeechResult } };
type SpeechErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in the browser's site settings, or type your command.",
  "service-not-allowed": "Speech recognition is not permitted here. Type your command instead.",
  "audio-capture": "No microphone was found. Type your command instead.",
  network: "Speech recognition needs a network connection. Type your command instead.",
  "no-speech": "I didn't hear anything. Press the microphone and try again.",
  "language-not-supported": "This browser does not support English speech recognition.",
};

export type VoiceCommands = {
  /** False when the browser has no SpeechRecognition; text input remains the fallback. */
  supported: boolean;
  listening: boolean;
  /** Live transcript while speaking. */
  interim: string;
  /** Last finished utterance. */
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  ttsSupported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  stopSpeaking: () => void;
};

/**
 * Push-to-talk voice input plus spoken output.
 * - Listens for one utterance per button press; it never listens continuously on its own.
 * - Recognition and synthesis are mutually exclusive, so the app cannot hear its own voice:
 *   starting the microphone cancels speech, and speaking aborts any active recognition.
 */
export function useVoiceCommands(onCommand: (text: string) => void): VoiceCommands {
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<Recognition | null>(null);
  const onCommandRef = useRef(onCommand);
  const speakingRef = useRef(false);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser. Type your command instead.");
      return;
    }
    if (recognitionRef.current) return;
    stopSpeaking();
    setError(null);
    setInterim("");

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = "";
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else live += result[0].transcript;
      }
      setInterim(live || finalText);
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(ERROR_TEXT[event.error] ?? "Voice input failed. Type your command instead.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      // Ignore anything captured while the app itself was talking.
      if (text && !speakingRef.current) {
        setTranscript(text);
        onCommandRef.current(text);
      }
    };

    recognitionRef.current = recognition;
    try {
      // The browser shows its microphone permission prompt on the first start().
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setError("Could not start the microphone. Type your command instead.");
    }
  }, [stopSpeaking]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    recognitionRef.current?.abort();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 700));
    utterance.lang = "en-US";
    utterance.rate = 1.03;
    utterance.onstart = () => {
      speakingRef.current = true;
      setSpeaking(true);
    };
    const done = () => {
      speakingRef.current = false;
      setSpeaking(false);
    };
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
  }, []);

  return { supported, listening, interim, transcript, error, start, stop, ttsSupported, speaking, speak, stopSpeaking };
}
