import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CARD_GENERATION_PROMPT } from '@/lib/prompt'; // プロンプトをインポート

// .envからキーを取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imageParts = [
      {
        inlineData: {
          data: imageBase64.split(',')[1], // 'data:image/jpeg;base64,' の後ろのデータ部分
          mimeType: "image/jpeg"
        }
      }
    ];

    const result = await model.generateContent([CARD_GENERATION_PROMPT, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
    // JSONとしてパースして返す
    const cardData = JSON.parse(text);
    return NextResponse.json(cardData);

  } catch (error) {
    console.error('AI生成エラー:', error);
    return NextResponse.json({ error: 'カードの生成に失敗しました' }, { status: 500 });
  }
}