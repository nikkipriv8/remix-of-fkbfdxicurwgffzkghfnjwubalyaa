const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeHttpUrl(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const candidate = raw.trim();
  if (!candidate) return null;
  if (candidate.length > maxLen) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeFilenameFromContentType(contentType: string | null) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("audio/ogg")) return "audio.ogg";
  if (ct.includes("audio/mpeg")) return "audio.mp3";
  if (ct.includes("audio/mp4")) return "audio.m4a";
  if (ct.includes("audio/wav")) return "audio.wav";
  if (ct.includes("audio/webm")) return "audio.webm";
  return "audio";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // Only allow internal calls via service role or authenticated staff (optional)
    // For now we rely on service role usage from other backend functions.
    const payload = await req.json();
    const audioUrl = sanitizeHttpUrl(payload?.audioUrl ?? payload?.audio_url, 2048);
    const languageCode = String(payload?.languageCode ?? payload?.language_code ?? "por").slice(0, 16);

    if (!audioUrl) {
      return json(400, { error: "Invalid audioUrl" });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("[elevenlabs-transcribe] ELEVENLABS_API_KEY is not configured");
      return json(500, { error: "Server misconfigured" });
    }

    console.log(`[elevenlabs-transcribe] downloading audio url_len=${audioUrl.length}`);
    const audioResp = await fetch(audioUrl);
    const audioRespTextOnError = async () => {
      try {
        return await audioResp.text();
      } catch {
        return "";
      }
    };

    if (!audioResp.ok) {
      const t = await audioRespTextOnError();
      console.error("[elevenlabs-transcribe] audio download failed", audioResp.status, t.slice(0, 300));
      return json(502, { error: "Failed to download audio" });
    }

    const contentType = audioResp.headers.get("content-type");
    const buf = await audioResp.arrayBuffer();
    console.log(`[elevenlabs-transcribe] downloaded bytes=${buf.byteLength} content_type=${contentType ?? "unknown"}`);

    // Build multipart for ElevenLabs
    const fileName = safeFilenameFromContentType(contentType);
    const file = new File([buf], fileName, {
      type: contentType || "application/octet-stream",
    });

    const form = new FormData();
    form.append("file", file);
    form.append("model_id", "scribe_v2");
    form.append("language_code", languageCode || "por");
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    console.log(`[elevenlabs-transcribe] sending to ElevenLabs model=scribe_v2 lang=${languageCode}`);
    const sttResp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: form,
    });

    const sttText = await sttResp.text();
    if (!sttResp.ok) {
      console.error("[elevenlabs-transcribe] stt failed", sttResp.status, sttText.slice(0, 800));
      return json(502, { error: "Transcription failed" });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(sttText);
    } catch {
      console.error("[elevenlabs-transcribe] invalid json from stt", sttText.slice(0, 300));
      return json(502, { error: "Transcription failed" });
    }

    const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
    console.log(`[elevenlabs-transcribe] ok text_len=${text.length}`);

    return json(200, { text });
  } catch (e) {
    console.error("[elevenlabs-transcribe] error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
