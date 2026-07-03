import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64ToBytes(base64Str: string): Uint8Array {
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateImageBytesWithFallback(apiKey: string, prompt: string): Promise<Uint8Array> {
  const errors: Array<Record<string, unknown>> = [];

  // Try 1: Imagen endpoint (some projects/keys return 404 here)
  {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages";
    const url = `${endpoint}?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        numberOfImages: 1,
        aspectRatio: "3:4",
        outputMimeType: "image/jpeg",
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const base64Bytes = json.generatedImages?.[0]?.image?.imageBytes;
      if (base64Bytes) return decodeBase64ToBytes(base64Bytes);
      errors.push({
        stage: "imagen-parse",
        endpoint,
        message: "No imageBytes in response",
        response: json,
      });
    } else {
      errors.push({
        stage: "imagen-api",
        endpoint,
        status: response.status,
        detail: await response.text(),
      });
    }
  }

  // Try 2: Gemini image-capable model via generateContent
  {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent";
    const url = `${endpoint}?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const inline = parts.find((p: any) => typeof p?.inlineData?.data === "string");
      if (inline?.inlineData?.data) {
        return decodeBase64ToBytes(inline.inlineData.data);
      }
      errors.push({
        stage: "gemini-image-parse",
        endpoint,
        message: "No inlineData image in response",
        response: json,
      });
    } else {
      errors.push({
        stage: "gemini-image-api",
        endpoint,
        status: response.status,
        detail: await response.text(),
      });
    }
  }

  throw new Error(JSON.stringify({
    message: "All image generation endpoints failed",
    attempts: errors,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "Missing GEMINI_API_KEY", stage: "env" },
        500,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return jsonResponse(
        { error: "Missing Supabase env", stage: "env" },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const base64Image = typeof body.base64Image === "string" ? body.base64Image : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

    // Branch A: prompt-only image generation for admin preview/upload workflows.
    if (prompt && !base64Image) {
      let bytes: Uint8Array;
      try {
        bytes = await generateImageBytesWithFallback(apiKey, prompt);
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : "unknown image generation error";
        return jsonResponse(
          {
            error: "Image generation failed",
            stage: "image-fallback",
            detail,
          },
          500,
        );
      }

      const pathName = `admin_generated/ai_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("card_images")
        .upload(pathName, bytes.buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        return jsonResponse(
          {
            error: "Storage upload failed",
            stage: "storage-upload",
            detail: uploadError.message,
          },
          500,
        );
      }

      const { data } = supabase.storage.from("card_images").getPublicUrl(pathName);
      return jsonResponse({ imageUrl: data.publicUrl }, 200);
    }

    // Branch B: image-to-card generation (legacy behavior for camera/index tabs).
    if (!base64Image) {
      return jsonResponse(
        {
          error: "Missing input",
          stage: "validation",
          required: "Either { prompt } or { base64Image }",
        },
        400,
      );
    }

    const cardPrompt = `
あなたは現実の風景や物品をスキャンしてRPGカード化するゲーム「SNAP CARD」のマスターAIです。
入力画像を解析し、必ず次のJSONだけを返してください。
{
  "card_name": "string",
  "feature": "string",
  "skill_name": "string",
  "status_hp": number,
  "status_atk": number,
  "status_def": number,
  "status_spd": number,
  "rarity": "N|R|SR|SSR|UR|DUST",
  "card_role": "attacker|support",
  "element": "string"
}
`; 

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            { text: cardPrompt },
            { inlineData: { mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    };

    const cardResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!cardResp.ok) {
      const detail = await cardResp.text();
      return jsonResponse(
        {
          error: "Gemini card generation failed",
          stage: "gemini-api",
          status: cardResp.status,
          detail,
        },
        500,
      );
    }

    const cardJson = await cardResp.json();
    const textOutput = cardJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput || typeof textOutput !== "string") {
      return jsonResponse(
        {
          error: "Invalid Gemini card response",
          stage: "gemini-parse",
          response: cardJson,
        },
        500,
      );
    }

    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonResponse(
        {
          error: "No JSON in card response",
          stage: "gemini-json-extract",
          raw: textOutput,
        },
        500,
      );
    }

    const cardData = JSON.parse(jsonMatch[0]);
    return jsonResponse(cardData, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(
      {
        error: message,
        stage: "unhandled",
      },
      500,
    );
  }
});
