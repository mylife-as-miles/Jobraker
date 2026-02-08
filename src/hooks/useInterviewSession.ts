
import { useState, useRef, useCallback } from 'react';
import { createClient } from "@/lib/supabaseClient";

interface UseInterviewSessionProps {
  apiKey?: string; // Kept for interface compatibility but unused
}

export const useInterviewSession = ({ apiKey: _apiKey }: UseInterviewSessionProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAIActive, setIsAIActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  }, []);

  const playNextChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAIActive(false);
      return;
    }

    isPlayingRef.current = true;
    setIsAIActive(true);

    const audioCtx = initAudio();
    const buffer = audioQueueRef.current.shift()!;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    
    const currentTime = audioCtx.currentTime;
    const playTime = Math.max(currentTime, nextPlayTimeRef.current);
    
    source.start(playTime);
    nextPlayTimeRef.current = playTime + buffer.duration;
    
    source.onended = () => {
      playNextChunk();
    };
  }, [initAudio]);

  const queueAudioChunk = useCallback((base64: string) => {
    try {
      const audioCtx = initAudio();
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const float32 = new Float32Array(bytes.length / 2);
      const dataView = new DataView(bytes.buffer);
      for (let i = 0; i < bytes.length / 2; i++) {
        float32[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      const buffer = audioCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);
      
      audioQueueRef.current.push(buffer);
      if (!isPlayingRef.current) playNextChunk();
    } catch (e) {
      console.error("Error processing audio chunk", e);
    }
  }, [initAudio, playNextChunk]);

  const startMicrophone = useCallback(async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;
      
      const audioCtx = initAudio();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            pcm16[i] = s;
        }
        
        // Send binary directly to Edge Function
        ws.send(pcm16.buffer);
      };
      
      source.connect(processor);
      processor.connect(audioCtx.destination);
      processorRef.current = processor;
    } catch (err) {
      console.error("Mic Error:", err);
      setError("Microphone access failed");
    }
  }, [initAudio]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // Get current session token for auth
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      // Construct WebSocket URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      // Replace http/https with ws/wss
      const wsUrl = supabaseUrl.replace(/^http/, 'ws') + '/functions/v1/interview-session';
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket Connected");
        // Send initial auth/config
        ws.send(JSON.stringify({
            type: 'config',
            token: session.access_token,
            options: {
                // model: 'models/gemini-2.5-flash-native-audio-preview-12-2025' // Configured on server
            }
        }));
      };

      ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'connected') {
                setIsConnected(true);
                startMicrophone(ws);
            } else if (msg.type === 'audio' && msg.data) {
                // msg.data is base64 from server
                queueAudioChunk(msg.data);
            } else if (msg.type === 'error') {
                setError(msg.message);
                console.error("Server Error:", msg.message);
            } else if (msg.type === 'disconnected') {
                setIsConnected(false);
                setIsAIActive(false);
            }
        } catch (e) {
            console.error("Error parsing websocket message", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket Closed");
        setIsConnected(false);
        setIsAIActive(false);
        cleanupAudio();
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        setError("Connection failed");
      };

      wsRef.current = ws;

    } catch (err: any) {
      setError(err.message);
    }
  }, [startMicrophone, queueAudioChunk]);

  const cleanupAudio = useCallback(() => {
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    cleanupAudio();
    setIsConnected(false);
    setIsAIActive(false);
  }, [cleanupAudio]);

  return { isConnected, isAIActive, error, connect, disconnect };
};
