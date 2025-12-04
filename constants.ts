import { Expression, StickerStyle } from './types';

export const STYLES: StickerStyle[] = [
  { id: 'none', name: '無 (和原始圖片風格一致)', promptSuffix: 'keep the original art style exactly' },
  { id: 'anime', name: '日系動漫風格', promptSuffix: 'in high-quality Japanese anime style, cel shading, vibrant colors, clean lines, key visual quality' },
  { id: 'chibi', name: 'Q版可愛 (二頭身)', promptSuffix: 'in super cute Chibi style, 2 heads tall ratio, big head small body, kawaii, simplified details' },
  { id: 'flat', name: '扁平向量插畫', promptSuffix: 'in modern flat vector illustration style, minimal shading, bold shapes, clean solid colors, corporate memphis style' },
  { id: 'watercolor', name: '水彩手繪風', promptSuffix: 'in artistic watercolor style, hand-painted texture, wet-on-wet technique, soft edges, ink wash painting vibe, on paper texture' },
  { id: 'cartoon', name: '美式卡通風格', promptSuffix: 'in classic American cartoon style, thick bold outlines, exaggerated expressions, saturday morning cartoon vibe' },
  { id: '3d', name: '3D 渲染 / 黏土風', promptSuffix: 'in 3D rendering style, clay material (plasticine), blind box toy texture, soft studio lighting, ambient occlusion, cute 3D character' },
];

export const EXPRESSIONS: Expression[] = [
  { id: 'happy', name: '😊 開心 / 歡呼', enName: 'Happy, smiling cheerfully', defaultChecked: true },
  { id: 'awkward', name: '🤔 尷尬 / 不自在', enName: 'Awkward smile, sweat drop'},
  { id: 'scared', name: '😨 害怕 / 躲避', enName: 'Scared, terrified expression'},
  { id: 'crying', name: '😭 哭泣 / 流淚', enName: 'Crying, tears streaming down' },
  { id: 'angry', name: '💢 生氣 / 翻桌', enName: 'Angry, furious, rage' },
  { id: 'reject', name: '🙅‍♂️ 不要 / 拒絕', enName: 'Refusing, saying no, crossing arms' },
  { id: 'sorry', name: '🙇‍♂️ 對不起 / 土下座', enName: 'Apologetic, bowing down, sorry' },
  { id: 'tired', name: '😫 好累 / 眼神死', enName: 'Exhausted, dead eyes, tired' },
  { id: 'shocked_shiver', name: '😨 嚇到 / 發抖', enName: 'Shocked, shivering in fear' },
  { id: 'ok', name: '👌 OK / 沒問題', enName: 'OK gesture, confident, fine' },
  { id: 'lol', name: '😆 大笑 / 笑死', enName: 'Laughing out loud, LOL' },
  { id: 'shocked', name: '😱 驚訝 / 震驚', enName: 'Shocked face, screaming' },
  { id: 'confused', name: '❓ 疑惑 / 蛤?', enName: 'Confused, question mark face' },
  { id: 'shy', name: '😳 害羞 / 臉紅', enName: 'Shy, blushing face' },
  { id: 'speechless', name: '💬 無言 / 點點點', enName: 'Speechless, dot dot dot' },
  { id: 'cool', name: '😎 耍帥 / 墨鏡', enName: 'Cool, wearing sunglasses' },
  { id: 'excited', name: '🤩 期待 / 發光', enName: 'Excited, starry eyes' },
  { id: 'busy', name: '💻 忙碌 / 工作中', enName: 'Busy working, typing on laptop' },
  { id: 'on_my_way', name: '🏃 馬上到 / 趕路', enName: 'Running, in a hurry, on my way' },
  { id: 'please', name: '🥺 拜託 / 請求', enName: 'Begging, puppy eyes, please' },
  { id: 'yummy', name: '😋 好吃 / 吃飯', enName: 'Yummy, licking lips, eating' },
  { id: 'tea', name: '☕ 喝茶 / 休息', enName: 'Drinking tea, relaxing, break time' },
  { id: 'sleep', name: '😴 睡覺 / Zzz', enName: 'Sleeping, Zzz, snot bubble' },
  { id: 'peeking', name: '👻 偷看 / 暗中觀察', enName: 'Peeking through fingers, observing secretly' },
  { id: 'idea', name: '💡 想到好點子', enName: 'Idea, lightbulb moment' },
  { id: 'sick', name: '😷 生病 / 口罩', enName: 'Sick, wearing mask' },
  { id: 'bath', name: '🛁 洗澡 / 舒服', enName: 'Taking a bath, relaxing' },
  { id: 'shopping', name: '🛍️ 購物 / 買買買', enName: 'Shopping, holding bags' },
  { id: 'study', name: '📖 讀書 / 學習', enName: 'Studying, reading book' },
  { id: 'game', name: '🎮 玩遊戲 / 耍廢', enName: 'Playing video games, lazy' },
  { id: 'phone', name: '📱 滑手機 / 已讀', enName: 'Looking at phone, scrolling' },
  { id: 'drive', name: '🚗 開車 / 兜風', enName: 'Driving a car' },
  { id: 'rain', name: '☔ 下雨 / 撐傘', enName: 'Raining, holding umbrella' },
  { id: 'hot', name: '🥵 好熱 / 融化', enName: 'Hot weather, melting, sweating' },
  { id: 'cold', name: '🥶 好冷 / 發抖', enName: 'Freezing cold, blue face' },
];

export const SYSTEM_PROMPT = `
You are an expert Sticker Artist.

**CRITICAL RULES:**
1. **Match Source Framing EXACTLY**:
   - IF the Reference Image is **Half-Body** (Head & Shoulders), you MUST output **Half-Body**. Do NOT invent legs or a lower body.
   - IF the Reference Image is **Full-Body**, you MUST output **Full-Body**.
   - Do NOT change the body proportions or head-to-body ratio unless the Style explicitly asks for it (e.g. Chibi).

2. **Character Identity**:
   - Maintain the character's species, eye shape, markings, and key features perfectly.

3. **Background**: Always Solid Green #00FF00.

4. **Refinement/Editing**:
   - When asked to add items (e.g., "add sunglasses"), keep the **original pose and composition** as stable as possible. Only modify the necessary area.

5. **Text Handling**: 
   - Only add text if the user input is a specific spoken phrase. 
   - Never write metadata like "Theme" or "Style" as text.
`;