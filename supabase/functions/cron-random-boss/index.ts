import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RandomBossConfig = {
  enabled?: boolean;
  interval?: string;
  spawn_type?: "radius" | "nationwide" | "municipality";
  municipality?: string;
  base_lat?: number;
  base_lng?: number;
  boss_image_mode?: "upload" | "ai";
  drop_image_mode?: "upload" | "ai";
  boss_ai_prompt?: string;
  drop_ai_prompt?: string;
  boss_upload_url?: string;
  drop_upload_url?: string;
  boss_name?: string;
  drop_name?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
}

const defaultBossPrompts = [
  "A fantasy trading card game illustration of a giant monster creature, name is {name}, hyper detailed, masterwork elemental of {element}, cyberpunk tech mixed with dark magic grid style, card art template asset",
];
const defaultDropPrompts = [
  "A shiny cosmic artifact crystal weapon glowing inside a container, rewards token, {rarity} trading card high rarity frame game asset",
];

const prefix = ["次元の", "彷徨える", "極大の", "アビス・", "ヴォイド・", "災厄の", "覚醒せし"];
const suffix = ["ゴーレム", "ベヒモス", "フェニックス", "リヴァイアsan", "ナイトメア", "機神龍", "タイタン"];

const municipalityCoords: Record<string, { lat: number; lng: number }> = {
  "東京都": { lat: 35.689, lng: 139.691 },
  "大阪府": { lat: 34.686, lng: 135.52 },
  "北海道": { lat: 43.064, lng: 141.346 },
  "福岡県": { lat: 33.606, lng: 130.418 },
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

function getRandomCoords(config: RandomBossConfig): { lat: number; lng: number } {
  let lat = Number(config.base_lat ?? 35.6983);
  let lng = Number(config.base_lng ?? 139.4130);

  if (config.spawn_type === "nationwide") {
    lat = 24 + Math.random() * 22;
    lng = 128 + Math.random() * 17;
    return { lat, lng };
  }

  if (config.spawn_type === "municipality") {
    const base = municipalityCoords[config.municipality ?? ""] ?? { lat, lng };
    return {
      lat: base.lat + (Math.random() - 0.5) * 0.2,
      lng: base.lng + (Math.random() - 0.5) * 0.2,
    };
  }

  return {
    lat: lat + (Math.random() - 0.5) * 0.04,
    lng: lng + (Math.random() - 0.5) * 0.04,
  };
}

async function generateAndUploadWithGemini(
  supabase: ReturnType<typeof createClient>,
  prompt: string,
  pathName: string,
): Promise<string | null> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${geminiApiKey}`;
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error (${response.status}):`, errorText);
      return null;
    }

    const json = await response.json();
    const base64Bytes = json.generatedImages?.[0]?.image?.imageBytes;
    if (!base64Bytes) {
      console.error("Gemini API から有効な画像データが返されませんでした:", json);
      return null;
    }

    const binaryString = atob(base64Bytes);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

    const { error: uploadError } = await supabase.storage
      .from("card_images")
      .upload(pathName, bytes.buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from("card_images").getPublicUrl(pathName);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error("Gemini画像生成/アップロード中にエラー:", e);
    return null;
  }
}

serve(async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: configData, error: configError } = await supabase
      .from("system_config")
      .select("config_data")
      .eq("id", "random_boss_settings")
      .single();

    if (configError || !configData) throw new Error("設定が見つかりません");
    const config: RandomBossConfig = configData.config_data ?? {};

    if (!config.enabled) {
      return new Response(JSON.stringify({ message: "Random boss spawn is disabled." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: elementsData } = await supabase
      .from("system_config")
      .select("config_data")
      .eq("id", "elements")
      .single();
    const elementsList: string[] = elementsData?.config_data?.list ?? ["火", "水", "雷", "風", "木", "土", "光", "闇"];

    const { data: raritiesData } = await supabase
      .from("system_config")
      .select("config_data")
      .eq("id", "rarities")
      .single();
    const raritiesList: string[] = raritiesData?.config_data?.list ?? ["N", "R", "SR", "SSR", "UR", "DUST"];

    const randomElement = randomFrom(elementsList);
    const randomRarity = randomFrom(raritiesList);
    const randomName = config.boss_name?.trim() || `${randomFrom(prefix)}${randomFrom(suffix)}`;
    const finalDropName = config.drop_name?.trim() || `【戦果】${randomName}の結晶核`;

    const bossPromptTemplate = config.boss_ai_prompt?.trim() || randomFrom(defaultBossPrompts);
    const dropPromptTemplate = config.drop_ai_prompt?.trim() || randomFrom(defaultDropPrompts);

    const bossPrompt = applyTemplate(bossPromptTemplate, {
      name: randomName,
      element: randomElement,
      rarity: randomRarity,
    });
    const dropPrompt = applyTemplate(dropPromptTemplate, {
      name: randomName,
      element: randomElement,
      rarity: randomRarity,
    });

    let finalBossUrl = config.boss_upload_url?.trim() || "https://placehold.co/300x400/png?text=Auto+Boss";
    let finalDropUrl = config.drop_upload_url?.trim() || "https://placehold.co/300x400/png?text=Auto+Drop";

    if (config.boss_image_mode !== "upload") {
      const bossUrl = await generateAndUploadWithGemini(supabase, bossPrompt, `bosses/auto_${Date.now()}.jpg`);
      if (bossUrl) finalBossUrl = bossUrl;
    }

    if (config.drop_image_mode !== "upload") {
      const dropUrl = await generateAndUploadWithGemini(supabase, dropPrompt, `mint/auto_drop_${Date.now()}.jpg`);
      if (dropUrl) finalDropUrl = dropUrl;
    }

    const { lat, lng } = getRandomCoords(config);

    const generatedHp = Math.floor(Math.random() * 2000) + 1000;
    const generatedAtk = Math.floor(Math.random() * 150) + 50;
    const generatedDef = 50;

    const { data: campData, error: campError } = await supabase
      .from("campaigns")
      .insert([
        {
          title: `【定期出現】${randomName}`,
          sponsor_name: "自動生成システム",
          description: `${randomName} が自動的に出現したランダムボスです。`,
          target_lat: lat,
          target_lng: lng,
          radius_meters: 1500,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (campError) throw campError;
    if (!campData?.id) throw new Error("campaigns 挿入に失敗しました");

    const { error: dropError } = await supabase.from("fixed_cards").insert([
      {
        card_name: finalDropName,
        trigger_type: "boss_drop",
        image_url: finalDropUrl,
        sponsor_id: campData.id,
        stats: { element: randomElement, rarity: randomRarity, hp: 100, atk: 60, def: 40, spd: 80 },
      },
    ]);

    if (dropError) throw dropError;

    const { error: bossError } = await supabase.from("bosses").insert([
      {
        name: randomName,
        hp: generatedHp,
        atk: generatedAtk,
        def: generatedDef,
        element: randomElement,
        image_url: finalBossUrl,
        trigger_campaign_id: campData.id,
        lat,
        lng,
        radius_meters: 1500,
      },
    ]);

    if (bossError) throw bossError;

    return new Response(
      JSON.stringify({
        success: true,
        boss: randomName,
        element: randomElement,
        rarity: randomRarity,
        image_mode: config.boss_image_mode ?? "ai",
        campaign_id: campData.id,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
