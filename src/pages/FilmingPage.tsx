import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { 
  getCurrentUser, 
  getUserNovels,
  createFilmingScene,
  createCompositeImage,
  createFilmingVideo,
  createFinalVideo,
  getChapterFilmingScenes,
  getSceneCompositeImages,
  getSceneVideos,
  deleteCompositeImage,
  deleteFilmingVideo,
  getAIModelConfig,
  updateNovelScripts,
  updateScenesNarration,
  updateSceneNarrationAudio,
  updateCompositeImagesOrder,
  getAllSystemSettings
} from "@/db/api";
import { supabase } from "@/db/supabase";
import type { DbNovel, CostumeItem, MakeupItem, PropItem, SceneItem, CharacterData, ScriptData, SceneSegment } from "@/types/database";
import { Loader2, Film, Upload, Play, Download, ArrowLeft, Image as ImageIcon, Sparkles, Video, Info, Trash2, ImagePlus, Volume2, GripVertical, FileText, Copy, ExternalLink } from "lucide-react";
import { DraggableCanvas, type CanvasElement } from "@/components/filming/DraggableCanvas";
import { compositeImagesWithRetry, image2VideoWithRetry } from "@/utils/filming-api";
import { uploadImageToStorage, uploadBlobToStorage } from "@/utils/storage-helper";
import { addCacheBuster } from "@/utils/cache-buster";
import { sendChatStream } from "@/utils/chatStream";
import { sendOpenAIStream } from "@/utils/openaiStream";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_RETRIES = 10; // 最大重试次数

// 可排序的图片卡片组件
interface SortableImageCardProps {
  image: {
    id: string;
    url: string;
    prompt: string;
    isPlaceholder?: boolean;
  };
  videos: Array<{ id: string; url: string; compositeImageId: string }>;
  audioFiles: Array<{ id: string; url: string; videoId: string }>;
  videoPrompts: Record<string, string>;
  generatingVideoIds: Set<string>;
  hoveredVideoId: string | null;
  selectedNovel: any;
  selectedChapter: number;
  isDemoMode: boolean;
  onDeleteImage: (id: string) => void;
  onVideoPromptChange: (prompts: Record<string, string>) => void;
  onGenerateVideo: (imageId: string, imageUrl: string) => void;
  onDeleteVideo: (videoId: string) => void;
  onExtractLastFrame: (videoUrl: string) => void;
  onHoverVideo: (id: string | null) => void;
  extractVideoPromptFromScene: (scenePrompt: string) => string;
}

function SortableImageCard(props: SortableImageCardProps) {
  const {
    image,
    videos,
    audioFiles,
    videoPrompts,
    generatingVideoIds,
    hoveredVideoId,
    selectedNovel,
    selectedChapter,
    isDemoMode,
    onDeleteImage,
    onVideoPromptChange,
    onGenerateVideo,
    onDeleteVideo,
    onExtractLastFrame,
    onHoverVideo,
    extractVideoPromptFromScene,
  } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 占位符不可拖拽
  const dragHandleProps = image.isPlaceholder ? {} : { ...attributes, ...listeners };

  // 获取默认视频提示词
  const defaultVideoPrompt = extractVideoPromptFromScene(image.prompt);
  const currentVideoPrompt = videoPrompts[image.id] || defaultVideoPrompt;

  // 检查是否正在生成视频
  const isGenerating = generatingVideoIds.has(image.id);

  // 查找该图片对应的视频
  const relatedVideos = videos.filter(v => v.compositeImageId === image.id);

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* 拖拽手柄和图片 */}
          <div className="relative">
            {!image.isPlaceholder && (
              <div
                {...dragHandleProps}
                className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing bg-background/80 rounded p-1 hover:bg-background"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            
            {image.isPlaceholder ? (
              // 占位符：显示加载动画
              (<div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">图片生成中...</p>
              </div>)
            ) : (
              // 真实图片
              (<>
                <img
                  src={image.url}
                  alt="合成图片"
                  className="w-full rounded-md"
                />
                {!isDemoMode && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => onDeleteImage(image.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>)
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">场景提示词: {image.prompt}</p>
          
          {/* 只有真实图片才显示视频生成功能 */}
          {!image.isPlaceholder && !isDemoMode && (
            <div className="space-y-2">
              {/* 视频提示词输入 */}
              <div className="space-y-2">
                <Label className="text-xs">视频生成提示词</Label>
                <Textarea
                  placeholder="描述视频的动作、镜头运动等..."
                  className="min-h-[80px] text-sm"
                  value={currentVideoPrompt}
                  onChange={(e) => {
                    const newPrompts = { ...videoPrompts, [image.id]: e.target.value };
                    onVideoPromptChange(newPrompts);
                  }}
                />
              </div>

              {/* 生成视频按钮或加载状态 */}
              {isGenerating ? (
                // 正在生成视频，显示加载动画
                (<div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">视频生成中...</p>
                </div>)
              ) : (
                // 未生成或已生成，都显示生成按钮
                (<Button
                  onClick={() => onGenerateVideo(image.id, image.url)}
                  disabled={isGenerating}
                  className="w-full"
                >
                  <Video className="mr-2 h-4 w-4" />
                  {relatedVideos.length > 0 ? '重新生成视频' : '生成视频'}
                </Button>)
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 场景资源类型
interface SceneResource {
  id: string;
  type: 'character' | 'costume' | 'makeup' | 'prop' | 'scene';
  name: string;
  description: string;
  imageUrl: string;
}

export default function FilmingPage() {
  const navigate = useNavigate();
  
  const [novels, setNovels] = useState<DbNovel[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<string>("");
  const [selectedNovel, setSelectedNovel] = useState<DbNovel | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // 场景资源
  const [characters, setCharacters] = useState<SceneResource[]>([]);
  const [costumes, setCostumes] = useState<SceneResource[]>([]);
  const [makeups, setMakeups] = useState<SceneResource[]>([]);
  const [props, setProps] = useState<SceneResource[]>([]);
  const [scenes, setScenes] = useState<SceneResource[]>([]);

  // 画布状态
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
  const [scenePrompt, setScenePrompt] = useState<string>("");
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  
  // 视频提示词状态（每个图片对应一个提示词）
  const [videoPrompts, setVideoPrompts] = useState<Record<string, string>>({});
  
  // 生成状态
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatingVideoIds, setGeneratingVideoIds] = useState<Set<string>>(new Set());
  const [isBatchGeneratingVideos, setIsBatchGeneratingVideos] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null); // 悬浮的视频ID
  
  // 批量生成场景选择对话框状态
  const [showSceneSelectionDialog, setShowSceneSelectionDialog] = useState(false);
  const [selectedSceneNumbers, setSelectedSceneNumbers] = useState<number[]>([]);
  const [showReferenceImageDialog, setShowReferenceImageDialog] = useState(false);
  const [selectedReferenceImageId, setSelectedReferenceImageId] = useState<string>("");
  
  // 生成结果
  const [compositeImages, setCompositeImages] = useState<Array<{
    id: string;
    url: string;
    prompt: string;
    isPlaceholder?: boolean; // 标记是否为占位符
  }>>([]);
  const [videos, setVideos] = useState<Array<{
    id: string;
    url: string;
    compositeImageId: string;
  }>>([]);
  const [audioFiles, setAudioFiles] = useState<Array<{
    id: string;
    url: string;
    videoId: string;
  }>>([]);
  
  // 解说生成状态
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [narrationsGenerated, setNarrationsGenerated] = useState(false);
  const [hasExistingNarrations, setHasExistingNarrations] = useState(false); // 是否已有解说数据
  const [hasExistingAudio, setHasExistingAudio] = useState(false); // 是否已有配音数据
  
  // 视频合并对话框状态
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [sortedVideos, setSortedVideos] = useState<Array<{
    id: string;
    url: string;
    compositeImageId: string;
  }>>([]);
  const [isMergingVideos, setIsMergingVideos] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string>(''); // 合并后的视频URL

  // 演示模式状态
  const [isDemoMode, setIsDemoMode] = useState(false);
  const DEMO_NOVEL_ID = '98da6547-d8f7-4219-94ca-212eb0738947'; // 逆袭AI之巅：一心成剧的代码狂潮
  
  // 视频合成工具URL
  const [videoMergeToolUrl, setVideoMergeToolUrl] = useState<string>('');

  // 获取当前用户的小说列表
  useEffect(() => {
    let isMounted = true; // 标记组件是否已挂载

    const fetchNovels = async () => {
      try {
        const user = await getCurrentUser();
        
        // 检查组件是否仍然挂载
        if (!isMounted) {
          // console.log("⚠️ 组件已卸载，取消设置状态");
          return;
        }
        
        if (!user) {
          toast.error("请先登录");
          navigate("/");
          return;
        }

        const userNovels = await getUserNovels(user.id);
        
        // 再次检查组件是否仍然挂载
        if (!isMounted) {
          // console.log("⚠️ 组件已卸载，取消设置状态");
          return;
        }
        
        // 只显示有剧本的小说
        const novelsWithScripts = userNovels.filter(novel => 
          novel.scripts_data && novel.scripts_data.length > 0
        );
        setNovels(novelsWithScripts);
      } catch (error) {
        // 如果是 AbortError，不显示错误提示
        if (error instanceof Error && error.name === 'AbortError') {
          // console.log("⚠️ 请求被取消（组件卸载或 Strict Mode）");
          return;
        }
        
        // 检查组件是否仍然挂载
        if (!isMounted) {
          // console.log("⚠️ 组件已卸载，取消显示错误");
          return;
        }
        
        console.error("获取小说列表失败:", error);
        toast.error("获取小说列表失败");
      } finally {
        // 检查组件是否仍然挂载
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    fetchNovels();

    // 清理函数：组件卸载时设置标记
    return () => {
      isMounted = false;
      // console.log("🧹 FilmingPage useEffect 清理：组件卸载");
    };
  }, [navigate]);
  
  // 加载视频合成工具URL
  useEffect(() => {
    const loadVideoMergeToolUrl = async () => {
      try {
        const settings = await getAllSystemSettings();
        const urlSetting = settings.find(s => s.key === 'video_merge_tool_url');
        if (urlSetting) {
          setVideoMergeToolUrl(urlSetting.value);
          // console.log('📎 视频合成工具URL:', urlSetting.value);
        }
      } catch (error) {
        console.error('❌ 加载视频合成工具URL失败:', error);
      }
    };
    
    loadVideoMergeToolUrl();
  }, []);

  // 当选择小说和章节时，加载场景资源
  useEffect(() => {
    if (!selectedNovel || selectedChapter === 0) {
      setCharacters([]);
      setCostumes([]);
      setMakeups([]);
      setProps([]);
      setScenes([]);
      setCompositeImages([]);
      setVideos([]);
      setAudioFiles([]);
      setCurrentSceneId(null);
      return;
    }

    // console.log(`📚 加载第${selectedChapter}章的场景资源...`);

    // 加载角色图片
    const characterResources: SceneResource[] = [];
    if (selectedNovel.characters_data) {
      selectedNovel.characters_data.forEach((char: CharacterData) => {
        if (char.image_url) {
          characterResources.push({
            id: `character_${char.name}`,
            type: 'character',
            name: char.name,
            description: char.description || '',
            imageUrl: char.image_url
          });
        }
      });
    }
    setCharacters(characterResources);
    // console.log(`✅ 加载了${characterResources.length}个角色图片`);

    // 加载服装图片
    const costumeResources: SceneResource[] = [];
    if (selectedNovel.costume_data) {
      selectedNovel.costume_data
        .filter((item: CostumeItem) => item.chapter_number === selectedChapter)
        .forEach((item: CostumeItem) => {
          if (item.image_urls && item.image_urls.length > 0) {
            item.image_urls.forEach((url: string, index: number) => {
              costumeResources.push({
                id: `costume_${item.character}_${index}`,
                type: 'costume',
                name: `${item.character}的${item.description}`,
                description: `${item.material} ${item.color} ${item.style}`,
                imageUrl: url
              });
            });
          }
        });
    }
    setCostumes(costumeResources);
    // console.log(`✅ 加载了${costumeResources.length}个服装图片`);

    // 加载化妆图片
    const makeupResources: SceneResource[] = [];
    if (selectedNovel.makeup_data) {
      selectedNovel.makeup_data
        .filter((item: MakeupItem) => item.chapter_number === selectedChapter)
        .forEach((item: MakeupItem) => {
          if (item.image_urls && item.image_urls.length > 0) {
            item.image_urls.forEach((url: string, index: number) => {
              makeupResources.push({
                id: `makeup_${item.character}_${index}`,
                type: 'makeup',
                name: `${item.character}的${item.description}`,
                description: `${item.style} ${item.details}`,
                imageUrl: url
              });
            });
          }
        });
    }
    setMakeups(makeupResources);
    // console.log(`✅ 加载了${makeupResources.length}个化妆图片`);

    // 加载道具图片
    const propResources: SceneResource[] = [];
    if (selectedNovel.props_data) {
      selectedNovel.props_data
        .filter((item: PropItem) => item.chapter_number === selectedChapter)
        .forEach((item: PropItem) => {
          if (item.image_urls && item.image_urls.length > 0) {
            item.image_urls.forEach((url: string, index: number) => {
              propResources.push({
                id: `prop_${item.name}_${index}`,
                type: 'prop',
                name: item.name,
                description: `${item.description} ${item.function}`,
                imageUrl: url
              });
            });
          }
        });
    }
    setProps(propResources);
    // console.log(`✅ 加载了${propResources.length}个道具图片`);

    // 加载布景图片
    const sceneResources: SceneResource[] = [];
    if (selectedNovel.scene_data) {
      selectedNovel.scene_data
        .filter((item: SceneItem) => item.chapter_number === selectedChapter)
        .forEach((item: SceneItem) => {
          if (item.image_urls && item.image_urls.length > 0) {
            item.image_urls.forEach((url: string, index: number) => {
              sceneResources.push({
                id: `scene_${item.location}_${index}`,
                type: 'scene',
                name: item.location,
                description: `${item.layout} ${item.atmosphere}`,
                imageUrl: url
              });
            });
          }
        });
    }
    setScenes(sceneResources);
    // console.log(`✅ 加载了${sceneResources.length}个布景图片`);

    // 查询是否存在已保存的scene
    loadExistingScene();

  }, [selectedNovel, selectedChapter]);

  // 查询并加载已存在的scene
  const loadExistingScene = async () => {
    if (!selectedNovel || selectedChapter === 0) {
      return;
    }

    try {
      // console.log(`🔍 查询第${selectedChapter}章是否存在已保存的场景...`);
      
      const scenes = await getChapterFilmingScenes(selectedNovel.id, selectedChapter);
      
      if (scenes && scenes.length > 0) {
        // 使用第一个scene（通常每个章节只有一个scene）
        const scene = scenes[0];
        // console.log(`✅ 找到已保存的场景:`, scene.id);
        setCurrentSceneId(scene.id);
        
        // 检查是否已有解说数据
        const hasNarrations = scenes.some((s: any) => s.narration_text && s.narration_text.trim().length > 0);
        setHasExistingNarrations(hasNarrations);
        if (hasNarrations) {
          // console.log('📝 检测到已有解说数据');
          setNarrationsGenerated(true);
        }
        
        // 检查是否已有配音数据
        const hasAudio = scenes.some((s: any) => s.narration_audio_url && s.narration_audio_url.trim().length > 0);
        setHasExistingAudio(hasAudio);
        if (hasAudio) {
          // console.log('🎵 检测到已有配音数据');
        }
        
        // currentSceneId变化会触发loadSavedFilmingData
      } else {
        // console.log(`ℹ️ 第${selectedChapter}章还没有保存的场景`);
        setCurrentSceneId(null);
        setHasExistingNarrations(false);
        setHasExistingAudio(false);
      }
    } catch (error) {
      console.error('❌ 查询场景失败:', error);
      setCurrentSceneId(null);
      setHasExistingNarrations(false);
    }
  };

  // 当currentSceneId变化时，加载已保存的拍摄数据
  useEffect(() => {
    if (currentSceneId) {
      loadSavedFilmingData();
    }
  }, [currentSceneId]);

  // 加载已保存的拍摄数据
  const loadSavedFilmingData = async () => {
    if (!selectedNovel || selectedChapter === 0 || !currentSceneId) {
      return;
    }

    try {
      // console.log(`📥 加载第${selectedChapter}章的已保存拍摄数据...`);
      // console.log(`📍 currentSceneId:`, currentSceneId);

      // 加载合成图片
      const savedImages = await getSceneCompositeImages(currentSceneId);
      // console.log(`📊 查询到的合成图片数据:`, savedImages);
      
      if (savedImages && savedImages.length > 0) {
        const imageList = savedImages.map((img: any) => ({
          id: img.id,
          url: img.image_url,
          prompt: img.prompt || ''
        }));
        // console.log(`📋 映射后的图片列表:`, imageList);
        setCompositeImages(imageList);
        // console.log(`✅ 加载了${imageList.length}个已保存的合成图片`);

        // 初始化视频提示词
        const prompts: Record<string, string> = {};
        savedImages.forEach((img: any) => {
          if (img.prompt) {
            prompts[img.id] = img.prompt;
          }
        });
        setVideoPrompts(prompts);
        // console.log(`📝 初始化视频提示词:`, prompts);
      } else {
        // console.log(`ℹ️ 没有找到合成图片`);
      }

      // 加载视频
      const savedVideos = await getSceneVideos(currentSceneId);
      // console.log(`📊 查询到的视频数据:`, savedVideos);
      
      if (savedVideos && savedVideos.length > 0) {
        const videoList = savedVideos.map((video: any) => ({
          id: video.id,
          url: video.video_url,
          compositeImageId: video.composite_image_id
        }));
        // console.log(`📋 映射后的视频列表:`, videoList);
        setVideos(videoList);
        // console.log(`✅ 加载了${videoList.length}个已保存的视频`);
      } else {
        // console.log(`ℹ️ 没有找到视频`);
      }

      // 加载配音
      const scenes = await getChapterFilmingScenes(selectedNovel.id, selectedChapter);
      if (scenes && scenes.length > 0) {
        const existingAudioUrls = scenes
          .filter((s: any) => s.narration_audio_url && s.narration_audio_url.trim().length > 0)
          .map((s: any) => s.narration_audio_url);
        
        if (existingAudioUrls.length > 0) {
          // console.log(`🎵 从数据库加载${existingAudioUrls.length}个已有配音`);
          
          // 加载已有配音
          const loadedAudioFiles = existingAudioUrls.map((url: string, index: number) => ({
            id: `audio_loaded_${Date.now()}_${index}`,
            url: url,
            videoId: savedVideos[index]?.id || ''
          }));
          
          setAudioFiles(loadedAudioFiles);
          setHasExistingAudio(true);
          // console.log(`✅ 加载了${loadedAudioFiles.length}个配音文件`);
        }
      }
    } catch (error) {
      console.error('❌ 加载已保存拍摄数据失败:', error);
      // 不显示错误提示，因为可能是第一次使用
    }
  };

  // 当选择小说时，更新选中的小说
  const handleNovelSelect = (novelId: string) => {
    setSelectedNovelId(novelId);
    const novel = novels.find(n => n.id === novelId);
    setSelectedNovel(novel || null);
    setSelectedChapter(0);
  };

  // 当选择章节时
  const handleChapterSelect = (chapterNumber: string) => {
    setSelectedChapter(Number.parseInt(chapterNumber));
    // 清空画布
    setCanvasElements([]);
    setScenePrompt("");
    setCurrentSceneId(null);
    setCompositeImages([]);
    setVideos([]);
  };

  // 填充案例数据
  const handleFillDemoData = async () => {
    try {
      // console.log('🎬 开始填充演示案例数据...');
      
      // 查询演示小说数据
      const { data: demoNovel, error } = await supabase
        .from('novels')
        .select('*')
        .eq('id', DEMO_NOVEL_ID)
        .single();

      if (error || !demoNovel) {
        toast.error('未找到演示案例数据');
        console.error('❌ 查询演示小说失败:', error);
        return;
      }

      // console.log('✅ 找到演示小说:', demoNovel.novel_title);

      // 设置演示模式
      setIsDemoMode(true);
      
      // 设置小说和章节
      setNovels([demoNovel]);
      setSelectedNovelId(demoNovel.id);
      setSelectedNovel(demoNovel);
      setSelectedChapter(1); // 选择第一章

      // 加载第一章的资源
      if (demoNovel.characters_data && Array.isArray(demoNovel.characters_data)) {
        // CharacterData 没有 chapter_number，直接使用所有角色
        setCharacters(demoNovel.characters_data.map((char: CharacterData, idx: number) => ({
          id: `char_${idx}`,
          name: char.name,
          imageUrl: char.image_url || '',
          type: 'character' as const
        })));
      }

      if (demoNovel.costume_data) {
        const chapterCostumes = demoNovel.costume_data.filter(
          (costume: CostumeItem) => costume.chapter_number === 1
        );
        setCostumes(chapterCostumes.map((costume: CostumeItem, idx: number) => ({
          id: `costume_${idx}`,
          name: costume.character || `服装${idx + 1}`,
          imageUrl: costume.image_urls?.[0] || '',
          type: 'costume' as const
        })));
      }

      if (demoNovel.makeup_data) {
        const chapterMakeups = demoNovel.makeup_data.filter(
          (makeup: MakeupItem) => makeup.chapter_number === 1
        );
        setMakeups(chapterMakeups.map((makeup: MakeupItem, idx: number) => ({
          id: `makeup_${idx}`,
          name: makeup.character || `妆容${idx + 1}`,
          imageUrl: makeup.image_urls?.[0] || '',
          type: 'makeup' as const
        })));
      }

      if (demoNovel.props_data) {
        const chapterProps = demoNovel.props_data.filter(
          (prop: PropItem) => prop.chapter_number === 1
        );
        setProps(chapterProps.map((prop: PropItem, idx: number) => ({
          id: `prop_${idx}`,
          name: prop.name,
          imageUrl: prop.image_urls?.[0] || '',
          type: 'prop' as const
        })));
      }

      if (demoNovel.scene_data) {
        const chapterScenes = demoNovel.scene_data.filter(
          (scene: SceneItem) => scene.chapter_number === 1
        );
        setScenes(chapterScenes.map((scene: SceneItem, idx: number) => ({
          id: `scene_${idx}`,
          name: scene.location || `场景${idx + 1}`,
          imageUrl: scene.image_urls?.[0] || '',
          type: 'scene' as const
        })));
      }

      toast.success('✅ 演示案例已加载！所有操作已禁用，点击右下角"退出演示"按钮恢复正常');
      // console.log('✅ 演示案例数据填充完成');
    } catch (error) {
      console.error('❌ 填充演示数据失败:', error);
      toast.error('填充演示数据失败');
    }
  };

  // 退出演示模式
  const handleExitDemo = () => {
    // console.log('🚪 退出演示模式，重新加载页面...');
    window.location.reload();
  };

  // 处理拖拽图片到画布
  const handleDropToCanvas = (imageUrl: string, name: string, type: string) => {
    // 确定元素类型
    let elementType: CanvasElement['type'] = 'prop';
    if (type === 'scene') {
      elementType = 'background';
    } else if (type === 'character') {
      elementType = 'character';
    } else if (type === 'costume') {
      elementType = 'costume';
    } else if (type === 'makeup') {
      elementType = 'makeup';
    } else if (type === 'prop') {
      elementType = 'prop';
    }

    // 如果是背景，替换现有背景
    if (elementType === 'background') {
      const newElements = canvasElements.filter(el => el.type !== 'background');
      const backgroundElement: CanvasElement = {
        id: `bg_${Date.now()}`,
        type: 'background',
        name,
        imageUrl,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 0
      };
      setCanvasElements([backgroundElement, ...newElements]);
      toast.success('背景图片已添加');
    } else {
      // 添加前景元素
      const maxZIndex = Math.max(0, ...canvasElements.map(el => el.zIndex));
      const newElement: CanvasElement = {
        id: `${type}_${Date.now()}`,
        type: elementType,
        name,
        imageUrl,
        x: 25, // 默认位置
        y: 25,
        width: 30, // 默认大小
        height: 30,
        zIndex: maxZIndex + 1
      };
      setCanvasElements([...canvasElements, newElement]);
      toast.success(`${name}已添加到画布`);
    }
  };

  // 生成合成图片
  const handleGenerateCompositeImage = async () => {
    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    if (canvasElements.length === 0) {
      toast.error('请先添加图片到画布');
      return;
    }

    const hasBackground = canvasElements.some(el => el.type === 'background');
    if (!hasBackground) {
      toast.error('请先添加背景图片');
      return;
    }

    if (!scenePrompt.trim()) {
      toast.error('请输入场景描述提示词');
      return;
    }

    // 生成临时ID用于占位
    const placeholderId = `placeholder_${Date.now()}`;
    
    // 立即添加占位符到UI，显示加载状态
    setCompositeImages(prev => [...prev, {
      id: placeholderId,
      url: '', // 空URL表示占位符
      prompt: scenePrompt,
      isPlaceholder: true // 标记为占位符
    }]);

    // 显示生成提示
    toast.info('开始生成合成图片...');

    try {
      // 1. 保存或复用场景配置
      // console.log('💾 保存场景配置...');
      
      let sceneId = currentSceneId;
      
      if (!sceneId) {
        // 如果没有currentSceneId，创建新的scene
        const sceneData = await createFilmingScene({
          novel_id: selectedNovel.id,
          chapter_number: selectedChapter,
          scene_name: `场景_${Date.now()}`,
          scene_elements: canvasElements,
          prompt: scenePrompt
        });

        if (!sceneData) {
          throw new Error('保存场景配置失败');
        }

        sceneId = sceneData.id;
        setCurrentSceneId(sceneId);
        // console.log('✅ 新场景配置已保存:', sceneId);
      } else {
        // 如果已有currentSceneId，复用它
        // console.log('✅ 复用现有场景:', sceneId);
      }

      // 2. 准备图片合成参数
      // console.log('📝 准备图片合成参数...');

      // 获取背景图片
      const backgroundElement = canvasElements.find(el => el.type === 'background');
      if (!backgroundElement) {
        throw new Error('未找到背景图片');
      }

      // 构建合成参数 - 将所有图片转换为数组格式，包含坐标信息
      const imagesToComposite = [
        {
          url: backgroundElement.imageUrl,
          mimeType: 'image/png' as const,
          name: backgroundElement.name,
          type: backgroundElement.type,
          x: backgroundElement.x,
          y: backgroundElement.y,
          width: backgroundElement.width,
          height: backgroundElement.height,
          isBackground: true  // 标记为背景图片
        },
        ...canvasElements
          .filter(el => el.type !== 'background')
          .map(el => ({
            url: el.imageUrl,
            mimeType: 'image/png' as const,
            name: el.name,
            type: el.type,  // 添加类型信息（character/prop/costume/makeup）
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            isBackground: false  // 标记为非背景图片
          }))
      ];

      // console.log('🎨 开始图片合成（包含坐标信息）...', imagesToComposite);

      // 3. 调用图片合成API（支持10次重试）
      const compositeResult = await compositeImagesWithRetry(
        imagesToComposite,
        scenePrompt,
        (status, retryCount) => {
          // console.log(`🔄 ${status} (${retryCount}/${MAX_RETRIES})`);
        }
      );

      if (!compositeResult) {
        throw new Error('图片合成失败');
      }

      // console.log('✅ 图片合成成功:', compositeResult);

      // 4. 上传合成图片到Storage
      // console.log('📤 上传图片到云存储...');

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const storagePath = `${selectedNovel.id}/chapter_${selectedChapter}/composite/${timestamp}_${randomStr}.png`;
      
      const storageUrl = await uploadImageToStorage(
        compositeResult,
        'filming-composite-images',
        storagePath
      );

      // console.log('✅ 图片已上传到Storage:', storageUrl);

      // 5. 保存合成图片记录到数据库
      // console.log('💾 保存图片记录...');

      if (!sceneId) {
        throw new Error('场景ID不存在');
      }

      const imageRecord = await createCompositeImage({
        scene_id: sceneId,
        image_url: storageUrl,
        storage_path: storagePath,
        prompt: scenePrompt
      });

      if (!imageRecord) {
        throw new Error('保存图片记录失败');
      }

      // console.log('✅ 图片记录已保存:', imageRecord.id);

      // 6. 更新UI - 替换占位符为真实图片
      setCompositeImages(prev => prev.map(img => 
        img.id === placeholderId 
          ? { id: imageRecord.id, url: storageUrl, prompt: scenePrompt }
          : img
      ));

      toast.success('合成图片生成成功！');

    } catch (error) {
      console.error('❌ 生成合成图片失败:', error);
      toast.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      
      // 移除占位符
      setCompositeImages(prev => prev.filter(img => img.id !== placeholderId));
    }
  };

  // 重新生成图片
  const handleRegenerateImage = async () => {
    try {
      // console.log('🔄 开始重新生成图片...');
      
      // 删除之前的图片和视频记录
      if (compositeImages.length > 0) {
        // console.log(`🗑️ 删除${compositeImages.length}个旧图片记录...`);
        for (const image of compositeImages) {
          try {
            await deleteCompositeImage(image.id);
            // console.log(`✅ 已删除图片记录: ${image.id}`);
          } catch (error) {
            console.error(`❌ 删除图片记录失败: ${image.id}`, error);
          }
        }
      }
      
      if (videos.length > 0) {
        // console.log(`🗑️ 删除${videos.length}个旧视频记录...`);
        for (const video of videos) {
          try {
            await deleteFilmingVideo(video.id);
            // console.log(`✅ 已删除视频记录: ${video.id}`);
          } catch (error) {
            console.error(`❌ 删除视频记录失败: ${video.id}`, error);
          }
        }
      }
      
      // 清空前端状态
      setCompositeImages([]);
      setVideos([]);
      setAudioFiles([]);
      
      // console.log('✅ 旧记录已清理，开始重新生成...');
      
      // 重新生成（会复用currentSceneId）
      await handleGenerateCompositeImage();
    } catch (error) {
      console.error('❌ 重新生成图片失败:', error);
      toast.error('重新生成失败，请重试');
    }
  };

  // 增强视频提示词：添加化妆分析数据
  const enhanceVideoPromptWithMakeup = (originalPrompt: string): string => {
    if (!selectedNovel || selectedChapter === 0) {
      return originalPrompt;
    }

    // 获取当前章节的化妆分析数据
    const makeupData = selectedNovel.makeup_data?.filter(
      m => m.chapter_number === selectedChapter
    );

    if (!makeupData || makeupData.length === 0) {
      // console.log('📝 未找到化妆分析数据，使用原始提示词');
      return originalPrompt;
    }

    // console.log(`📝 找到${makeupData.length}个化妆分析数据`);

    // 遍历化妆分析数据，查找提示词中是否包含对应的人物
    const matchedMakeup: string[] = [];
    
    for (const makeup of makeupData) {
      const character = makeup.character;
      
      // 检查提示词中是否包含该人物名称
      if (originalPrompt.includes(character)) {
        // console.log(`✅ 找到匹配的人物: ${character}`);
        
        // 构建化妆分析描述
        const makeupDesc = `${character}：${makeup.style}，${makeup.details}，${makeup.emotion}`;
        matchedMakeup.push(makeupDesc);
      }
    }

    // 如果没有匹配的人物，返回原始提示词
    if (matchedMakeup.length === 0) {
      // console.log('📝 提示词中未找到匹配的人物，使用原始提示词');
      return originalPrompt;
    }

    // 将化妆分析数据添加到提示词中
    const enhancedPrompt = `${originalPrompt}，${matchedMakeup.join('，')}`;
    // console.log(`✅ 增强后的提示词: ${enhancedPrompt}`);
    
    return enhancedPrompt;
  };

  // 从场景提示词中提取视频提示词（去掉括号内容）
  const extractVideoPromptFromScene = (scenePrompt: string): string => {
    if (!scenePrompt) return '';
    
    // 去掉所有括号及其内容（包括中文括号和英文括号）
    let videoPrompt = scenePrompt
      .replace(/（[^）]*）/g, '') // 去掉中文括号
      .replace(/\([^)]*\)/g, '')  // 去掉英文括号
      .replace(/\[[^\]]*\]/g, '') // 去掉方括号
      .replace(/【[^】]*】/g, '') // 去掉中文方括号
      .trim();
    
    return videoPrompt || scenePrompt; // 如果去掉后为空，返回原始提示词
  };

  // 生成视频
  const handleGenerateVideo = async (compositeImageId: string, imageUrl: string) => {
    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    // 找到对应的合成图片，获取场景提示词
    const compositeImage = compositeImages.find(img => img.id === compositeImageId);
    const scenePrompt = compositeImage?.prompt || '';
    
    // 获取该图片的视频提示词，如果没有则从场景提示词中提取
    let videoPrompt = videoPrompts[compositeImageId];
    if (!videoPrompt) {
      videoPrompt = extractVideoPromptFromScene(scenePrompt) || '将这张图片转换为动态视频';
    }
    
    if (!videoPrompt.trim()) {
      toast.error('请输入视频生成提示词');
      return;
    }

    // 增强视频提示词：添加化妆分析数据
    videoPrompt = enhanceVideoPromptWithMakeup(videoPrompt);

    // 标记该图片正在生成视频
    setGeneratingVideoIds(prev => new Set(prev).add(compositeImageId));
    setGenerationProgress(0);
    setGenerationStatus('准备生成视频...');

    try {
      // console.log('🎬 开始生成视频...');
      // console.log('原始视频提示词:', videoPrompts[compositeImageId]);
      // console.log('增强后视频提示词:', videoPrompt);

      // 调用图生视频API（支持10次重试）
      setGenerationStatus('正在生成视频（支持失败重试）...');
      const videoResult = await image2VideoWithRetry(
        imageUrl,
        videoPrompt,
        '10',  // 视频长度改为10秒
        (status, retryCount) => {
          const progress = (retryCount / MAX_RETRIES) * 80; // 0-80%
          setGenerationProgress(progress);
          setGenerationStatus(`${status} (${retryCount}/${MAX_RETRIES})`);
        }
      );

      if (!videoResult || !videoResult.videoUrl) {
        throw new Error('视频生成失败');
      }

      // console.log('✅ 视频生成成功:', videoResult);

      // 上传视频到Storage
      setGenerationStatus('上传视频到云存储...');
      setGenerationProgress(85);

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const storagePath = `${selectedNovel.id}/chapter_${selectedChapter}/video/${timestamp}_${randomStr}.mp4`;
      
      const storageUrl = await uploadImageToStorage(
        videoResult.videoUrl,
        'filming-videos',
        storagePath
      );

      // console.log('✅ 视频已上传到Storage:', storageUrl);

      // 保存视频记录到数据库
      setGenerationStatus('保存视频记录...');
      setGenerationProgress(95);

      const videoRecord = await createFilmingVideo({
        composite_image_id: compositeImageId,
        video_url: storageUrl,
        storage_path: storagePath
      });

      if (!videoRecord) {
        throw new Error('保存视频记录失败');
      }

      // console.log('✅ 视频记录已保存:', videoRecord.id);

      // 更新UI
      setVideos(prev => [...prev, {
        id: videoRecord.id,
        url: storageUrl,
        compositeImageId
      }]);

      setGenerationProgress(100);
      setGenerationStatus('视频生成完成！');
      toast.success('视频生成成功！');

    } catch (error) {
      console.error('❌ 生成视频失败:', error);
      toast.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      // 移除该图片的生成状态
      setGeneratingVideoIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(compositeImageId);
        return newSet;
      });
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 2000);
    }
  };

  // 自动配音
  const handleAutoGenerateAudio = async () => {
    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    if (videos.length === 0) {
      toast.error('请先生成视频');
      return;
    }

    // console.log('🎤 开始配音生成流程...');
    // console.log('📹 当前videos数组:', videos);
    // console.log('📹 videos总数量:', videos.length);
    // console.log('🖼️ compositeImages数量:', compositeImages.length);

    // 统计实际有视频的compositeImages数量（这才是真正显示的视频数量）
    const videosWithCompositeImages = compositeImages
      .map(img => videos.find(v => v.compositeImageId === img.id))
      .filter(v => v !== undefined);
    
    const actualVideoCount = videosWithCompositeImages.length;
    // console.log('📹 实际显示的视频数量:', actualVideoCount);
    // console.log('📹 有视频的compositeImages:', videosWithCompositeImages);

    if (actualVideoCount === 0) {
      toast.error('请先生成视频');
      return;
    }
    if (hasExistingAudio || audioFiles.length > 0) {
      const confirmed = window.confirm(
        '检测到已有配音文件，重新生成将删除现有配音。\n\n是否继续重新生成配音？'
      );
      if (!confirmed) {
        return;
      }
      
      // console.log('🗑️ 用户确认重新生成配音，准备删除旧配音...');
      
      // 清空当前的音频文件状态
      setAudioFiles([]);
      setHasExistingAudio(false);
      
      // 从数据库删除旧的配音URL
      try {
        const scenes = await getChapterFilmingScenes(selectedNovel.id, selectedChapter);
        if (scenes && scenes.length > 0) {
          for (const scene of scenes) {
            if (scene.narration_audio_url) {
              await updateSceneNarrationAudio(scene.id, null);
              // console.log(`✅ 已删除场景${scene.id}的旧配音URL`);
            }
          }
        }
      } catch (error) {
        console.error('❌ 删除旧配音URL失败:', error);
        // 继续执行，不影响重新生成
      }
    }

    setIsGeneratingVideo(true);
    setGenerationProgress(0);
    setGenerationStatus('准备生成语音...');

    try {
      // console.log('🎤 开始生成配音...');

      // 获取当前章节的剧本数据
      const scriptData = selectedNovel.scripts_data?.find(
        (script) => script.chapter_number === selectedChapter
      );
      
      if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
        toast.error('未找到剧本数据，请先生成剧本');
        setIsGeneratingVideo(false);
        return;
      }

      // 根据实际显示的视频数量确定需要生成多少段配音
      // console.log(`📹 当前有${actualVideoCount}个视频，需要生成${actualVideoCount}段配音`);

      // 从剧本的场景分段中获取解说内容（用于配音）
      // 只获取前actualVideoCount个场景的解说内容
      const textSegments: string[] = scriptData.scenes
        .slice(0, actualVideoCount) // 只取前actualVideoCount个场景
        .map((scene) => scene.narration_content || scene.novel_content || scene.script_content);

      // console.log(`📝 从剧本中获取${textSegments.length}个场景的解说内容`);
      textSegments.forEach((text, idx) => {
        // console.log(`  场景${idx + 1}解说: "${text}" (${text.length}字)`);
      });

      if (textSegments.length === 0) {
        toast.error('没有找到解说内容，请先生成解说');
        setIsGeneratingVideo(false);
        return;
      }

      // 逐个调用短文本语音合成接口生成配音
      const newAudioFiles: Array<{ id: string; url: string; videoId: string }> = [];
      
      setGenerationStatus('正在生成语音...');
      setGenerationProgress(30);

      // console.log(`🎤 开始逐个生成${textSegments.length}段配音（短文本语音合成）...`);
      
      // 遍历每个场景的解说内容，逐个生成配音
      for (let i = 0; i < textSegments.length; i++) {
        const text = textSegments[i];
        
        // console.log(`🎤 正在生成场景${i + 1}/${textSegments.length}的配音...`);
        setGenerationStatus(`正在生成场景${i + 1}/${textSegments.length}的配音...`);
        
        try {
          // 步骤1: 调用generate-tts创建任务，获取task_id
          const { data: createData, error: createError } = await supabase.functions.invoke('generate-tts', {
            body: JSON.stringify({
              text: [text], // 传入单元素数组
              format: 'mp3-16k',
              voice: 3, // 度逍遥
              speed: 5
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (createError) {
            const errorMsg = await createError?.context?.text();
            console.error(`❌ 场景${i + 1}创建配音任务失败:`, errorMsg || createError?.message);
            toast.error(`场景${i + 1}创建配音任务失败，跳过该场景`);
            continue; // 跳过失败的，继续生成下一个
          }

          if (!createData?.success || !createData?.taskId) {
            console.error(`❌ 场景${i + 1}创建配音任务返回数据格式错误:`, createData);
            toast.error(`场景${i + 1}创建配音任务失败`);
            continue;
          }

          const taskId = createData.taskId;
          console.log(`✅ 场景${i + 1}配音任务已创建，task_id: ${taskId}`);

          // 步骤2: 前端轮询查询任务状态
          let attempts = 0;
          const maxAttempts = 150; // 最多轮询150次（5分钟）
          let audioUrl: string | null = null;

          while (attempts < maxAttempts) {
            attempts++;
            
            // 等待2秒
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log(`🔍 查询场景${i + 1}任务状态 (${attempts}/${maxAttempts})...`);

            const { data: queryData, error: queryError } = await supabase.functions.invoke('query-tts-status', {
              body: JSON.stringify({
                taskId: taskId
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (queryError) {
              console.error(`❌ 查询场景${i + 1}任务状态失败:`, queryError);
              continue; // 继续轮询
            }

            if (queryData?.status === 'success' && queryData?.audioUrl) {
              audioUrl = queryData.audioUrl;
              console.log(`✅ 场景${i + 1}配音生成成功: ${audioUrl}`);
              break;
            } else if (queryData?.status === 'failed') {
              console.error(`❌ 场景${i + 1}配音生成失败`);
              toast.error(`场景${i + 1}配音生成失败`);
              break;
            } else if (queryData?.status === 'processing') {
              console.log(`⏳ 场景${i + 1}配音任务运行中，继续等待...`);
              // 继续轮询
            }
          }

          if (attempts >= maxAttempts) {
            console.warn(`⚠️ 场景${i + 1}配音生成超时`);
            toast.error(`场景${i + 1}配音生成超时，跳过该场景`);
            continue;
          }

          if (audioUrl) {
            const currentVideo = videosWithCompositeImages[i];
            if (currentVideo) {
              newAudioFiles.push({
                id: `audio_${currentVideo.id}_${Date.now()}_${i}`,
                url: audioUrl,
                videoId: currentVideo.id
              });
            }
          }
        } catch (error) {
          console.error(`❌ 场景${i + 1}配音生成异常:`, error);
          toast.error(`场景${i + 1}配音生成异常`);
        }
        
        // 更新进度（30% -> 70%）
        const progress = 30 + Math.floor(((i + 1) / textSegments.length) * 40);
        setGenerationProgress(progress);
      }

      // console.log(`✅ 配音生成完成，共生成${newAudioFiles.length}个音频文件`);

      setAudioFiles(newAudioFiles);
      setGenerationProgress(90);
      setGenerationStatus('配音生成完成！');
      
      // 保存配音网址到数据库
      // console.log('🎵 保存配音网址到数据库...');
      try {
        const scenes = await getChapterFilmingScenes(selectedNovel.id, selectedChapter);
        if (scenes && scenes.length > 0) {
          // 为每个场景保存对应的配音网址
          for (let i = 0; i < Math.min(newAudioFiles.length, scenes.length); i++) {
            const scene = scenes[i];
            const audioFile = newAudioFiles[i];
            if (scene && audioFile) {
              await updateSceneNarrationAudio(scene.id, audioFile.url);
              // console.log(`✅ 场景${i + 1}配音网址已保存`);
            }
          }
          setHasExistingAudio(true); // 标记已有配音数据
          // console.log('✅ 所有配音网址已保存到数据库');
        }
      } catch (error) {
        console.error('❌ 保存配音网址失败:', error);
        // 不影响主流程，只记录错误
      }
      
      setGenerationProgress(100);
      toast.success(`成功生成${newAudioFiles.length}个配音文件`);

    } catch (error) {
      console.error('❌ 自动配音失败:', error);
      toast.error(`配音失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingVideo(false);
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 2000);
    }
  };

  // 生成解说
  const handleGenerateNarration = async () => {
    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    setIsGeneratingNarration(true);
    setGenerationProgress(0);
    setGenerationStatus('准备生成解说...');

    const MAX_RETRIES = 10; // 最大重试次数
    let retryCount = 0;

    try {
      // console.log('📝 开始生成解说...');

      // 获取当前章节的剧本数据
      const scriptData = selectedNovel.scripts_data?.find(
        (script) => script.chapter_number === selectedChapter
      );
      
      if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
        toast.error('未找到剧本数据，请先生成剧本');
        setIsGeneratingNarration(false);
        return;
      }

      // 获取所有场景的小说片段
      const novelSegments = scriptData.scenes.map((scene, index) => ({
        sceneNumber: index + 1,
        sceneTitle: scene.scene_title,
        novelContent: scene.novel_content
      }));

      // console.log(`📖 获取到${novelSegments.length}个场景的小说片段`);

      // 获取AI模型配置
      const aiConfig = await getAIModelConfig();
      // console.log('🤖 AI模型配置:', aiConfig);

      // 构建Prompt - 使用专业解说员视角
      const prompt = `你是一位专业的小说解说员，请为以下${novelSegments.length}个小说片段生成第三人称解说内容。

严格要求：
1. 必须一次性生成${novelSegments.length}个解说，每个片段对应一个解说
2. 每个解说字数：20-42个中文字（包含标点符号）
3. 使用第三人称视角，以专业解说员的口吻解说小说内容
4. 解说要生动、有画面感、有情感，适合配音
5. 保证所有解说内容的连贯性，形成完整的故事线
6. 每个解说必须是完整的句子，禁止断句
7. 直接输出解说内容，每行一个，不要添加"场景X："、"解说X："等任何前缀或编号

小说片段列表：
${novelSegments.map((seg, idx) => `片段${idx + 1}：
${seg.novelContent}`).join('\n\n')}

请直接输出${novelSegments.length}行解说内容，每行一个解说（20-42字），确保连贯性，禁止超过42字：`;

      let fullContent = '';
      let generateSuccess = false;

      // 重试循环
      while (retryCount < MAX_RETRIES && !generateSuccess) {
        try {
          retryCount++;
          
          if (retryCount > 1) {
            // console.log(`🔄 第${retryCount}次尝试生成解说...`);
            setGenerationStatus(`正在生成解说内容（第${retryCount}/${MAX_RETRIES}次尝试）...`);
          } else {
            setGenerationStatus('正在生成解说内容...');
          }
          
          setGenerationProgress(30);

          // 根据AI模型配置选择对应的接口
          if (aiConfig.provider === 'custom') {
            // console.log('🤖 使用自定义OpenAI接口生成解说');
            if (!aiConfig.customApiUrl || !aiConfig.customApiKey || !aiConfig.customModel) {
              throw new Error('自定义OpenAI接口配置不完整，请联系管理员配置');
            }
            
            await sendOpenAIStream({
              messages: [{ role: 'user', content: prompt }],
              apiUrl: aiConfig.customApiUrl,
              apiKey: aiConfig.customApiKey,
              model: aiConfig.customModel,
              onUpdate: (content) => {
                fullContent = content;
                setGenerationProgress(50);
              },
              onComplete: () => {
                // console.log('✅ 自定义OpenAI接口生成完成');
              },
              onError: (error) => {
                console.error('❌ 自定义OpenAI接口生成失败:', error);
                throw error;
              }
            });
          } else {
            // console.log('🤖 使用秒哒自带模型生成解说');
            const apiId = import.meta.env.VITE_APP_ID;
            await sendChatStream({
              endpoint: '/api/miaoda/runtime/apicenter/source/proxy/ernietextgenerationchat',
              messages: [{ role: 'user', content: prompt }],
              apiId,
              onUpdate: (content) => {
                fullContent = content;
                setGenerationProgress(50);
              },
              onComplete: () => {
                // console.log('✅ 秒哒模型生成完成');
              },
              onError: (error) => {
                console.error('❌ 秒哒模型生成失败:', error);
                throw error;
              }
            });
          }

          // 如果执行到这里，说明生成成功
          generateSuccess = true;
          // console.log(`✅ 解说生成成功（第${retryCount}次尝试）`);

        } catch (error) {
          console.error(`❌ 第${retryCount}次生成解说失败:`, error);
          
          if (retryCount >= MAX_RETRIES) {
            // 达到最大重试次数，抛出错误
            throw new Error(`生成解说失败，已重试${MAX_RETRIES}次`);
          }
          
          // 等待1秒后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setGenerationStatus('正在解析解说内容...');
      setGenerationProgress(70);

      // console.log('📄 AI生成的原始内容：');
      // console.log(fullContent);
      // console.log('---');

      // 解析生成的解说内容
      const lines = fullContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // console.log(`📝 分割后的行数：${lines.length}`);
      
      const narrations: string[] = [];

      for (const line of lines) {
        // 尝试多种格式匹配
        let narration = '';
        
        // 格式1：场景X：解说内容 或 片段X：解说内容
        const match1 = line.match(/(?:场景|片段|解说)\d+[：:]\s*(.+)/);
        if (match1 && match1[1]) {
          narration = match1[1].trim();
        }
        
        // 格式2：X. 解说内容
        const match2 = line.match(/^\d+\.\s*(.+)/);
        if (!narration && match2 && match2[1]) {
          narration = match2[1].trim();
        }
        
        // 格式3：直接是解说内容（没有前缀）
        if (!narration && line.length >= 20 && line.length <= 50) {
          // 过滤掉明显不是解说的内容
          if (!line.includes('场景列表') && 
              !line.includes('片段列表') &&
              !line.includes('解说内容') && 
              !line.includes('要求') &&
              !line.includes('输出')) {
            narration = line.trim();
          }
        }
        
        if (narration) {
          // 验证字数（20-42字，包含标点符号）
          // console.log(`  解析到解说 #${narrations.length + 1}: "${narration}" (${narration.length}字)`);
          
          if (narration.length >= 20 && narration.length <= 42) {
            narrations.push(narration);
          } else if (narration.length > 42) {
            // 截断到42字
            const truncated = narration.substring(0, 42);
            console.warn(`  ⚠️ 解说超过42字，已截断: "${truncated}"`);
            narrations.push(truncated);
          } else if (narration.length >= 15) {
            // 如果在15-19字之间，也接受（稍微放宽限制）
            console.warn(`  ⚠️ 解说少于20字但大于15字，保留: "${narration}"`);
            narrations.push(narration);
          } else {
            console.warn(`  ⚠️ 解说太短(${narration.length}字)，跳过: "${narration}"`);
          }
        }
      }

      // console.log(`📝 最终解析到${narrations.length}个解说内容`);
      narrations.forEach((narration, idx) => {
        // console.log(`  场景${idx + 1}解说: "${narration}" (${narration.length}字)`);
      });

      // 验证解说数量
      if (narrations.length === 0) {
        console.error('❌ 未能解析到任何解说内容');
        // console.log('原始内容：', fullContent);
        toast.error('未能解析到解说内容，请重新生成');
        setIsGeneratingNarration(false);
        return;
      }

      if (narrations.length !== novelSegments.length) {
        console.warn(`⚠️ 解说数量(${narrations.length})与场景数量(${novelSegments.length})不匹配`);
        
        // 如果解说数量少于场景数量，尝试补充
        if (narrations.length < novelSegments.length) {
          const missing = novelSegments.length - narrations.length;
          // console.log(`⚠️ 缺少${missing}个解说，使用小说片段补充`);
          
          for (let i = narrations.length; i < novelSegments.length; i++) {
            const novelContent = novelSegments[i].novelContent;
            // 截取小说片段的前20字作为解说
            const fallback = novelContent.substring(0, 20);
            narrations.push(fallback);
            // console.log(`  补充场景${i + 1}解说: "${fallback}"`);
          }
        } else {
          // 如果解说数量多于场景数量，截断
          narrations.splice(novelSegments.length);
          // console.log(`⚠️ 解说数量过多，已截断到${novelSegments.length}个`);
        }
      }

      setGenerationStatus('正在保存解说内容...');
      setGenerationProgress(90);

      // 更新剧本数据中的解说内容
      const updatedScenes = scriptData.scenes.map((scene, index) => ({
        ...scene,
        narration_content: narrations[index] || scene.narration_content
      }));

      const updatedScriptsData = selectedNovel.scripts_data?.map(script => 
        script.chapter_number === selectedChapter
          ? { ...script, scenes: updatedScenes }
          : script
      );

      // 保存到数据库（novels表的scripts_data字段）
      await updateNovelScripts(selectedNovel.id, updatedScriptsData || []);
      
      // 同时保存到filming_scenes表
      // console.log('📝 保存解说到filming_scenes表...');
      const scenes = await getChapterFilmingScenes(selectedNovel.id, selectedChapter);
      if (scenes && scenes.length > 0) {
        const narrationUpdates = scenes.map((scene: any, index: number) => ({
          sceneId: scene.id,
          narration_text: narrations[index] || ''
        }));
        
        await updateScenesNarration(narrationUpdates);
        // console.log('✅ 解说已保存到filming_scenes表');
      }

      // 更新本地状态
      setSelectedNovel({
        ...selectedNovel,
        scripts_data: updatedScriptsData
      });

      setNarrationsGenerated(true);
      setHasExistingNarrations(true); // 标记已有解说数据
      setGenerationProgress(100);
      setGenerationStatus('解说生成完成！');
      toast.success(`成功生成${narrations.length}个解说内容`);

    } catch (error) {
      console.error('❌ 生成解说失败:', error);
      toast.error(`生成解说失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingNarration(false);
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 2000);
    }
  };

  // 打开视频合并对话框
  const handleOpenMergeDialog = () => {
    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    if (videos.length === 0) {
      toast.error('请先生成视频');
      return;
    }

    // 按照compositeImages的顺序排列视频
    // 只包含当前场景的视频，并按照合成图片的顺序排列
    const orderedVideos = compositeImages
      .filter(img => !img.isPlaceholder) // 过滤掉占位符
      .map(img => videos.find(v => v.compositeImageId === img.id)) // 找到对应的视频
      .filter((v): v is NonNullable<typeof v> => v !== undefined); // 过滤掉undefined并确保类型正确

    // console.log('📹 合并视频对话框打开');
    // console.log('  合成图片数量:', compositeImages.filter(img => !img.isPlaceholder).length);
    // console.log('  视频总数:', videos.length);
    // console.log('  排序后视频数量:', orderedVideos.length);

    if (orderedVideos.length === 0) {
      toast.error('没有可合并的视频');
      return;
    }

    // 初始化排序后的视频列表
    setSortedVideos(orderedVideos);
    // 重置合并状态
    setMergedVideoUrl('');
    setMergeProgress(0);
    setIsMergingVideos(false);
    setShowMergeDialog(true);
  };

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理视频拖拽结束
  const handleVideoDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSortedVideos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // 合并视频
  const handleMergeVideos = async () => {
    if (sortedVideos.length === 0) {
      toast.error('没有可合并的视频');
      return;
    }

    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    // 视频数量建议
    if (sortedVideos.length > 10) {
      const confirmed = window.confirm(
        `检测到您要合并${sortedVideos.length}个视频，数量较多可能导致合并超时。\n\n建议：\n- 每次合并不超过10个视频\n- 或者分批合并后再合并结果\n\n是否继续合并？`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setIsMergingVideos(true);
      setMergeProgress(0);
      setMergedVideoUrl(''); // 清空之前的URL

      // console.log('🎬 开始合并视频...');
      // console.log('📝 视频顺序:', sortedVideos.map((v, i) => `${i + 1}. ${v.url}`));

      // 调用视频合并API
      const videoUrls = sortedVideos.map(v => v.url);
      
      toast.info(`正在合并${videoUrls.length}个视频，预计需要${Math.ceil(videoUrls.length * 0.5)}-${Math.ceil(videoUrls.length * 1)}分钟...`);
      setMergeProgress(10);

      // 调用Supabase Edge Function代理视频合并请求（带重试）
      // console.log('🔗 调用Edge Function: video-merge-proxy');
      // console.log('📝 传递的视频URL列表:', videoUrls);
      // console.log('📝 视频数量:', videoUrls.length);
      
      // 将视频URL数组转换为Coze API期望的格式
      const videoList = videoUrls.map(url => ({
        url: url,
        file_type: 'video'
      }));
      
      const requestBody = { video_list: videoList };
      // console.log('📝 请求体:', JSON.stringify(requestBody, null, 2));
      
      // 重试机制：最多重试3次
      let lastError: Error | null = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // console.log(`🔄 第${attempt}次尝试合并视频...`);
          if (attempt > 1) {
            toast.info(`第${attempt}次尝试合并视频...`);
            setMergeProgress(10 + (attempt - 1) * 5);
          }
          
          const { data, error } = await supabase.functions.invoke('video-merge-proxy', {
            body: requestBody,
            method: 'POST'
          });

          // console.log('📹 Edge Function响应 - data:', data);
          // console.log('📹 Edge Function响应 - error:', error);

          if (error) {
            console.error(`❌ 第${attempt}次尝试失败:`, error);
            console.error('❌ 错误名称:', error.name);
            console.error('❌ 错误消息:', error.message);
            console.error('❌ 错误上下文:', error.context);
            
            // 尝试读取错误响应的文本内容
            if (error.context && typeof error.context.text === 'function') {
              try {
                const errorText = await error.context.text();
                console.error('❌ 错误响应文本:', errorText);
              } catch (e) {
                console.error('❌ 无法读取错误响应文本:', e);
              }
            }
            
            lastError = error instanceof Error ? error : new Error(error?.message || '视频合并失败');
            
            // 如果不是最后一次尝试，等待后重试
            if (attempt < maxRetries) {
              const waitTime = attempt * 2; // 2秒、4秒、6秒
              // console.log(`⏳ 等待${waitTime}秒后重试...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
              continue; // 继续下一次尝试
            }
            
            // 最后一次尝试也失败了
            throw new Error(error.message || '视频合并失败');
          }
          
          setMergeProgress(80);

          // 检查返回的数据格式（Coze API返回的是output_video对象）
          if (!data || !data.output_video || !data.output_video.url) {
            console.error('❌ API返回数据格式错误:', data);
            lastError = new Error('未返回合并后的视频URL');
            
            if (attempt < maxRetries) {
              const waitTime = attempt * 2;
              // console.log(`⏳ 等待${waitTime}秒后重试...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
              continue;
            }
            
            throw lastError;
          }

          // console.log('✅ 视频合并成功:', data.output_video.url);
          setMergeProgress(100);

          // 保存合并后的视频URL，等待用户点击下载
          setMergedVideoUrl(data.output_video.url);
          toast.success('视频合并成功！请点击下载按钮保存视频');
          
          // 成功后跳出重试循环
          break;
          
        } catch (retryError) {
          console.error(`❌ 第${attempt}次尝试异常:`, retryError);
          lastError = retryError;
          
          // 如果不是最后一次尝试，等待后重试
          if (attempt < maxRetries) {
            const waitTime = attempt * 2;
            // console.log(`⏳ 等待${waitTime}秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            continue;
          }
          
          // 最后一次尝试也失败了，抛出错误
          throw retryError;
        }
      }
      
      // 如果所有重试都失败了
      if (lastError && !mergedVideoUrl) {
        throw lastError;
      }

    } catch (error) {
      console.error('❌ 合并视频失败:', error);
      toast.error(`合并失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsMergingVideos(false);
    }
  };

  // 下载合并后的视频
  const handleDownloadMergedVideo = () => {
    if (!mergedVideoUrl) {
      toast.error('没有可下载的视频');
      return;
    }

    const link = document.createElement('a');
    link.href = mergedVideoUrl;
    link.download = `${selectedNovel?.novel_title}_第${selectedChapter}章_合并视频.mp4`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('开始下载视频');
  };

  // 复制所有视频链接到粘贴板
  const handleCopyVideoLinks = async () => {
    if (sortedVideos.length === 0) {
      toast.error('没有可复制的视频链接');
      return;
    }

    try {
      // 将所有视频链接用回车隔开
      const videoLinks = sortedVideos.map(v => v.url).join('\n');
      
      // 复制到粘贴板
      await navigator.clipboard.writeText(videoLinks);
      
      toast.success(`已复制${sortedVideos.length}个视频链接到粘贴板`);
      // console.log('📋 已复制视频链接:', videoLinks);
    } catch (error) {
      console.error('❌ 复制失败:', error);
      toast.error('复制失败，请手动复制');
    }
  };

  // 删除合成图片
  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm('确定要删除这张图片吗？删除后无法恢复。')) {
      return;
    }

    try {
      // 先删除该图片对应的视频
      const relatedVideos = videos.filter(v => v.compositeImageId === imageId);
      for (const video of relatedVideos) {
        await deleteFilmingVideo(video.id);
      }

      // 删除图片
      await deleteCompositeImage(imageId);

      // 更新UI
      setCompositeImages(prev => prev.filter(img => img.id !== imageId));
      setVideos(prev => prev.filter(v => v.compositeImageId !== imageId));
      
      toast.success('图片已删除');
    } catch (error) {
      console.error('❌ 删除图片失败:', error);
      toast.error('删除失败');
    }
  };

  // 删除视频
  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm('确定要删除这个视频吗？删除后无法恢复。')) {
      return;
    }

    try {
      await deleteFilmingVideo(videoId);
      
      // 更新UI
      setVideos(prev => prev.filter(v => v.id !== videoId));
      
      toast.success('视频已删除');
    } catch (error) {
      console.error('❌ 删除视频失败:', error);
      toast.error('删除失败');
    }
  };

  // 合成图片拖拽传感器配置
  const compositeImageSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖动8px后才激活，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理合成图片拖拽结束
  const handleCompositeImageDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = compositeImages.findIndex(img => img.id === active.id);
    const newIndex = compositeImages.findIndex(img => img.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 更新UI顺序
    const newOrder = arrayMove(compositeImages, oldIndex, newIndex);
    setCompositeImages(newOrder);

    // 保存到数据库
    try {
      const updates = newOrder
        .filter(img => !img.isPlaceholder) // 只更新真实图片
        .map((img, index) => ({
          id: img.id,
          display_order: index + 1
        }));

      if (updates.length > 0) {
        await updateCompositeImagesOrder(updates);
        toast.success('图片顺序已保存');
      }
    } catch (error) {
      console.error('❌ 保存图片顺序失败:', error);
      toast.error('保存顺序失败');
      // 恢复原顺序
      setCompositeImages(arrayMove(newOrder, newIndex, oldIndex));
    }
  };

  // 批量生成同场景图片和视频
  const handleBatchGenerateVideos = async () => {
    if (!selectedNovel || selectedChapter === 0) {
      toast.error('请先选择小说和章节');
      return;
    }

    // 获取当前章节的剧本数据
    const scriptData = selectedNovel.scripts_data?.find(
      (script) => script.chapter_number === selectedChapter
    );
    
    if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
      toast.error('未找到剧本数据，请先生成剧本');
      return;
    }

    // 打开场景选择对话框
    setShowSceneSelectionDialog(true);
  };

  // 确认场景选择
  const handleConfirmSceneSelection = () => {
    if (selectedSceneNumbers.length === 0) {
      toast.error('请至少选择一个场景');
      return;
    }

    // 检查是否有合成图片可以作为参考图
    if (compositeImages.length === 0) {
      toast.error('请先生成至少一张合成图片作为首帧参考图');
      return;
    }

    // 关闭场景选择对话框，打开参考图选择对话框
    setShowSceneSelectionDialog(false);
    setShowReferenceImageDialog(true);
  };

  // 确认参考图选择并开始批量生成
  const handleConfirmReferenceImage = async () => {
    if (!selectedReferenceImageId) {
      toast.error('请选择一张合成图片作为首帧参考图');
      return;
    }

    // 关闭对话框
    setShowReferenceImageDialog(false);

    // 开始批量生成
    await executeBatchGeneration();
  };

  // 执行批量生成
  const executeBatchGeneration = async () => {
    if (!selectedNovel || selectedChapter === 0) {
      return;
    }

    // 获取当前章节的剧本数据
    const scriptData = selectedNovel.scripts_data?.find(
      (script) => script.chapter_number === selectedChapter
    );
    
    if (!scriptData || !scriptData.scenes) {
      return;
    }

    setIsBatchGeneratingVideos(true);
    setGenerationProgress(0);
    setGenerationStatus(`准备批量生成（共${selectedSceneNumbers.length}个场景）...`);

    try {
      // console.log(`🎬 开始批量生成同场景图片和视频，共${selectedSceneNumbers.length}个场景...`);
      // console.log(`📋 选中的场景: ${selectedSceneNumbers.join(', ')}`);

      let previousVideoUrl: string | null = null;
      let referenceImageUrl = compositeImages.find(img => img.id === selectedReferenceImageId)?.url || '';

      for (let i = 0; i < selectedSceneNumbers.length; i++) {
        const sceneNumber = selectedSceneNumbers[i];
        const scene = scriptData.scenes.find(s => s.scene_number === sceneNumber);

        if (!scene) {
          console.warn(`⚠️ 未找到场景${sceneNumber}，跳过`);
          continue;
        }

        // console.log(`\n🎬 开始生成场景${sceneNumber}（第${i + 1}/${selectedSceneNumbers.length}个）...`);
        setGenerationStatus(`正在生成场景${sceneNumber}（第${i + 1}/${selectedSceneNumbers.length}个）...`);
        setGenerationProgress((i / selectedSceneNumbers.length) * 100);

        try {
          // 第一步：生成合成图片
          // 使用场景的画面内容作为提示词
          const imagePrompt = extractSceneDescription(scene.script_content);
          // console.log(`📝 场景${sceneNumber}画面描述: ${imagePrompt}`);

          setGenerationStatus(`场景${sceneNumber} - 正在生成合成图片...`);
          
          // 调用图片合成API（使用参考图作为背景）
          const imageResult = await compositeImagesWithRetry(
            [{
              url: referenceImageUrl,
              mimeType: 'image/png',
              isBackground: true
            }],
            imagePrompt,
            (status, retryCount) => {
              setGenerationStatus(`场景${sceneNumber} - ${status} (${retryCount}/${MAX_RETRIES})`);
            }
          );

          if (!imageResult) {
            throw new Error('合成图片生成失败');
          }

          // console.log(`✅ 场景${sceneNumber}合成图片生成成功`);

          // 上传图片到Storage
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(7);
          const imageStoragePath = `${selectedNovel.id}/chapter_${selectedChapter}/composite/${timestamp}_${randomStr}.png`;
          
          const imageStorageUrl = await uploadImageToStorage(
            imageResult,
            'filming-composite-images',
            imageStoragePath
          );

          // console.log(`✅ 场景${sceneNumber}合成图片已上传到Storage`);

          // 保存合成图片记录到数据库
          const imageRecord = await createCompositeImage({
            scene_id: currentSceneId || '',
            image_url: imageStorageUrl,
            storage_path: imageStoragePath,
            prompt: imagePrompt
          });

          if (!imageRecord) {
            throw new Error('保存合成图片记录失败');
          }

          // console.log(`✅ 场景${sceneNumber}合成图片记录已保存`);

          // 更新UI
          const newImage = {
            id: imageRecord.id,
            url: imageStorageUrl,
            prompt: imagePrompt
          };
          setCompositeImages(prev => [...prev, newImage]);

          // 第二步：生成视频
          setGenerationStatus(`场景${sceneNumber} - 正在生成视频...`);

          // 增强视频提示词：添加化妆分析数据
          const enhancedVideoPrompt = enhanceVideoPromptWithMakeup(imagePrompt);
          // console.log(`📝 场景${sceneNumber}原始提示词: ${imagePrompt}`);
          // console.log(`📝 场景${sceneNumber}增强后提示词: ${enhancedVideoPrompt}`);

          // 调用图生视频API
          const videoResult = await image2VideoWithRetry(
            imageStorageUrl,
            enhancedVideoPrompt, // 使用增强后的提示词
            '10',  // 视频长度改为10秒
            (status, retryCount) => {
              setGenerationStatus(`场景${sceneNumber} - ${status} (${retryCount}/${MAX_RETRIES})`);
            }
          );

          if (!videoResult || !videoResult.videoUrl) {
            throw new Error('视频生成失败');
          }

          // console.log(`✅ 场景${sceneNumber}视频生成成功`);

          // 上传视频到Storage
          const videoStoragePath = `${selectedNovel.id}/chapter_${selectedChapter}/video/${timestamp}_${randomStr}.mp4`;
          
          const videoStorageUrl = await uploadImageToStorage(
            videoResult.videoUrl,
            'filming-videos',
            videoStoragePath
          );

          // console.log(`✅ 场景${sceneNumber}视频已上传到Storage`);

          // 保存视频记录到数据库
          const videoRecord = await createFilmingVideo({
            composite_image_id: imageRecord.id,
            video_url: videoStorageUrl,
            storage_path: videoStoragePath
          });

          if (!videoRecord) {
            throw new Error('保存视频记录失败');
          }

          // console.log(`✅ 场景${sceneNumber}视频记录已保存`);

          // 更新UI
          setVideos(prev => [...prev, {
            id: videoRecord.id,
            url: videoStorageUrl,
            compositeImageId: imageRecord.id
          }]);

          // 第三步：抽取视频尾帧作为下一个视频的参考图
          if (i < selectedSceneNumbers.length - 1) {
            setGenerationStatus(`场景${sceneNumber} - 正在抽取视频尾帧...`);
            
            const lastFrameUrl = await extractVideoLastFrame(videoStorageUrl);
            
            if (lastFrameUrl) {
              // console.log(`✅ 场景${sceneNumber}视频尾帧已抽取`);
              
              // 保存尾帧为新的合成图片
              const lastFrameStoragePath = `${selectedNovel.id}/chapter_${selectedChapter}/composite/${timestamp}_lastframe_${randomStr}.png`;
              
              const lastFrameStorageUrl = await uploadImageToStorage(
                lastFrameUrl,
                'filming-composite-images',
                lastFrameStoragePath
              );

              const lastFrameRecord = await createCompositeImage({
                scene_id: currentSceneId || '',
                image_url: lastFrameStorageUrl,
                storage_path: lastFrameStoragePath,
                prompt: `场景${sceneNumber}视频尾帧`
              });

              if (lastFrameRecord) {
                // console.log(`✅ 场景${sceneNumber}视频尾帧已保存为合成图片`);
                
                // 更新UI
                setCompositeImages(prev => [...prev, {
                  id: lastFrameRecord.id,
                  url: lastFrameStorageUrl,
                  prompt: `场景${sceneNumber}视频尾帧`
                }]);

                // 使用尾帧作为下一个视频的参考图
                referenceImageUrl = lastFrameStorageUrl;
                // console.log(`✅ 将场景${sceneNumber}视频尾帧设为下一个场景的参考图`);
              }
            }
          }

          // console.log(`✅ 场景${sceneNumber}生成完成！`);

        } catch (error) {
          console.error(`❌ 生成场景${sceneNumber}失败:`, error);
          toast.error(`场景${sceneNumber}生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
          // 继续生成下一个场景
        }
      }

      setGenerationProgress(100);
      setGenerationStatus('批量生成完成！');
      toast.success(`成功生成 ${selectedSceneNumbers.length} 个场景的图片和视频！`);

    } catch (error) {
      console.error('❌ 批量生成失败:', error);
      toast.error(`批量生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsBatchGeneratingVideos(false);
      setSelectedSceneNumbers([]);
      setSelectedReferenceImageId('');
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 2000);
    }
  };

  // 从剧本内容中提取画面描述
  const extractSceneDescription = (scriptContent: string): string => {
    // 提取"画面："后面的内容
    const match = scriptContent.match(/画面[：:](.*?)(?=\n|$)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    // 如果没有找到"画面："，返回整个剧本内容的前100字
    return scriptContent.substring(0, 100);
  };

  // 抽取视频最后一帧
  const extractVideoLastFrame = async (videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = addCacheBuster(videoUrl);

        video.addEventListener('loadedmetadata', () => {
          // 跳转到最后一帧（视频时长 - 0.1秒）
          video.currentTime = Math.max(0, video.duration - 0.1);
        });

        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/png');
              resolve(dataUrl);
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('❌ 抽取视频尾帧失败:', error);
            resolve(null);
          }
        });

        video.addEventListener('error', () => {
          console.error('❌ 视频加载失败');
          resolve(null);
        });

        video.load();
      } catch (error) {
        console.error('❌ 抽取视频尾帧失败:', error);
        resolve(null);
      }
    });
  };

  // 提取视频最后一帧到画布
  const handleExtractLastFrame = async (videoUrl: string) => {
    try {
      // 创建video元素
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      
      // 等待视频加载完成
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
      
      // 跳转到最后一帧
      video.currentTime = video.duration - 0.1; // 最后0.1秒前
      
      // 等待视频跳转完成
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });
      
      // 创建canvas并绘制当前帧
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('无法创建canvas上下文');
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 转换为blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法转换为blob'));
          }
        }, 'image/png');
      });
      
      // 直接上传blob到Storage
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const storagePath = `${selectedNovel?.id}/chapter_${selectedChapter}/frames/${timestamp}_${randomStr}.png`;
      
      const storageUrl = await uploadBlobToStorage(
        blob,
        'filming-composite-images',
        storagePath
      );
      
      // 清空画布，将最后一帧作为布景元素
      const newElement: CanvasElement = {
        id: `background_${Date.now()}`,
        type: 'background', // 作为布景类型
        name: '视频最后一帧',
        imageUrl: storageUrl,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 0
      };
      
      // 清空画布并添加新的布景
      setCanvasElements([newElement]);
      
      toast.success('最后一帧已设为布景');
    } catch (error) {
      console.error('❌ 提取尾帧失败:', error);
      toast.error(`提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#FF5724] mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 页面标题 */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div className="flex items-center gap-3 mb-2 flex-1">
            <div className="p-3 bg-gradient-to-br from-[#FF5724] to-[#FF8A50] rounded-xl shadow-lg">
              <Film className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#FF5724] to-[#FF8A50] bg-clip-text text-transparent">
                一心拍戏
              </h1>
              <p className="text-muted-foreground mt-1">
                通过拖拽布置场景，生成拍摄图片和视频
              </p>
            </div>
            {!isDemoMode && (
              <Button
                onClick={handleFillDemoData}
                className="from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg bg-[#f35323e6] bg-none"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                填充案例
              </Button>
            )}
          </div>
        </div>

        {/* 小说和章节选择 */}
        <Card className="mb-6 border-orange-200 dark:border-orange-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#FF5724]">选择小说和章节</CardTitle>
            <CardDescription>选择要拍摄的小说和章节剧本</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 小说选择 */}
              <div className="space-y-2">
                <Label>选择小说</Label>
                <Select value={selectedNovelId} onValueChange={handleNovelSelect} disabled={isDemoMode}>
                  <SelectTrigger className={isDemoMode ? 'pointer-events-none opacity-60' : ''}>
                    <SelectValue placeholder="请选择小说" />
                  </SelectTrigger>
                  <SelectContent>
                    {novels.map(novel => (
                      <SelectItem key={novel.id} value={novel.id}>
                        {novel.novel_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 章节选择 */}
              <div className="space-y-2">
                <Label>选择章节</Label>
                <Select 
                  value={selectedChapter.toString()} 
                  onValueChange={handleChapterSelect}
                  disabled={!selectedNovel || isDemoMode}
                >
                  <SelectTrigger className={isDemoMode ? 'pointer-events-none opacity-60' : ''}>
                    <SelectValue placeholder="请选择章节" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedNovel?.scripts_data?.map(script => (
                      <SelectItem key={script.chapter_number} value={script.chapter_number.toString()}>
                        第{script.chapter_number}章 - {script.chapter_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 剧本内容显示 */}
        {selectedNovel && selectedChapter > 0 && (
          <Card className="mb-6 border-orange-200 dark:border-orange-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-[#FF5724]">
                第{selectedChapter}章 - {selectedNovel.scripts_data?.find(s => s.chapter_number === selectedChapter)?.chapter_title}
              </CardTitle>
              <CardDescription>剧本内容</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                <div className="whitespace-pre-wrap text-sm">
                  {selectedNovel.scripts_data?.find(s => s.chapter_number === selectedChapter)?.script_content}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* 场景布置区域 - 左右分栏布局 */}
        {selectedNovel && selectedChapter > 0 && (
          <Card className="border-orange-200 dark:border-orange-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-[#FF5724]">场景布置</CardTitle>
              <CardDescription>拖拽图片到画布中布置场景</CardDescription>
            </CardHeader>
            <CardContent className="bg-[#ffffff00] bg-none">
              {/* 左右分栏布局 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：画布区域 */}
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">拍摄画布（1:1比例）</Label>
                    <div className={isDemoMode ? 'pointer-events-none opacity-60' : ''}>
                      <DraggableCanvas
                        elements={canvasElements}
                        onElementsChange={setCanvasElements}
                        onDrop={handleDropToCanvas}
                        className="max-w-md mx-auto"
                      />
                    </div>
                  </div>
                </div>

                {/* 右侧：资源选择区域 */}
                <div className={`space-y-4 ${isDemoMode ? 'pointer-events-none opacity-60' : ''}`}>
                  <Tabs defaultValue="characters" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="characters">角色</TabsTrigger>
                      <TabsTrigger value="costumes">服装</TabsTrigger>
                      <TabsTrigger value="background">布景</TabsTrigger>
                      <TabsTrigger value="props">道具</TabsTrigger>
                    </TabsList>

                    {/* 角色选项卡 */}
                    <TabsContent value="characters" className="space-y-4">
                      {characters.length > 0 ? (
                        <ScrollArea className="h-[500px]">
                          <div className="grid grid-cols-2 gap-4 p-2">
                            {characters.map(character => (
                              <Card key={character.id} className="cursor-move hover:shadow-lg transition-shadow">
                                <CardContent className="p-3">
                                  <img
                                    src={addCacheBuster(character.imageUrl)}
                                    alt={character.name}
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('imageUrl', character.imageUrl);
                                      e.dataTransfer.setData('name', character.name);
                                      e.dataTransfer.setData('type', character.type);
                                    }}
                                  />
                                  <p className="text-sm font-medium truncate">{character.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{character.description}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg p-8 text-center">
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-2">暂无角色图片</p>
                          <p className="text-sm text-muted-foreground">请先在"一心准备"页面生成角色图片</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* 服装选项卡 */}
                    <TabsContent value="costumes" className="space-y-4">
                      {costumes.length > 0 ? (
                        <ScrollArea className="h-[500px]">
                          <div className="grid grid-cols-2 gap-4 p-2">
                            {costumes.map(costume => (
                              <Card key={costume.id} className="cursor-move hover:shadow-lg transition-shadow">
                                <CardContent className="p-3">
                                  <img
                                    src={addCacheBuster(costume.imageUrl)}
                                    alt={costume.name}
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('imageUrl', costume.imageUrl);
                                      e.dataTransfer.setData('name', costume.name);
                                      e.dataTransfer.setData('type', costume.type);
                                    }}
                                  />
                                  <p className="text-sm font-medium truncate">{costume.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{costume.description}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg p-8 text-center">
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-2">暂无服装图片</p>
                          <p className="text-sm text-muted-foreground">请先在"一心准备"页面生成服装图片</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* 布景选项卡 */}
                    <TabsContent value="background" className="space-y-4">
                      {scenes.length > 0 ? (
                        <ScrollArea className="h-[500px]">
                          <div className="grid grid-cols-2 gap-4 p-2">
                            {scenes.map(scene => (
                              <Card key={scene.id} className="cursor-move hover:shadow-lg transition-shadow">
                                <CardContent className="p-3">
                                  <img
                                    src={addCacheBuster(scene.imageUrl)}
                                    alt={scene.name}
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('imageUrl', scene.imageUrl);
                                      e.dataTransfer.setData('name', scene.name);
                                      e.dataTransfer.setData('type', scene.type);
                                    }}
                                  />
                                  <p className="text-sm font-medium truncate">{scene.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{scene.description}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg p-8 text-center">
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-2">暂无布景图片</p>
                          <p className="text-sm text-muted-foreground">请先在"一心准备"页面生成布景图片</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* 道具选项卡 */}
                    <TabsContent value="props" className="space-y-4">
                      {props.length > 0 ? (
                        <ScrollArea className="h-[500px]">
                          <div className="grid grid-cols-2 gap-4 p-2">
                            {props.map(prop => (
                              <Card key={prop.id} className="cursor-move hover:shadow-lg transition-shadow">
                                <CardContent className="p-3">
                                  <img
                                    src={addCacheBuster(prop.imageUrl)}
                                    alt={prop.name}
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('imageUrl', prop.imageUrl);
                                      e.dataTransfer.setData('name', prop.name);
                                      e.dataTransfer.setData('type', prop.type);
                                    }}
                                  />
                                  <p className="text-sm font-medium truncate">{prop.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{prop.description}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg p-8 text-center">
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-2">暂无道具图片</p>
                          <p className="text-sm text-muted-foreground">请先在"一心准备"页面生成道具图片</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* 提示词输入 */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Label>场景描述提示词</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-4 w-4" />
                        <span className="text-xs">点击查看参考内容</span>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="max-w-3xl w-[700px] p-0 bg-white text-black border-2">
                      <Tabs defaultValue="content" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-gray-100">
                          <TabsTrigger value="content" className="data-[state=active]:bg-white data-[state=active]:text-black">📖 章节内容</TabsTrigger>
                          <TabsTrigger value="makeup" className="data-[state=active]:bg-white data-[state=active]:text-black">💄 化妆分析</TabsTrigger>
                          <TabsTrigger value="styling" className="data-[state=active]:bg-white data-[state=active]:text-black">🎨 造型逻辑</TabsTrigger>
                          <TabsTrigger value="overall" className="data-[state=active]:bg-white data-[state=active]:text-black">✨ 综合分析</TabsTrigger>
                        </TabsList>

                        {/* 章节详细内容 */}
                        <TabsContent value="content" className="m-0 p-4">
                          <ScrollArea className="h-[500px]">
                            <div className="pr-4">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed text-black">
                                {selectedNovel?.scripts_data?.find(s => s.chapter_number === selectedChapter)?.script_content || '暂无章节内容'}
                              </p>
                            </div>
                          </ScrollArea>
                        </TabsContent>

                        {/* 化妆分析 */}
                        <TabsContent value="makeup" className="m-0 p-4">
                          <ScrollArea className="h-[500px]">
                            <div className="pr-4">
                              {selectedNovel?.makeup_data && selectedNovel.makeup_data.filter(m => m.chapter_number === selectedChapter).length > 0 ? (
                                <div className="space-y-4">
                                  {selectedNovel.makeup_data
                                    .filter(m => m.chapter_number === selectedChapter)
                                    .map((item, index) => (
                                      <div key={index} className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                                        <div className="space-y-2 text-black">
                                          <p className="text-sm"><strong className="text-orange-600">角色：</strong>{item.character}</p>
                                          <p className="text-sm"><strong className="text-orange-600">风格：</strong>{item.style}</p>
                                          <p className="text-sm"><strong className="text-orange-600">细节：</strong>{item.details}</p>
                                          <p className="text-sm"><strong className="text-orange-600">情绪：</strong>{item.emotion}</p>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 text-center py-8">暂无化妆分析数据</p>
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>

                        {/* 造型逻辑 */}
                        <TabsContent value="styling" className="m-0 p-4">
                          <ScrollArea className="h-[500px]">
                            <div className="pr-4">
                              {selectedNovel?.styling_logic_data && selectedNovel.styling_logic_data.filter(s => s.chapter_number === selectedChapter).length > 0 ? (
                                <div className="space-y-4">
                                  {selectedNovel.styling_logic_data
                                    .filter(s => s.chapter_number === selectedChapter)
                                    .map((item, index) => (
                                      <div key={index} className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                                        <div className="space-y-2 text-black">
                                          <p className="text-sm"><strong className="text-blue-600">方面：</strong>{item.aspect}</p>
                                          <p className="text-sm"><strong className="text-blue-600">逻辑：</strong>{item.logic}</p>
                                          <p className="text-sm"><strong className="text-blue-600">角色反映：</strong>{item.character_reflection}</p>
                                          <p className="text-sm"><strong className="text-blue-600">剧情联系：</strong>{item.plot_connection}</p>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 text-center py-8">暂无造型逻辑数据</p>
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>

                        {/* 综合分析 */}
                        <TabsContent value="overall" className="m-0 p-4">
                          <ScrollArea className="h-[500px]">
                            <div className="pr-4">
                              {selectedNovel?.overall_analysis_data && selectedNovel.overall_analysis_data.filter(o => o.chapter_number === selectedChapter).length > 0 ? (
                                <div className="space-y-4">
                                  {selectedNovel.overall_analysis_data
                                    .filter(o => o.chapter_number === selectedChapter)
                                    .map((item, index) => (
                                      <div key={index} className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                                        <div className="space-y-2 text-black">
                                          <p className="text-sm"><strong className="text-purple-600">分类：</strong>{item.category}</p>
                                          <p className="text-sm"><strong className="text-purple-600">建议：</strong>{item.suggestion}</p>
                                          <p className="text-sm"><strong className="text-purple-600">协调要求：</strong>{item.coordination}</p>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 text-center py-8">暂无综合分析数据</p>
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea
                  placeholder="描述这个场景的氛围、光线、动作等细节..."
                  className="min-h-[100px]"
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                />
              </div>

              {/* 生成进度 */}
              {(isGeneratingImage || isGeneratingVideo) && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{generationStatus}</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(generationProgress)}%</span>
                  </div>
                  <Progress value={generationProgress} className="w-full" />
                </div>
              )}

              {/* 操作按钮 */}
              {!isDemoMode && (
                <div className="mt-6 flex flex-wrap gap-4">
                  <Button 
                    className="bg-[#FF5724] hover:bg-[#FF5724]/90"
                    onClick={handleGenerateCompositeImage}
                    disabled={canvasElements.length === 0}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    生成拍摄图片
                  </Button>
                  
                  {compositeImages.length > 0 && (
                    <>
                      <Button 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleBatchGenerateVideos}
                      >
                      {isBatchGeneratingVideos ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          批量生成中...
                        </>
                      ) : (
                        <>
                          <Video className="mr-2 h-4 w-4" />
                          批量生成同场景图片和视频
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
              )}

              {/* 生成的合成图片 */}
              {compositeImages.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Label>生成的合成图片</Label>
                    <span className="text-xs text-muted-foreground">（拖拽图片可调整顺序）</span>
                  </div>
                  <DndContext
                    sensors={compositeImageSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCompositeImageDragEnd}
                  >
                    <SortableContext
                      items={compositeImages.filter(img => img && img.id).map(img => img.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {compositeImages.filter(img => img && img.id).map((image) => (
                          <SortableImageCard
                            key={image.id}
                            image={image}
                            videos={videos}
                            audioFiles={audioFiles}
                            videoPrompts={videoPrompts}
                            generatingVideoIds={generatingVideoIds}
                            hoveredVideoId={hoveredVideoId}
                            selectedNovel={selectedNovel}
                            selectedChapter={selectedChapter}
                            isDemoMode={isDemoMode}
                            onDeleteImage={handleDeleteImage}
                            onVideoPromptChange={setVideoPrompts}
                            onGenerateVideo={handleGenerateVideo}
                            onDeleteVideo={handleDeleteVideo}
                            onExtractLastFrame={handleExtractLastFrame}
                            onHoverVideo={setHoveredVideoId}
                            extractVideoPromptFromScene={extractVideoPromptFromScene}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {/* 生成的视频 */}
              {compositeImages.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>生成的视频（按合成图片顺序）</Label>
                    {!isDemoMode && compositeImages.length > 1 && (
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={handleGenerateNarration}
                                disabled={isGeneratingNarration}
                                className="bg-[#ff5724] text-white"
                              >
                                {isGeneratingNarration ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    生成中...
                                  </>
                                ) : hasExistingNarrations ? (
                                  <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    重新生成解说
                                  </>
                                ) : (
                                  <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    生成解说
                                  </>
                                )}
                              </Button>
                            </TooltipTrigger>
                            {hasExistingNarrations && selectedNovel && selectedChapter > 0 && (
                              <TooltipContent className="max-w-md max-h-96 overflow-y-auto bg-[#ffffff] bg-none">
                                <div className="space-y-2">
                                  <p className="font-semibold text-[#000000]">当前解说内容：</p>
                                  {selectedNovel.scripts_data
                                    ?.find(script => script.chapter_number === selectedChapter)
                                    ?.scenes?.map((scene, idx) => (
                                      <div key={idx} className="text-sm">
                                        <span className="text-[#000000]">场景{idx + 1}：</span>
                                        <span className="text-[#000000]">{scene.narration_content || '暂无解说'}</span>
                                      </div>
                                    ))}
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        {hasExistingNarrations && (
                          <Button
                            onClick={async () => {
                              // 复制所有解说内容
                              if (selectedNovel && selectedChapter > 0) {
                                try {
                                  const scriptData = selectedNovel.scripts_data?.find(
                                    script => script.chapter_number === selectedChapter
                                  );
                                  
                                  if (scriptData?.scenes && scriptData.scenes.length > 0) {
                                    const narrations = scriptData.scenes
                                      .map((scene, idx) => `场景${idx + 1}：${scene.narration_content || '暂无解说'}`)
                                      .join('\n\n');
                                    
                                    await navigator.clipboard.writeText(narrations);
                                    toast.success(`已复制${scriptData.scenes.length}个场景的解说内容到粘贴板`);
                                    // console.log('📋 已复制解说内容:', narrations);
                                  } else {
                                    toast.error('暂无解说内容可复制');
                                  }
                                } catch (error) {
                                  console.error('❌ 复制失败:', error);
                                  toast.error('复制失败，请手动复制');
                                }
                              } else {
                                toast.error('请先选择小说和章节');
                              }
                            }}
                            variant="outline"
                            size="icon"
                            className="border-[#ff5724] text-[#ff5724] bg-[#ffffffe6] bg-none"
                            title="复制解说内容"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={handleAutoGenerateAudio}
                          disabled={isGeneratingVideo || !narrationsGenerated}
                          className="bg-[#ff5724] text-white"
                        >
                          {isGeneratingVideo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              生成中...
                            </>
                          ) : hasExistingAudio || audioFiles.length > 0 ? (
                            <>
                              <Volume2 className="mr-2 h-4 w-4" />
                              重新生成配音
                            </>
                          ) : (
                            <>
                              <Volume2 className="mr-2 h-4 w-4" />
                              生成配音
                            </>
                          )}
                        </Button>
                        {(hasExistingAudio || audioFiles.length > 0) && (
                          <Button
                            onClick={async () => {
                              // 复制所有音频链接
                              if (audioFiles.length > 0) {
                                try {
                                  const audioLinks = audioFiles.map(audio => audio.url).join('\n');
                                  await navigator.clipboard.writeText(audioLinks);
                                  toast.success(`已复制${audioFiles.length}个音频链接到粘贴板`);
                                  // console.log('📋 已复制音频链接:', audioLinks);
                                } catch (error) {
                                  console.error('❌ 复制失败:', error);
                                  toast.error('复制失败，请手动复制');
                                }
                              } else {
                                toast.error('暂无音频文件可复制');
                              }
                            }}
                            variant="outline"
                            size="icon"
                            className="border-[#ff5724] text-[#ff5724] bg-[#ffffffe6] bg-none"
                            title="复制音频链接"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={handleOpenMergeDialog}
                          disabled={isGeneratingVideo}
                          className="bg-[#ff5724] text-white"
                        >
                          {isGeneratingVideo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <Film className="mr-2 h-4 w-4" />
                              视频管理
                            </>
                          )}
                        </Button>
                        {videoMergeToolUrl && (
                          <Button
                            onClick={() => window.open(videoMergeToolUrl, '_blank')}
                            variant="outline"
                            className="border-[#ff5724] text-[#ffffff]"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            视频合成
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {compositeImages.map((compositeImage, index) => {
                      // 查找对应的视频
                      const video = videos.find(v => v.compositeImageId === compositeImage.id);
                      
                      return (
                        <Card 
                          key={compositeImage.id} 
                          className="overflow-hidden relative"
                          onMouseEnter={() => video && setHoveredVideoId(video.id)}
                          onMouseLeave={() => setHoveredVideoId(null)}
                        >
                          <CardContent className="p-4 space-y-3">
                            {video ? (
                              // 已生成视频
                              (<>
                                <div className="relative">
                                  <video
                                    src={video.url}
                                    controls
                                    className="w-full rounded-md"
                                  />
                                  {!isDemoMode && (
                                    <>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-2 right-2"
                                        onClick={() => handleDeleteVideo(video.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                      
                                      {/* 悬浮时显示重新生成按钮 */}
                                      {hoveredVideoId === video.id && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          className="absolute bottom-2 left-2 bg-primary/90 hover:bg-primary text-primary-foreground"
                                          onClick={async () => {
                                            // 先删除旧视频
                                            await handleDeleteVideo(video.id);
                                            // 重新生成视频
                                            await handleGenerateVideo(compositeImage.id, compositeImage.url);
                                          }}
                                        >
                                          <Sparkles className="mr-1 h-3 w-3" />
                                          重新生成
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                                {/* 操作按钮 */}
                                {!isDemoMode && (
                                  <div className="flex gap-2">
                                    <Button
                                      className="flex-1"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(video.url, '_blank')}
                                    >
                                      <Download className="mr-2 h-4 w-4" />
                                      下载
                                    </Button>
                                    <Button
                                      className="flex-1"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleExtractLastFrame(video.url)}
                                    >
                                      <ImagePlus className="mr-2 h-4 w-4" />
                                      提取尾帧
                                    </Button>
                                  </div>
                                )}
                              </>)
                            ) : (
                              // 未生成视频，显示合成图片和生成按钮
                              (<div className="relative">
                                <img
                                  src={compositeImage.url}
                                  alt={`合成图片 ${index + 1}`}
                                  className="w-full rounded-md opacity-50"
                                />
                                {!isDemoMode && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Button
                                      onClick={() => handleGenerateVideo(compositeImage.id, compositeImage.url)}
                                      disabled={isGeneratingVideo}
                                      className="bg-primary hover:bg-primary/90"
                                    >
                                      <Video className="mr-2 h-4 w-4" />
                                      生成视频
                                    </Button>
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                                  未生成视频
                                </div>
                              </div>)
                            )}
                            
                            {/* 显示序号 */}
                            <div className="text-sm text-muted-foreground">
                              场景 {index + 1}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {(!selectedNovel || selectedChapter === 0) && (
          <Card className="border-orange-200 dark:border-orange-800 shadow-lg">
            <CardContent className="text-center py-12">
              <Film className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground mb-2">请先选择小说和章节</p>
              <p className="text-sm text-muted-foreground">选择后即可开始布置拍摄场景</p>
            </CardContent>
          </Card>
        )}

        {/* 场景选择对话框 */}
        <Dialog open={showSceneSelectionDialog} onOpenChange={setShowSceneSelectionDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>选择要生成的场景</DialogTitle>
              <DialogDescription>
                请勾选要批量生成图片和视频的场景（可多选）
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {selectedNovel?.scripts_data?.find(
                (script) => script.chapter_number === selectedChapter
              )?.scenes?.map((scene) => (
                <div key={scene.scene_number} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent">
                  <Checkbox
                    id={`scene-${scene.scene_number}`}
                    checked={selectedSceneNumbers.includes(scene.scene_number)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSceneNumbers(prev => [...prev, scene.scene_number].sort((a, b) => a - b));
                      } else {
                        setSelectedSceneNumbers(prev => prev.filter(n => n !== scene.scene_number));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={`scene-${scene.scene_number}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      场景{scene.scene_number}：{scene.scene_title}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scene.novel_content?.substring(0, 50)}...
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSceneSelectionDialog(false)}>
                取消
              </Button>
              <Button onClick={handleConfirmSceneSelection}>
                确定（已选{selectedSceneNumbers.length}个）
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 参考图选择对话框 */}
        <Dialog open={showReferenceImageDialog} onOpenChange={setShowReferenceImageDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>选择首帧参考图</DialogTitle>
              <DialogDescription>
                请选择一张合成图片作为第一个场景的参考图，后续场景将自动使用前一个视频的尾帧
              </DialogDescription>
            </DialogHeader>
            
            <RadioGroup value={selectedReferenceImageId} onValueChange={setSelectedReferenceImageId}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                {compositeImages.map((image) => (
                  <div key={image.id} className="relative">
                    <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={image.id} id={`ref-${image.id}`} />
                      <Label htmlFor={`ref-${image.id}`} className="flex-1 cursor-pointer">
                        <img
                          src={addCacheBuster(image.url)}
                          alt="参考图"
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                        <p className="text-xs text-muted-foreground truncate">
                          {image.prompt?.substring(0, 30)}...
                        </p>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowReferenceImageDialog(false);
                setShowSceneSelectionDialog(true);
              }}>
                返回
              </Button>
              <Button onClick={handleConfirmReferenceImage}>
                开始生成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 视频合并对话框 */}
        <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>视频管理</DialogTitle>
              <DialogDescription>{"拖动视频调整顺序，可以复制所有视频链接"}</DialogDescription>
            </DialogHeader>

            {/* 视频列表区域 - 添加固定高度和滚动条 */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleVideoDragEnd}
              >
                <SortableContext
                  items={sortedVideos.filter(v => v && v.id).map(v => v.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 pb-2">
                    {sortedVideos.filter(v => v && v.id).map((video, index) => (
                      <SortableVideoItem
                        key={video.id}
                        video={video}
                        index={index}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* 合并进度显示 */}
            {isMergingVideos && (
              <div className="space-y-2 py-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span>正在合并视频...</span>
                  <span>{mergeProgress}%</span>
                </div>
                <Progress value={mergeProgress} />
              </div>
            )}

            {/* 合并成功提示 */}
            {mergedVideoUrl && !isMergingVideos && (
              <div className="py-3 border-t">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>视频合并完成！请点击下载按钮保存视频</span>
                </div>
              </div>
            )}

            <DialogFooter>

              {/* 复制视频链接按钮 - 始终显示 */}
              <Button
                onClick={handleCopyVideoLinks}
                disabled={isMergingVideos || sortedVideos.length === 0}
                variant="secondary"
              >
                <Copy className="mr-2 h-4 w-4" />
                复制所有视频链接
              </Button>
              {/* 合并按钮 - 合并完成后隐藏 */}
              {!mergedVideoUrl && (
                <></>
              )}
              {/* 下载按钮 - 合并完成后显示 */}
              {mergedVideoUrl && !isMergingVideos && (
                <Button
                  onClick={handleDownloadMergedVideo}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载视频
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* 演示模式：右下角悬浮退出按钮 */}
      {isDemoMode && (
        <div className="fixed bottom-8 right-8 z-50">
          <Button
            onClick={handleExitDemo}
            size="lg"
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-2xl rounded-full px-6 py-6 text-lg font-bold animate-pulse"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            退出演示
          </Button>
        </div>
      )}
    </div>
  );
}

// 可排序的视频项组件
function SortableVideoItem({ video, index }: { 
  video: { id: string; url: string; compositeImageId: string }; 
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 hover:bg-accent rounded"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-semibold">
        {index + 1}
      </div>
      
      <video
        src={video.url}
        className="w-32 h-20 object-cover rounded"
      />
      
      <div className="flex-1">
        <p className="text-sm font-medium">视频 {index + 1}</p>
        <p className="text-xs text-muted-foreground truncate">
          {video.url.split('/').pop()}
        </p>
      </div>
    </div>
  );
}
