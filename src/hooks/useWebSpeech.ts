
import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSpeech = (isListening: boolean) => {
  const [transcript, setTranscript] = useState('');
  const [wpm, setWpm] = useState(0);
  const [fillerWordCount, setFillerWordCount] = useState(0);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const wordCountRef = useRef(0);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn("Web Speech API not supported");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      startTimeRef.current = Date.now();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const fullText = finalTranscript + interimTranscript;
      setTranscript(fullText);

      // WPM Calculation
      const words = fullText.trim().split(/\s+/);
      const currentWordCount = words.length;
      wordCountRef.current = currentWordCount;
      
      if (startTimeRef.current) {
        const durationMinutes = (Date.now() - startTimeRef.current) / 60000;
        if (durationMinutes > 0) {
          setWpm(Math.round(currentWordCount / durationMinutes));
        }
      }

      // Filler Word Detection
      const fillerWords = ['um', 'uh', 'like', 'you know', 'sort of'];
      let fillerCount = 0;
      words.forEach(word => {
        if (fillerWords.includes(word.toLowerCase().replace(/[^a-z]/g, ''))) {
          fillerCount++;
        }
      });
      setFillerWordCount(fillerCount);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
         // Already started
      }
    } else if (!isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return { transcript, wpm, fillerWordCount };
};
