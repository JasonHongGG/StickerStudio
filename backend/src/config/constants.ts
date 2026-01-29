/**
 * Backend Configuration Constants
 */

export const API_CONFIG = {
    gemini: {
        modelName: 'gemini-3-pro-image-preview',
    },
    local: {
        modelName: 'gemini-3-pro-image-preview',
        defaultHost: '127.0.0.1',
        defaultPort: 8000,
        endpoints: {
            health: '/health',
            chat: '/chat',
            stream: '/stream',
        }
    }
};

// Special IDs for emotion/action options
export const SAME_AS_REF_ID = 'same-as-ref';
export const AUTO_MATCH_ID = 'auto-match';
export const CUSTOM_ACTION_ID = 'custom-action';
export const CUSTOM_EMOTION_ID = 'custom-emotion';

// Emotion definitions with English prompts for AI
export const EMOTIONS = [
    { id: 'happy', name: '😊 開心 / 微笑', enName: 'Happy, smiling cheerfully' },
    { id: 'laugh', name: '😆 大笑 / 爆笑', enName: 'Laughing out loud, eyes closed in joy' },
    { id: 'angry', name: '💢 生氣 / 憤怒', enName: 'Angry, furious, veins popping' },
    { id: 'sad', name: '😢 難過 / 泛淚', enName: 'Sad, teary eyes, frowning' },
    { id: 'crying', name: '😭 痛哭 / 流淚', enName: 'Crying loudly, tears streaming down' },
    { id: 'shocked', name: '😱 驚嚇 / 下巴掉', enName: 'Shocked, screaming, jaw dropping' },
    { id: 'shy', name: '😳 害羞 / 臉紅', enName: 'Shy, blushing face, looking away' },
    { id: 'love', name: '😍 喜愛 / 眼冒愛心', enName: 'In love, heart-shaped eyes' },
    { id: 'confused', name: '❓ 疑惑 / 不解', enName: 'Confused, questioning expression' },
    { id: 'tired', name: '😫 疲累 / 眼神死', enName: 'Exhausted, dead fish eyes, dark circles' },
    { id: 'confident', name: '😏 自信 / 跩', enName: 'Smug, confident smirk' },
    { id: 'scared', name: '😨 害怕 / 發抖', enName: 'Scared, pale face, shivering' },
    { id: 'speechless', name: '😑 無言 / 點點點', enName: 'Speechless, expressionless, annoyed' },
    { id: 'excited', name: '🤩 期待 / 星星眼', enName: 'Excited, starry eyes, anticipating' },
];

// Action definitions with English prompts for AI
export const COMMON_ACTIONS = [
    { id: 'thumbs_up', name: '👍 比讚 / 同意', enName: 'Giving a thumbs up gesture' },
    { id: 'ok_sign', name: '👌 OK手勢', enName: 'Making an OK sign with hand' },
    { id: 'heart_hands', name: '🫶 比愛心', enName: 'Making heart shape with hands' },
    { id: 'bowing', name: '🙇 土下座 / 道歉', enName: 'Bowing down deeply on knees (dogeza)' },
    { id: 'clapping', name: '👏 拍手 / 鼓掌', enName: 'Clapping hands' },
    { id: 'cheering', name: '🙌 歡呼 / 舉雙手', enName: 'Raising both hands in victory' },
    { id: 'running', name: '🏃 奔跑 / 趕路', enName: 'Running fast, motion lines' },
    { id: 'working', name: '💻 打電腦 / 工作', enName: 'Typing on a laptop, busy' },
    { id: 'eating', name: '🍜 吃東西 / 美味', enName: 'Eating delicious food, holding chopsticks/spoon' },
    { id: 'sleeping', name: '😴 睡覺', enName: 'Sleeping, snot bubble, Zzz' },
    { id: 'phone', name: '📱 滑手機', enName: 'Looking at smartphone' },
    { id: 'pointing', name: '👉 指人 / 確認', enName: 'Pointing finger forward' },
    { id: 'stop', name: '🙅 打叉 / 拒絕', enName: 'Crossing arms in X shape, refusing' },
];
