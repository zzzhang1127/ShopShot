export interface OfficialTemplate {
  id: string;
  title: string;
  previewVideo: string;
  coverImage: string;
  isNew?: boolean;
  category: string;
  prompt: string;
  duration?: number;
  ratio?: string;
}

export const officialTemplates: OfficialTemplate[] = [
  {
    id: 'clothes-luxury',
    title: '红毯高定鞋履',
    previewVideo: '/templates/clothes.mp4',
    coverImage: '/templates/clothes.jpg',
    category: 'fashion',
    prompt: '高端时尚女鞋，强调材质细节与上脚气质，适合短视频口播带货',
    duration: 20,
    ratio: '9:16',
  },
  {
    id: 'cosmetics-soft',
    title: '修护精华口播',
    previewVideo: '/templates/cosmetics.mp4',
    coverImage: '/templates/cosmetics.jpg',
    category: 'beauty',
    prompt: '护肤品柔和镜头，展示质地、吸收与前后对比',
    duration: 15,
    ratio: '9:16',
  },
  {
    id: 'electronics-clean',
    title: '3C 开箱测评',
    previewVideo: '/templates/electronics.mp4',
    coverImage: '/templates/electronics.jpg',
    category: '3c',
    prompt: '数码产品开箱评测感，突出核心参数与实际场景',
    duration: 20,
    ratio: '9:16',
  },
  {
    id: 'food-closeup',
    title: '零食爆款安利',
    previewVideo: '/templates/food.mp4',
    coverImage: '/templates/food.jpg',
    category: 'food',
    prompt: '食品特写+口播推荐，强调口感与优惠信息',
    duration: 15,
    ratio: '9:16',
  },
  {
    id: 'home-practical',
    title: '家居神器改造',
    previewVideo: '/templates/home.mp4',
    coverImage: '/templates/home.jpg',
    category: 'home',
    prompt: '家居用品前后对比，突出收纳与效率提升',
    duration: 20,
    ratio: '9:16',
  },
  {
    id: 'sports-energy',
    title: '运动装备实测',
    previewVideo: '/templates/sports.mp4',
    coverImage: '/templates/sports.jpg',
    category: 'sports',
    prompt: '运动装备活力风，强调性能和真实体验',
    duration: 15,
    ratio: '9:16',
  },
  {
    id: 'jewelry-premium',
    title: '珠宝礼赠高级感',
    previewVideo: '/templates/jewelry.mp4',
    coverImage: '/templates/jewelry.jpg',
    category: 'jewelry',
    prompt: '珠宝高光质感，强调工艺细节和送礼场景',
    duration: 20,
    ratio: '9:16',
  },
  {
    id: 'high-heel-host',
    title: '高跟鞋口播爆款',
    previewVideo: '/templates/clothes.mp4',
    coverImage: '/templates/clothes.jpg',
    category: 'fashion',
    prompt:
      '20秒高跟鞋口播：开场抓眼球，材质特写，上脚气质，痛点解决，结尾强CTA，适合抖音/TikTok。',
    duration: 20,
    ratio: '9:16',
    isNew: true,
  },
];
