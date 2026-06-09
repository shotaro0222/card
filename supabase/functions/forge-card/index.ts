import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // activeCampaigns（現在開催中のキャンペーンリスト）を受け取れるように拡張
    const { base64Image, mimeType, isPremium, customName, activeCampaigns } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) throw new Error('API Key is missing')

    let rarityInstructions = "画像のポテンシャルを分析し、以下のいずれかのレアリティ(rarity)を割り当ててください。\n・★★★★(シークレット)\n・☆☆☆☆(アルティメットレア)\n・☆☆☆(スーパーレア)\n・☆☆(レア)\n・☆(コモン)\n・D(ダスト)"
    let nameInstruction = "- name: 画像から連想される中二病っぽい、またはシュールでふざけた名前(15文字以内)"
    let systemRoleContext = "あなたは「クソゲーカードゲーム」のパラメータ生成AIです。"

    // ─── 【重要】スポンサー・地域キャンペーンの判定ロジック ───
    let campaignPrompt = ""
    if (activeCampaigns && activeCampaigns.length > 0) {
      campaignPrompt = `現在、以下の特別キャンペーンが開催されています。
${activeCampaigns.map((c: any) => `[ID: ${c.id}] キーワード: "${c.keyword}" -> 報酬カード名: "${c.reward_card_name}", 種類: "${c.campaign_type}"`).join('\n')}

添付された画像が、上記いずれかのキャンペーンの「キーワード」に明確に合致している（その商品や場所が写っている）と判断できる場合、以下のルールを強制適用してください：
1. JSONに "campaign_id" というキーを追加し、合致したキャンペーンのIDを値に設定してください（合致しない場合は null ）。
2. "rarity" は、種類が'sponsor'か'store'なら "CP"、'local'なら "P" にしてください。
3. "name" は、指定された「報酬カード名」を含んだ面白い名前に書き換えてください。`
    }

    if (isPremium && customName) {
        nameInstruction = `- name: 必ず「${customName}」という名前にしてください。`
    } else if (isPremium) {
        rarityInstructions = "※レアリティ(rarity)は必ず「★★★★(シークレット)」または「☆☆☆☆(アルティメットレア)」にしてください。"
    }

    const prompt = `${systemRoleContext}
添付された画像を分析し、面白いカードとして以下のJSONフォーマットで出力してください。

${campaignPrompt}

【基本ルール】
${nameInstruction}
- feature: 画像と名前に合ったクスッと笑えるフレーバーテキスト(40文字以内)
- skill: シュールな必殺技の名前(15文字以内)
- rarity: レアリティ。${rarityInstructions}
- hp: 50〜1000の整数
- atk: 10〜300の整数
- def: 10〜300の整数
- spd: 10〜300の整数

必ず正しいJSONのみを返し、マークダウン記号(\`\`\`json)は一切含めないでください。
※キャンペーンに合致した場合は、必ず "campaign_id": "合致したID" をJSONに含めてください。含めない場合は "campaign_id": null としてください。`

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
    }

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const result = await response.json()
    const textOutput = result.candidates[0].content.parts[0].text
    const cleanJsonString = textOutput.replace(/```json/g, '').replace(/```/g, '').trim()
    const cardData = JSON.parse(cleanJsonString)

    return new Response(JSON.stringify(cardData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
