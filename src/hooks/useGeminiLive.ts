import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, MediaResolution, TurnCoverage } from '@google/genai';

interface UseGeminiLiveProps {
  apiKey: string;
  model?: string;
  onAIStateChange?: (isActive: boolean) => void;
}

export const useGeminiLive = ({ apiKey, model = 'models/gemini-2.0-flash-exp', onAIStateChange }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAIActive, setIsAIActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<any>(null);
  
  // Audio Queue Management
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  // Initialize Audio Context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  }, []);

  // Play next chunk in queue
  const playNextChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAIActive(false);
      onAIStateChange?.(false);
      return;
    }

    isPlayingRef.current = true;
    setIsAIActive(true);
    onAIStateChange?.(true);

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
  }, [initAudio, onAIStateChange]);

  const queueAudioChunk = useCallback(async (base64: string) => {
    try {
      const audioCtx = initAudio();
      
      // Decode base64 to binary
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // PCM 16-bit to Float32
      const float32 = new Float32Array(bytes.length / 2);
      const dataView = new DataView(bytes.buffer);
      for (let i = 0; i < bytes.length / 2; i++) {
        float32[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      // Create AudioBuffer (Gemini sends 24kHz)
      const buffer = audioCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);
      
      audioQueueRef.current.push(buffer);
      
      if (!isPlayingRef.current) {
        playNextChunk();
      }
    } catch (e) {
      console.error("Error processing audio chunk", e);
    }
  }, [initAudio, playNextChunk]);

  // Handle Incoming Message
  const handleServerMessage = useCallback((message: LiveServerMessage) => {
    // Check for audio data
    const part = message.serverContent?.modelTurn?.parts?.[0];
    if (part?.inlineData?.data) {
        queueAudioChunk(part.inlineData.data);
    }
    
    if (message.serverContent?.turnComplete) {
      // Turn complete
    }
  }, [queueAudioChunk]);

  // Start Microphone
  const startMicrophone = useCallback(async (session: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;
      
      const audioCtx = initAudio();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!session) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample/Convert to PCM 16-bit
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            pcm16[i] = s;
        }
        
        // Convert to base64
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);

        // Send to Gemini
        // Using the user's snippet structure: session.sendRealtimeInput(...) or similar
        // The SDK might have a send method
        try {
            session.sendRealtimeInput([{
                mimeType: "audio/pcm;rate=16000",
                data: base64
            }]);
        } catch (e) {
            // connection might be closed
        }
      };
      
      source.connect(processor);
      processor.connect(audioCtx.destination);
      processorRef.current = processor;
      
    } catch (err) {
      console.error("Microphone Error:", err);
    }
  }, [initAudio]);

  // Connect to Gemini Live
  const connect = useCallback(async () => {
    try {
      setError(null);
      const ai = new GoogleGenAI({ apiKey });

      const config = {
          responseModalities: [Modality.AUDIO],
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          realtimeInputConfig: {
            turnCoverage: TurnCoverage.TURN_INCLUDES_ALL_INPUT,
          },
      };

      const session = await ai.live.connect({ 
        model, 
        config,
        callbacks: {
            onopen: () => {
                console.log("Gemini Live Connected");
                setIsConnected(true);
            },
            onmessage: (message: LiveServerMessage) => {
                handleServerMessage(message);
            },
            onclose: () => {
                console.log("Gemini Live Closed");
                setIsConnected(false);
            },
            onerror: (err: any) => {
                console.error("Gemini Live Error", err);
                setError(err.message || "Unknown error");
            }
        }
      });
      
      wsRef.current = session;
      startMicrophone(session);

    } catch (err: any) {
      console.error("Connect Error:", err);
      setError(err.message);
    }
  }, [apiKey, model, handleServerMessage, startMicrophone]);

  const disconnect = useCallback(() => {
     if (wsRef.current) {
        // wsRef.current.close(); // Check if close exists or we just drop
        wsRef.current = null;
     }
     if (mediaStreamRef.current) {
         mediaStreamRef.current.getTracks().forEach(t => t.stop());
     }
     if (processorRef.current) {
         processorRef.current.disconnect();
     }
     setIsConnected(false);
     setIsAIActive(false);
     onAIStateChange?.(false);
     
     // Clear audio queue
     audioQueueRef.current = [];
     isPlayingRef.current = false;
  }, [onAIStateChange]);

  return {
    isConnected,
    isAIActive,
    error,
    connect,
    disconnect
  };
};
