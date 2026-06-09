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
    // customName を受け取れるように追加
    const { base64Image, mimeType, isPremium, customName } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) throw new Error('API Key is missing')

    let rarityInstructions = "画像のポテンシャルを分析し、以下のいずれかのレアリティ(rarity)を割り当ててください。星が多いほど確率は低く設定してください。\n・★★★★(シークレット) - 極低確率\n・☆☆☆☆(アルティメットレア) - 低確率\n・☆☆☆(スーパーレア)\n・☆☆(レア)\n・☆(コモン) - 高確率\n・CP(キャンペーン)\n・P(プロモ)\n・D(ダスト)"
    
    let nameInstruction = "- name: 画像から連想される中二病っぽい、またはシュールでふざけた名前(15文字以内)"
    
    // プレミアムユーザーが名前を指定した場合の強制書き換え
    if (isPremium && customName) {
        nameInstruction = `- name: 必ず「${customName}」という名前にしてください。画像要素に加え、この名前に相応しい強さや特徴をステータス・フレーバーテキストに反映させてください。`
    } else if (isPremium) {
        rarityInstructions = "※この画像は「プレミアムガチャ」で生成された特別製です。レアリティ(rarity)は必ず「★★★★(シークレット)」または「☆☆☆☆(アルティメットレア)」にしてください。"
    }

    const prompt = `あなたは「クソゲーカードゲーム」のパラメータ生成AIです。
添付された画像を分析し、面白いカードとして以下のJSONフォーマットで出力してください。
【ルール】
${nameInstruction}
- feature: 画像と名前に合ったクスッと笑えるフレーバーテキスト(40文字以内)
- skill: シュールな必殺技の名前(15文字以内)
- rarity: レアリティ。${rarityInstructions}
- hp: 50〜1000の整数
- atk: 10〜300の整数
- def: 10〜300の整数
- spd: 10〜300の整数
必ず正しいJSONのみを返し、マークダウン記号(\`\`\`json)は一切含めないでください。`

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: { temperature: 0.8, responseMimeType: "application/json" }
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
