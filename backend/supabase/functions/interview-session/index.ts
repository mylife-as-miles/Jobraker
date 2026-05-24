
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI, LiveServerMessage, Modality } from "npm:@google/genai";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";
import {
  normalizeSubscriptionTier,
  resolveSubscriptionTier,
} from "../_shared/subscription.ts";

console.log("Hello from interview-session!");

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // 2. Upgrade to WebSocket
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

  // 3. Setup Gemini Connection
  // We'll initialize Gemini when the client triggers it or immediately upon connection if auth is valid.
  // For simplicity, we authorize first (via protocol or query param, or just trust the upgrade request context if standard auth header works with upgrade)
  // Note: WebSocket upgrade requests in browsers don't always let you set custom headers nicely.
  // Often protocol is used: `new WebSocket(url, ["supabase", "token"])`.
  // Or query param: `?token=...`

  clientWs.onopen = () => {
    console.log("Client WebSocket connected");
  };

  clientWs.onmessage = async (e) => {
    // We expect the FIRST message to be an auth token or configuration
    // OR we just handle binary audio immediately if we assume params in URL.
    // Let's implement a simple protocol:
    // Client -> { type: 'config', token: '...', config: ... }
    // Server -> connects to Gemini
    // Client -> binary audio
    
    // For this implementation, let's parse the string messages.
    if (typeof e.data === 'string') {
        try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'config') {
                await connectToGemini(clientWs, msg.token, msg.options);
            }
        } catch (err) {
            console.error("Error parsing message", err);
        }
    } else {
        // Binary Data (Audio) - forward to Gemini if connected
        if (geminiSession) {
             // Gemini SDK expects specific format. 
             // With npm:@google/genai, session.sendRealtimeInput wants { mimeType, data (base64) }
             // User is sending binary audio. We need to convert ArrayBuffer to Base64.
             const arrayBuffer = e.data;
             const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
             
             try {
                geminiSession.sendRealtimeInput([{
                    mimeType: "audio/pcm;rate=16000",
                    data: base64
                }]);
             } catch (err) {
                 console.error("Gemini send error", err);
             }
        }
    }
  };

  let geminiSession: any = null;

  async function connectToGemini(ws: WebSocket, token: string, options: any) {
     try {
         // Verify Token
         const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
         );
         const { data: { user }, error } = await supabase.auth.getUser();
         
         if (error || !user) {
             ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
             ws.close();
             return;
         }

         const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false } }
         );
         const subscriptionTier = normalizeSubscriptionTier(
            await resolveSubscriptionTier(user.id, serviceClient),
         );
         if (subscriptionTier === "Free" || subscriptionTier === "Basics") {
            ws.send(JSON.stringify({
              type: "error",
              message: "Interview Studio requires the Pro plan or higher.",
            }));
            ws.close();
            return;
         }
         await enforceFeatureRateLimit({
            userId: user.id,
            featureKey: "interview_session",
            serviceClient,
            subscriptionTier,
         });

         const ai = new GoogleGenAI({
            apiKey: Deno.env.get("GEMINI_API_KEY")!,
         });

         const config = {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            ...options // merge client options like model choice if allowed
         };

         geminiSession = await ai.live.connect({
            model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
            config,
            callbacks: {
                onopen: () => {
                    console.log("Gemini Connected");
                    void recordFeatureUsage({
                        userId: user.id,
                        featureKey: "interview_session",
                        serviceClient,
                        subscriptionTier,
                    }).catch((usageError) =>
                        console.error("Failed to record interview session usage", usageError),
                    );
                    ws.send(JSON.stringify({ type: 'connected' }));
                },
                onmessage: (msg: LiveServerMessage) => {
                    // Forward Gemini response to Client
                    // If audio, allow binary or base64? 
                    // Client useInterviewSession.ts handles `msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data` (Base64)
                    // We can just forward the whole object JSON or specific parts.
                    // Let's forward the relevant parts.
                    
                    const part = msg.serverContent?.modelTurn?.parts?.[0];
                    if (part?.inlineData?.data) {
                         // Send as binary or JSON? 
                         // To keep client simple (matching existing logic), let's send JSON wrapping the base64.
                         ws.send(JSON.stringify({ 
                             type: 'audio', 
                             data: part.inlineData.data 
                         }));
                    }
                    
                    if (msg.serverContent?.turnComplete) {
                        ws.send(JSON.stringify({ type: 'turn_complete' }));
                    }
                },
                onclose: () => {
                    console.log("Gemini Closed");
                    ws.send(JSON.stringify({ type: 'disconnected' }));
                    ws.close();
                },
                onerror: (err: any) => {
                    console.error("Gemini Error", err);
                    ws.send(JSON.stringify({ type: 'error', message: err.message }));
                }
            }
         });

     } catch (err: any) {
         console.error("Gemini Connect Error", err);
         ws.send(JSON.stringify({ type: 'error', message: err.message }));
         ws.close();
     }
  }

  clientWs.onclose = async () => {
     console.log("Client WebSocket closed");
     // Cleanup Gemini
     if (geminiSession) {
         // geminiSession.close(); // Check SDK method
         geminiSession = null;
     }
  };

  return response;
});
