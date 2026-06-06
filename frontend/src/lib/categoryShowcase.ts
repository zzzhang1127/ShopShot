/** 类目示例视频（与 backend CATEGORY_DEFS 媒体映射一致）— API 不可用时作回退 */
export type CategoryShowcase = {
  id: string;
  label: string;
  previewVideo: string;
  coverImage: string;
  sampleTitle: string;
  samplePrompt: string;
};

export const CATEGORY_SHOWCASE: CategoryShowcase[] = [
  { id: 'fashion', label: '服饰鞋包', previewVideo: '/templates/clothes.mp4', coverImage: '/templates/clothes.jpg', sampleTitle: '时尚穿搭口播', samplePrompt: '高端时尚单品，强调材质与上脚/上身气质，适合短视频口播带货' },
  { id: 'beauty', label: '美妆护肤', previewVideo: '/templates/cosmetics.mp4', coverImage: '/templates/cosmetics.jpg', sampleTitle: '修护精华口播', samplePrompt: '护肤品柔和镜头，展示质地、吸收与前后对比' },
  { id: 'skincare', label: '护肤保养', previewVideo: '/templates/cosmetics.mp4', coverImage: '/templates/cosmetics.jpg', sampleTitle: '面膜种草', samplePrompt: '护肤步骤演示，突出成分与使用效果' },
  { id: 'makeup', label: '彩妆造型', previewVideo: '/templates/cosmetics.mp4', coverImage: '/templates/cosmetics.jpg', sampleTitle: '口红试色', samplePrompt: '彩妆特写，展示色号与妆效' },
  { id: '3c', label: '数码3C', previewVideo: '/templates/electronics.mp4', coverImage: '/templates/electronics.jpg', sampleTitle: '3C 开箱测评', samplePrompt: '数码产品开箱，突出核心参数与实际场景' },
  { id: 'electronics', label: '智能电子', previewVideo: '/templates/electronics.mp4', coverImage: '/templates/electronics.jpg', sampleTitle: '智能设备演示', samplePrompt: '智能家居/电子好物功能演示' },
  { id: 'food', label: '美食餐饮', previewVideo: '/templates/food.mp4', coverImage: '/templates/food.jpg', sampleTitle: '零食爆款安利', samplePrompt: '食品特写+口播推荐，强调口感与优惠' },
  { id: 'snack', label: '休闲零食', previewVideo: '/templates/food.mp4', coverImage: '/templates/food.jpg', sampleTitle: '零食开箱', samplePrompt: '零食近景展示，强调酥脆/风味' },
  { id: 'home', label: '家居生活', previewVideo: '/templates/home.mp4', coverImage: '/templates/home.jpg', sampleTitle: '家居神器改造', samplePrompt: '家居用品前后对比，突出收纳与效率' },
  { id: 'furniture', label: '家具软装', previewVideo: '/templates/home.mp4', coverImage: '/templates/home.jpg', sampleTitle: '家具场景展示', samplePrompt: '家具在真实居家场景中的效果' },
  { id: 'kitchen', label: '厨房好物', previewVideo: '/templates/home.mp4', coverImage: '/templates/home.jpg', sampleTitle: '厨房神器', samplePrompt: '厨房用品使用演示，突出省时省力' },
  { id: 'sports', label: '运动户外', previewVideo: '/templates/sports.mp4', coverImage: '/templates/sports.jpg', sampleTitle: '运动装备实测', samplePrompt: '运动装备活力风，强调性能与体验' },
  { id: 'fitness', label: '健身装备', previewVideo: '/templates/sports.mp4', coverImage: '/templates/sports.jpg', sampleTitle: '健身好物', samplePrompt: '健身场景展示产品实用性' },
  { id: 'jewelry', label: '珠宝首饰', previewVideo: '/templates/jewelry.mp4', coverImage: '/templates/jewelry.jpg', sampleTitle: '珠宝礼赠高级感', samplePrompt: '珠宝高光质感，工艺细节与送礼场景' },
  { id: 'accessories', label: '时尚配饰', previewVideo: '/templates/jewelry.mp4', coverImage: '/templates/jewelry.jpg', sampleTitle: '配饰搭配', samplePrompt: '配饰特写与穿搭组合展示' },
  { id: 'baby', label: '母婴用品', previewVideo: '/templates/home.mp4', coverImage: '/templates/home.jpg', sampleTitle: '母婴好物', samplePrompt: '母婴产品安全温和卖点展示' },
  { id: 'pet', label: '宠物用品', previewVideo: '/templates/food.mp4', coverImage: '/templates/food.jpg', sampleTitle: '宠物零食', samplePrompt: '宠物用品/食品可爱场景展示' },
  { id: 'automotive', label: '车载用品', previewVideo: '/templates/electronics.mp4', coverImage: '/templates/electronics.jpg', sampleTitle: '车载神器', samplePrompt: '车内场景展示车载产品实用性' },
  { id: 'office', label: '办公效率', previewVideo: '/templates/electronics.mp4', coverImage: '/templates/electronics.jpg', sampleTitle: '办公好物', samplePrompt: '桌面场景提升效率的办公产品' },
  { id: 'health', label: '健康保健', previewVideo: '/templates/cosmetics.mp4', coverImage: '/templates/cosmetics.jpg', sampleTitle: '健康补给', samplePrompt: '健康产品成分与使用场景' },
  { id: 'outdoor', label: '露营户外', previewVideo: '/templates/sports.mp4', coverImage: '/templates/sports.jpg', sampleTitle: '户外装备', samplePrompt: '户外场景展示装备可靠性' },
  { id: 'travel', label: '旅行收纳', previewVideo: '/templates/home.mp4', coverImage: '/templates/home.jpg', sampleTitle: '旅行必备', samplePrompt: '旅行收纳与便携好物演示' },
  { id: 'books', label: '图书文创', previewVideo: '/templates/home.mp4', coverImage: '/templates/home.jpg', sampleTitle: '图书安利', samplePrompt: '图书/文创产品质感展示' },
  { id: 'virtual', label: '虚拟课程', previewVideo: '/templates/electronics.mp4', coverImage: '/templates/electronics.jpg', sampleTitle: '在线课程', samplePrompt: '虚拟商品/课程价值点口播' },
];

export function fallbackCatalogTemplates() {
  return CATEGORY_SHOWCASE.map((c) => ({
    id: `fallback-${c.id}`,
    title: c.sampleTitle,
    category: c.id,
    category_label: c.label,
    prompt: c.samplePrompt,
    previewVideo: c.previewVideo,
    coverImage: c.coverImage,
    duration: 20,
    ratio: '9:16',
    video_mode: c.id,
  }));
}

export type CategoryChip = {
  id: string;
  label: string;
  count: number;
  previewVideo: string;
  coverImage: string;
};

export const PRIMARY_CATEGORY_IDS = [
  'fashion',
  'beauty',
  '3c',
  'food',
  'home',
  'sports',
  'jewelry',
] as const;

export function primaryCategoryShowcase(): CategoryShowcase[] {
  const map = new Map(CATEGORY_SHOWCASE.map((c) => [c.id, c]));
  return PRIMARY_CATEGORY_IDS.map((id) => map.get(id)!).filter(Boolean);
}

export function categoriesFromShowcase(primaryOnly = false): CategoryChip[] {
  const list = primaryOnly ? primaryCategoryShowcase() : CATEGORY_SHOWCASE;
  return list.map((c) => ({
    id: c.id,
    label: c.label,
    count: 0,
    previewVideo: c.previewVideo,
    coverImage: c.coverImage,
  }));
}

export function mergeCategoryMedia(
  apiCats: Array<{ id: string; label: string; count: number; preview_video?: string; cover_image?: string }>
): CategoryChip[] {
  const media = new Map(CATEGORY_SHOWCASE.map((c) => [c.id, c]));
  return apiCats.map((c) => {
    const fb = media.get(c.id);
    return {
      id: c.id,
      label: c.label,
      count: c.count,
      previewVideo: c.preview_video || fb?.previewVideo || '/templates/clothes.mp4',
      coverImage: c.cover_image || fb?.coverImage || '/templates/clothes.jpg',
    };
  });
}
