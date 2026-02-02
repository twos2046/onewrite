export const BRAND_NAME = '一心成剧';
export const BRAND_TAGLINE = 'AI漫剧制作工作流';
export const BRAND_SUBTITLE = '小说创作、分镜、剧本、制片准备、拍摄合成，一站式完成';
export const BRAND_DESCRIPTION = '将灵感化为可拍可播的漫剧作品';
export const BRAND_SLOGAN = '从灵感到成片，一站成剧';
export const BRAND_POWERED_BY = '一心成剧';

export const NAV_LABELS = {
  create: '一心创作',
  script: '一心做剧本',
  preparation: '一心准备',
  filming: '一心拍戏',
  community: '社区广场',
  parallel: '平行世界',
  novels: '看小说',
} as const;

export const NAV_SHORT_LABELS = {
  create: '创作',
  script: '剧本',
  filming: '拍戏',
  community: '广场',
} as const;

export const WORKFLOW_STEPS = [
  {
    id: 'story',
    title: '故事创作',
    description: '灵感输入、类型设定与章节生成',
    path: '/',
  },
  {
    id: 'visual',
    title: '角色与分镜',
    description: '角色设计与漫画分镜制作',
    path: '/',
  },
  {
    id: 'script',
    title: '剧本生成',
    description: '标准剧本与解说内容一键生成',
    path: '/script',
  },
  {
    id: 'prep',
    title: '制片准备',
    description: '服化道与布景等专业分析',
    path: '/preparation',
  },
  {
    id: 'filming',
    title: '拍摄合成',
    description: '配音与视频合成导出成片',
    path: '/filming',
  },
] as const;
