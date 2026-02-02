import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  BookOpen, 
  User as UserIcon, 
  Image, 
  Settings, 
  Loader2,
  Sparkles,
  Palette,
  FileText,
  Volume2,
  LogIn,
  UserCircle,
  Film,
  Wand2,
  Users
} from 'lucide-react';

import NovelRequestForm from '@/components/novel/NovelRequestForm';
import NovelPreview from '@/components/novel/NovelPreview';
import CharacterGenerator from '@/components/novel/CharacterGenerator';
import ComicGenerator from '@/components/novel/ComicGenerator';
import ProjectManager from '@/components/novel/ProjectManager';
import ReadingMode from '@/components/novel/ReadingMode';
import WorkflowRoadmap from '@/components/workflow/WorkflowRoadmap';
import { LoginDialog } from '@/components/auth/LoginDialog';

import { 
  SakuraPetal, 
  AnimeStar, 
  ComicBubble, 
  ChineseCloud, 
  CuteEmoji, 
  JapaneseFan, 
  ComicSparkle,
  ChineseSeal 
} from '@/components/decorations/AnimeDecorations';

import { useNovelGeneration } from '@/hooks/useNovelGeneration';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUser, createNovel, updateNovelBasicInfo, saveOptimizedChapters, saveCharacters, savePanels } from '@/db/api';
import { supabase } from '@/db/supabase';
import { uploadImageToStorage } from '@/utils/storage-helper';
import type { DbUser } from '@/types/database';
import type { 
  NovelRequest, 
  Novel, 
  NovelChapter,
  NovelOutline,
  Character, 
  ComicPanel, 
  ProjectVersion 
} from '@/types/novel';

const NovelCreationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('create');
  const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<NovelChapter | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [comicPanels, setComicPanels] = useState<ComicPanel[]>([]);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [readingChapterIndex, setReadingChapterIndex] = useState(0);
  const [isComicGenerating, setIsComicGenerating] = useState(false);
  const [isCoverGenerating, setIsCoverGenerating] = useState(false);
  const [isCharacterGenerating, setIsCharacterGenerating] = useState(false);
  const [novelGenerationProgress, setNovelGenerationProgress] = useState(0);
  
  // 使用AuthContext获取用户状态
  const { currentUser, refreshUser } = useAuth();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [currentNovelId, setCurrentNovelId] = useState<string | null>(null); // 数据库中的小说ID
  
  // 章节生成相关state
  const [currentOutline, setCurrentOutline] = useState<NovelOutline | null>(null);
  const [currentRequest, setCurrentRequest] = useState<NovelRequest | null>(null);
  const [generatingChapterIndex, setGeneratingChapterIndex] = useState(-1);
  const [optimizedChapters, setOptimizedChapters] = useState<NovelChapter[]>([]); // 存储优化后的章节
  const [isCoverGenerated, setIsCoverGenerated] = useState(false); // 封面是否已生成
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string>(''); // 生成的封面URL
  const [isChapterContentGenerating, setIsChapterContentGenerating] = useState(false); // 章节内容是否正在生成
  const [allChaptersGenerated, setAllChaptersGenerated] = useState(false); // 所有章节是否已生成完成
  const [recreationInitialData, setRecreationInitialData] = useState<Partial<NovelRequest> | undefined>(undefined); // 二创初始数据
  const [chapterGenerationStatuses, setChapterGenerationStatuses] = useState<Map<number, { status: 'pending' | 'generating' | 'success' | 'failed' | 'retrying'; retryCount: number; error?: string }>>(new Map()); // 章节生成状态
  const [coverGenerationStatus, setCoverGenerationStatus] = useState<{ status: 'pending' | 'generating' | 'success' | 'failed'; retryCount: number; error?: string }>({ status: 'pending', retryCount: 0 }); // 封面生成状态

  const { 
    generateNovelOutline,
    generateDetailedChapters,
    retryChapterGeneration,
    retryCoverGeneration,
    stopGeneration, 
    isGenerating, 
    currentContent 
  } = useNovelGeneration();

  const { deduct: deductCredits, isDeducting } = useCredits();

  // 登录成功回调
  const handleLoginSuccess = async () => {
    console.log('🎉 [登录成功] handleLoginSuccess被调用');
    await refreshUser();
    console.log('🎉 [登录成功] refreshUser执行完成');
    // toast 已经在 LoginDialog 中显示，这里不需要重复显示
  };

  // 监控currentUser状态变化
  useEffect(() => {
    console.log('👤 [NovelCreationPage] currentUser状态变化:', currentUser);
    console.log('👤 [NovelCreationPage] currentUser是否存在:', !!currentUser);
    if (currentUser) {
      console.log('👤 [NovelCreationPage] 用户ID:', currentUser.id);
      console.log('👤 [NovelCreationPage] 用户邮箱:', currentUser.email || currentUser.phone);
      console.log('👤 [NovelCreationPage] 会员等级:', currentUser.membership_level);
    }
  }, [currentUser]);

  // 处理从NovelDetailPage传递过来的数据
  useEffect(() => {
    const state = location.state as {
      novelData?: {
        id: string;
        title: string;
        description: string | null;
        coverImageUrl: string | null;
        genre?: string;
        chapters: any[];
        characters?: any[]; // 添加角色数据
        panels?: any[]; // 添加分镜数据
      };
      activeTab?: string;
      recreationData?: Partial<NovelRequest>; // 添加二创数据支持
    };

    if (state?.novelData) {
      console.log("📥 接收到小说数据:", state.novelData);
      
      // 转换章节数据格式
      const chapters: NovelChapter[] = state.novelData.chapters.map((ch: any) => ({
        id: `chapter-${ch.chapter_number}`,
        title: ch.title,
        content: ch.content,
        order: ch.chapter_number,
        wordCount: ch.content.length,
        audioUrl: ch.audio_url, // 保留音频URL
        createdAt: new Date(),
      }));

      // 设置小说数据
      const novel: Novel = {
        id: state.novelData.id,
        title: state.novelData.title,
        description: state.novelData.description || '',
        genre: state.novelData.genre || '未知',
        style: '未知',
        chapters: chapters,
        coverImageUrl: state.novelData.coverImageUrl || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setCurrentNovel(novel);
      setCurrentNovelId(state.novelData.id);
      setOptimizedChapters(chapters);
      setWorkflowStep(2);
      
      // 处理角色数据
      if (state.novelData.characters && state.novelData.characters.length > 0) {
        console.log("👥 接收到角色数据:", state.novelData.characters.length, "个角色");
        const loadedCharacters: Character[] = state.novelData.characters.map((char: any) => ({
          id: char.id,
          name: char.name,
          description: char.description,
          appearance: '', // 数据库中没有单独的appearance字段
          personality: '', // 数据库中没有单独的personality字段
          imageUrl: char.image_url,
          status: 'completed' as const,
          createdAt: new Date(),
        }));
        setCharacters(loadedCharacters);
        console.log("✅ 角色数据已加载");
      }
      
      // 处理分镜数据
      if (state.novelData.panels && state.novelData.panels.length > 0) {
        console.log("🎬 接收到分镜数据:", state.novelData.panels.length, "个分镜");
        const loadedPanels: ComicPanel[] = state.novelData.panels.map((panel: any) => ({
          id: panel.id,
          chapterId: `chapter-${panel.chapter_number}`,
          order: panel.panel_number,
          description: panel.description,
          imageUrl: panel.image_url,
          status: 'completed' as const,
          createdAt: new Date(),
        }));
        setComicPanels(loadedPanels);
        console.log("✅ 分镜数据已加载");
      }
      
      // 设置活动选项卡
      if (state.activeTab) {
        setActiveTab(state.activeTab);
        console.log("🔄 切换到选项卡:", state.activeTab);
      }

      // 清除location.state，避免重复处理
      window.history.replaceState({}, document.title);
    }

    // 处理二创数据
    if (state?.recreationData) {
      console.log("🎨 接收到二创数据:", state.recreationData);
      setRecreationInitialData(state.recreationData);
      setActiveTab('create'); // 切换到创作选项卡
      toast.success("已为您填充二创数据，可以开始创作啦！");
      
      // 清除location.state，避免重复处理
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 监听章节优化和封面生成完成，自动保存
  useEffect(() => {
    // 检查是否所有条件都满足
    if (!currentOutline || !currentNovel) return;
    if (!isCoverGenerated) return;
    if (optimizedChapters.length === 0) return;
    if (optimizedChapters.length !== currentOutline.chapters.length) return;
    
    // 所有条件都满足，执行保存
    console.log("========================================");
    console.log("💾 [触发自动保存] 所有条件已满足");
    console.log("✅ 章节优化完成:", optimizedChapters.length, "/", currentOutline.chapters.length);
    console.log("✅ 封面已生成:", generatedCoverUrl);
    
    // 关闭"正在优化"提示
    toast.dismiss('optimizing-content');
    
    // 显示完成提示
    toast.success('所有章节内容生成完成！');
    
    // 执行保存
    const saveNovelToDatabase = async () => {
      if (!currentUser) {
        toast.info("登录后可将作品保存到云端", {
          action: {
            label: "立即登录",
            onClick: () => setIsLoginDialogOpen(true),
          },
        });
        return;
      }
      
      try {
        console.log("📚 小说标题:", currentNovel.title);
        console.log("📝 小说简介:", currentNovel.description);
        console.log("🖼️ 封面图片:", generatedCoverUrl);
        console.log("📑 小说类型:", currentNovel.genre);
        
        // 创建小说记录
        const dbNovel = await createNovel({
          user_id: currentUser.id,
          novel_title: currentNovel.title,
          novel_content: currentNovel.description,
          novel_thumb: generatedCoverUrl,
          novel_type: currentNovel.genre, // 保存小说类型
        });
        
        setCurrentNovelId(dbNovel.id);
        console.log("✅ 小说基本信息已保存，数据库ID:", dbNovel.id);
        console.log("✅ 小说类型已保存:", dbNovel.novel_type);
        
        // 保存所有优化后的章节内容
        console.log("📖 准备保存章节内容...");
        console.log("   总章节数:", optimizedChapters.length);
        
        const chaptersToSave = optimizedChapters.map(ch => {
          console.log(`   - 第${ch.order}章: ${ch.title} (${ch.content.length}字)`);
          return {
            chapter_number: ch.order,
            title: ch.title,
            content: ch.content,
            optimized: true,
          };
        });
        
        // 保存章节简介到simple_context
        console.log("📝 准备保存章节简介...");
        const simpleContextToSave = currentOutline.chapters.map(ch => {
          console.log(`   - 第${ch.order}章简介: ${ch.summary.substring(0, 50)}...`);
          return {
            chapter_number: ch.order,
            title: ch.title,
            summary: ch.summary,
          };
        });
        
        await saveOptimizedChapters(dbNovel.id, chaptersToSave);
        console.log("✅ 所有优化后的章节内容已保存到数据库");
        
        // 保存章节简介
        const { updateNovelBasicInfo } = await import('@/db/api');
        await updateNovelBasicInfo(dbNovel.id, {
          simple_context: simpleContextToSave,
        });
        console.log("✅ 所有章节简介已保存到数据库");
        
        // 查询数据库验证保存结果
        console.log("========================================");
        console.log("🔍 [验证保存结果] 从数据库查询刚保存的内容");
        
        const { getNovelById } = await import('@/db/api');
        const savedNovel = await getNovelById(dbNovel.id);
        
        if (savedNovel) {
          console.log("✅ 查询成功！");
          console.log("📚 数据库中的小说标题:", savedNovel.novel_title);
          console.log("📝 数据库中的小说简介:", savedNovel.novel_content);
          console.log("🖼️ 数据库中的封面图片:", savedNovel.novel_thumb);
          console.log("📖 数据库中的章节数据:");
          
          if (savedNovel.chapters_data && Array.isArray(savedNovel.chapters_data)) {
            console.log(`   总章节数: ${savedNovel.chapters_data.length}`);
            savedNovel.chapters_data.forEach((ch: any) => {
              console.log(`   - 第${ch.chapter_number}章: ${ch.title} (${ch.content?.length || 0}字)`);
              if (ch.content) {
                console.log(`     内容预览: ${ch.content.substring(0, 100)}...`);
              } else {
                console.error(`     ❌ 警告：第${ch.chapter_number}章内容为空！`);
              }
            });
          } else {
            console.error("❌ 警告：数据库中没有章节数据！");
          }
        } else {
          console.error("❌ 查询失败：未找到刚保存的小说");
        }
        
        console.log("========================================");
        toast.success("小说已保存到云端！");
      } catch (error) {
        console.error("❌ 保存小说失败:", error);
        toast.error("保存小说失败，请稍后重试");
      }
    };
    
    saveNovelToDatabase();
  }, [optimizedChapters.length, isCoverGenerated, currentOutline, currentNovel, generatedCoverUrl, currentUser]);

  // 小说生成进度模拟
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    
    if (isGenerating) {
      setNovelGenerationProgress(0);
      progressInterval = setInterval(() => {
        setNovelGenerationProgress(prev => {
          if (prev >= 95) {
            return prev; // 保持在95%，等待实际完成
          }
          // 模拟渐进式进度增长，更快的增长速度
          const increment = Math.random() * 3 + 1; // 1-4%的随机增长
          return Math.min(prev + increment, 95);
        });
      }, 1000); // 每1000ms更新一次，移动更快
    } else {
      setNovelGenerationProgress(0);
    }

    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [isGenerating]);

  // 第一阶段：生成章节规划，完成后直接生成详细内容
  const handleNovelRequest = async (request: NovelRequest) => {
    // 检查用户登录
    if (!currentUser) {
      toast.error('请先登录');
      setIsLoginDialogOpen(true);
      return;
    }

    // 扣减码分
    const success = await deductCredits(currentUser.id, 'novel_creation', '小说创作');
    if (!success) {
      // 码分不足，useCredits hook 会显示提示
      return;
    }

    setWorkflowStep(1);
    setCurrentRequest(request);
    
    // 重置状态
    setOptimizedChapters([]);
    setIsCoverGenerated(false);
    setGeneratedCoverUrl('');
    setAllChaptersGenerated(false); // 重置章节生成完成标记
    
    generateNovelOutline(
      request,
      (content) => {
        // 实时更新内容
      },
      (outline) => {
        setNovelGenerationProgress(100);
        setCurrentOutline(outline);
        
        // 创建临时小说对象，包含章节标题但内容为空
        const tempNovel: Novel = {
          id: `novel-${Date.now()}`,
          title: outline.title,
          description: outline.description,
          genre: request.genre,
          style: request.style,
          chapters: outline.chapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            content: '', // 内容为空，等待生成
            order: ch.order,
            wordCount: 0,
            createdAt: new Date(),
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        // 立即跳转到预览页面
        setCurrentNovel(tempNovel);
        setWorkflowStep(2);
        setActiveTab('preview');
        
        // 显示小说生成完成提示
        toast.success('小说生成完成！');
        
        // 延迟一下，然后显示正在优化提示
        setTimeout(() => {
          toast.info('正在优化小说章节内容，请稍候...', {
            duration: Infinity, // 持续显示
            id: 'optimizing-content', // 设置ID以便后续关闭
          });
        }, 500);
        
        // 开始生成详细内容
        setGeneratingChapterIndex(0);
        setOptimizedChapters([]); // 清空之前的优化章节
        setIsChapterContentGenerating(true); // 标记章节内容正在生成
        setChapterGenerationStatuses(new Map()); // 清空章节生成状态
        
        generateDetailedChapters(
          request,
          outline,
          (chapterIndex, content) => {
            // 实时更新当前章节索引和内容
            setGeneratingChapterIndex(chapterIndex);
            
            // 实时更新章节内容
            setOptimizedChapters(prev => {
              const updated = [...prev];
              // 如果该章节已存在，更新内容；否则创建临时章节对象
              if (updated[chapterIndex]) {
                updated[chapterIndex] = {
                  ...updated[chapterIndex],
                  content: content,
                  wordCount: content.length
                };
              } else {
                // 创建临时章节对象（用于显示生成中的内容）
                const chapterOutline = outline.chapters[chapterIndex];
                updated[chapterIndex] = {
                  id: chapterOutline.id,
                  title: chapterOutline.title,
                  content: content,
                  order: chapterOutline.order,
                  wordCount: content.length,
                  createdAt: new Date(),
                };
              }
              return updated;
            });
            
            // 实时更新小说对象中的章节内容（关键！）
            setCurrentNovel(prev => {
              if (!prev) return prev;
              const updatedChapters = [...prev.chapters];
              const chapterOutline = outline.chapters[chapterIndex];
              
              // 查找对应的章节
              const index = updatedChapters.findIndex(ch => ch.id === chapterOutline.id);
              if (index !== -1) {
                // 更新现有章节的内容
                updatedChapters[index] = {
                  ...updatedChapters[index],
                  content: content,
                  wordCount: content.length
                };
              } else {
                // 如果章节不存在，创建新章节（理论上不应该发生）
                updatedChapters.push({
                  id: chapterOutline.id,
                  title: chapterOutline.title,
                  content: content,
                  order: chapterOutline.order,
                  wordCount: content.length,
                  createdAt: new Date(),
                });
              }
              
              return {
                ...prev,
                chapters: updatedChapters,
              };
            });
          },
          (chapter) => {
            // 单个章节生成完成
            setOptimizedChapters(prev => {
              const updated = [...prev];
              // 更新对应索引的章节（已在onUpdate中创建）
              const chapterIndex = chapter.order - 1;
              updated[chapterIndex] = chapter;
              
              console.log(`📝 第${chapter.order}章优化完成: ${chapter.title} (${chapter.content.length}字)`);
              
              // 计算已完成的章节数（非空章节）
              const completedCount = updated.filter(ch => ch && ch.content).length;
              console.log(`   进度: ${completedCount}/${outline.chapters.length}`);
              
              if (completedCount === outline.chapters.length) {
                console.log("✅ 所有章节优化完成！");
                console.log("🔓 解除选项卡和个人中心的禁用状态");
                setIsChapterContentGenerating(false); // 章节内容生成完成，解除禁用
                setAllChaptersGenerated(true); // 标记所有章节已生成完成
                setGeneratingChapterIndex(-1); // 重置生成索引
                
                // 关闭"正在优化"提示
                toast.dismiss('optimizing-content');
                toast.success('所有章节内容优化完成！');
                
                console.log("🔍 检查封面生成状态...");
                
                // 检查封面是否已生成
                setIsCoverGenerated(coverGenerated => {
                  if (coverGenerated) {
                    console.log("✅ 封面已生成，可以保存了！");
                    // 触发保存逻辑（通过 useEffect 监听）
                  } else {
                    console.log("⏳ 封面还未生成，等待封面生成完成...");
                  }
                  return coverGenerated;
                });
              } else {
                console.log(`   ⚠️ 还有 ${outline.chapters.length - completedCount} 章未完成，继续等待...`);
              }
              
              // 更新进度
              const progress = (completedCount / outline.chapters.length) * 100;
              setNovelGenerationProgress(progress);
              
              return updated;
            });
            
            // 实时更新小说对象中的章节内容
            setCurrentNovel(prev => {
              if (!prev) return prev;
              const updatedChapters = [...prev.chapters];
              const index = updatedChapters.findIndex(ch => ch.id === chapter.id);
              if (index !== -1) {
                updatedChapters[index] = chapter;
              }
              return {
                ...prev,
                chapters: updatedChapters,
              };
            });
          },
          (novel) => {
            // 封面生成完成
            console.log("🖼️ 封面生成完成");
            console.log("🖼️ 封面URL:", novel.coverImageUrl);
            
            setNovelGenerationProgress(100);
            setGeneratedCoverUrl(novel.coverImageUrl);
            setIsCoverGenerated(true); // 标记封面已生成
            
            // 更新封面生成状态为成功
            setCoverGenerationStatus({
              status: 'success',
              retryCount: 0
            });
            
            // 更新小说对象中的封面
            setCurrentNovel(prev => {
              if (!prev) return novel;
              return {
                ...prev,
                coverImageUrl: novel.coverImageUrl,
                updatedAt: new Date(),
              };
            });
            
            console.log("🔍 检查章节优化状态...");
            console.log("📊 当前optimizedChapters数量:", optimizedChapters.length);
            console.log("📊 应有章节数:", outline.chapters.length);
            
            // 检查章节是否已全部优化完成
            if (optimizedChapters.length === outline.chapters.length) {
              console.log("✅ 章节已全部优化完成，可以保存了！");
              // 触发保存逻辑（通过 useEffect 监听）
            } else {
              console.log("⏳ 章节还未全部优化完成，等待章节优化...");
            }
          },
          (error) => {
            console.error('章节内容生成失败:', error);
            
            // 关闭"正在优化"提示
            toast.dismiss('optimizing-content');
            
            toast.error('章节内容生成失败: ' + error.message);
            setWorkflowStep(0);
            setGeneratingChapterIndex(-1);
            setIsChapterContentGenerating(false); // 重置状态
          },
          () => {
            // 封面生成开始
            console.log("🎨 开始生成封面...");
            setIsCoverGenerating(true);
            setCoverGenerationStatus(prev => ({
              status: 'generating',
              retryCount: prev.retryCount
            }));
          },
          () => {
            // 封面生成完成
            console.log("🎨 封面生成流程结束");
            setIsCoverGenerating(false);
            
            // 检查封面是否真的生成成功
            if (!generatedCoverUrl) {
              console.warn("⚠️ 封面生成流程结束，但未获取到封面URL，标记为失败");
              setCoverGenerationStatus(prev => ({
                status: 'failed',
                retryCount: prev.retryCount,
                error: '封面生成失败，请重试'
              }));
            }
          },
          (info) => {
            // 章节生成状态更新
            console.log(`📊 第${info.chapterIndex + 1}章状态更新: ${info.status}, 重试次数: ${info.retryCount}`);
            setChapterGenerationStatuses(prev => {
              const newMap = new Map(prev);
              newMap.set(info.chapterIndex, {
                status: info.status,
                retryCount: info.retryCount,
                error: info.error
              });
              return newMap;
            });
          }
        );
      },
      (error) => {
        console.error('章节规划生成失败:', error);
        toast.error('章节规划生成失败: ' + error.message);
        setWorkflowStep(0);
      }
    );
  };

  const handleChapterSelect = (chapter: NovelChapter) => {
    setSelectedChapter(chapter);
  };

  // 重新生成章节
  const handleRetryChapter = async (chapterIndex: number) => {
    if (!currentOutline || !currentRequest || !currentNovel) {
      toast.error('缺少必要的生成信息');
      return;
    }

    const chapterOutline = currentOutline.chapters[chapterIndex];
    if (!chapterOutline) {
      toast.error('章节信息不存在');
      return;
    }

    console.log(`🔄 用户手动重新生成第${chapterIndex + 1}章: ${chapterOutline.title}`);
    
    toast.loading(`正在重新生成第${chapterIndex + 1}章...`, {
      id: `retry-chapter-${chapterIndex}`
    });

    try {
      // 获取之前已生成的章节
      const previousChapters = currentNovel.chapters.slice(0, chapterIndex);

      // 调用重新生成函数
      const newChapter = await retryChapterGeneration(
        chapterIndex,
        chapterOutline,
        currentRequest,
        currentOutline,
        previousChapters,
        (index, content) => {
          // 实时更新章节内容
          setCurrentNovel(prev => {
            if (!prev) return prev;
            const updatedChapters = [...prev.chapters];
            if (updatedChapters[index]) {
              updatedChapters[index] = {
                ...updatedChapters[index],
                content: content,
                wordCount: content.length
              };
            }
            return {
              ...prev,
              chapters: updatedChapters
            };
          });
        },
        (info) => {
          // 更新章节生成状态
          console.log(`📊 第${info.chapterIndex + 1}章状态更新: ${info.status}, 重试次数: ${info.retryCount}`);
          setChapterGenerationStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(info.chapterIndex, {
              status: info.status,
              retryCount: info.retryCount,
              error: info.error
            });
            return newMap;
          });
        }
      );

      // 更新章节内容
      setCurrentNovel(prev => {
        if (!prev) return prev;
        const updatedChapters = [...prev.chapters];
        updatedChapters[chapterIndex] = newChapter;
        return {
          ...prev,
          chapters: updatedChapters
        };
      });

      // 更新优化章节列表
      setOptimizedChapters(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(ch => ch.id === newChapter.id);
        if (existingIndex !== -1) {
          updated[existingIndex] = newChapter;
        } else {
          updated.push(newChapter);
        }
        return updated;
      });

      toast.dismiss(`retry-chapter-${chapterIndex}`);
      toast.success(`第${chapterIndex + 1}章重新生成成功！`);

      // 如果已登录，保存到数据库
      if (currentUser && currentNovelId) {
        try {
          await saveOptimizedChapters(currentNovelId, [{
            chapter_number: newChapter.order,
            title: newChapter.title,
            content: newChapter.content,
            optimized: true
          }]);
          console.log(`✅ 第${chapterIndex + 1}章已保存到数据库`);
        } catch (error) {
          console.error('保存章节失败:', error);
        }
      }
    } catch (error) {
      console.error(`第${chapterIndex + 1}章重新生成失败:`, error);
      toast.dismiss(`retry-chapter-${chapterIndex}`);
      toast.error(`第${chapterIndex + 1}章重新生成失败: ${(error as Error).message}`);
    }
  };

  // 重新生成封面
  const handleRetryCover = async () => {
    if (!currentNovel) {
      toast.error('缺少小说信息');
      return;
    }

    console.log(`🔄 用户手动重新生成封面: ${currentNovel.title}`);
    
    // 更新重试次数
    setCoverGenerationStatus(prev => ({
      status: 'generating',
      retryCount: prev.retryCount + 1
    }));
    
    toast.loading('正在重新生成封面...', {
      id: 'retry-cover'
    });

    try {
      const coverUrl = await retryCoverGeneration(
        currentNovel.title,
        currentNovel.genre,
        currentNovel.description,
        () => {
          console.log('🎨 封面重新生成开始');
        },
        (url) => {
          console.log('✅ 封面重新生成成功:', url);
          
          // 更新封面URL
          setGeneratedCoverUrl(url);
          setIsCoverGenerated(true);
          
          // 更新小说对象中的封面
          setCurrentNovel(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              coverImageUrl: url,
              updatedAt: new Date(),
            };
          });
          
          // 更新封面生成状态为成功
          setCoverGenerationStatus({
            status: 'success',
            retryCount: 0
          });
          
          toast.dismiss('retry-cover');
          toast.success('封面重新生成成功！');
          
          // 如果已登录，更新数据库中的封面
          if (currentUser && currentNovelId) {
            updateNovelBasicInfo(currentNovelId, {
              novel_thumb: url
            }).then(() => {
              console.log('✅ 封面已更新到数据库');
            }).catch(error => {
              console.error('更新封面失败:', error);
            });
          }
        },
        (error) => {
          console.error('❌ 封面重新生成失败:', error);
          
          setCoverGenerationStatus(prev => ({
            status: 'failed',
            retryCount: prev.retryCount,
            error: error.message
          }));
          
          toast.dismiss('retry-cover');
          toast.error(`封面重新生成失败: ${error.message}`);
        }
      );
    } catch (error) {
      console.error('封面重新生成失败:', error);
      
      setCoverGenerationStatus(prev => ({
        status: 'failed',
        retryCount: prev.retryCount,
        error: (error as Error).message
      }));
      
      toast.dismiss('retry-cover');
      toast.error(`封面重新生成失败: ${(error as Error).message}`);
    }
  };

  const handleCharacterGenerated = async (character: Character) => {
    setCharacters(prev => {
      const existing = prev.find(c => c.id === character.id);
      if (existing) {
        return prev.map(c => c.id === character.id ? character : c);
      }
      return [...prev, character];
    });
    toast.success(`角色 ${character.name} 生成完成！`);
    
    // 保存角色到数据库
    if (currentUser && currentNovelId) {
      try {
        console.log("========================================");
        console.log("💾 [保存角色到数据库] 开始");
        console.log("角色名称:", character.name);
        
        // 上传图片到Storage
        let storageImageUrl = character.imageUrl;
        if (character.imageUrl) {
          try {
            console.log("📤 上传角色图片到Storage...");
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const fileName = `${timestamp}_${randomStr}.png`;
            const filePath = `${currentNovelId}/characters/${fileName}`;
            
            storageImageUrl = await uploadImageToStorage(
              character.imageUrl,
              'character-images',
              filePath
            );
            console.log("✅ 角色图片上传成功:", storageImageUrl);
          } catch (uploadError) {
            console.error("❌ 上传角色图片失败，使用原始URL:", uploadError);
            // 如果上传失败，使用原始URL
          }
        }
        
        await saveCharacters(currentNovelId, [{
          id: character.id,
          name: character.name,
          description: character.description,
          image_url: storageImageUrl,
          traits: [], // Character类型没有traits字段，使用空数组
        }]);
        
        console.log("✅ 角色已保存");
        console.log("========================================");
      } catch (error) {
        console.error("保存角色失败:", error);
      }
    }
  };

  const handleCharactersUpdate = async (updatedCharacters: Character[]) => {
    setCharacters(updatedCharacters);
    
    // 批量保存角色到数据库
    if (currentUser && currentNovelId && updatedCharacters.length > 0) {
      try {
        console.log("========================================");
        console.log("💾 [批量保存角色到数据库] 开始");
        console.log("角色数量:", updatedCharacters.length);
        
        // 批量上传图片到Storage
        const charactersWithStorageUrls = await Promise.all(
          updatedCharacters.map(async (c) => {
            let storageImageUrl = c.imageUrl;
            if (c.imageUrl) {
              try {
                console.log(`📤 上传角色 ${c.name} 的图片到Storage...`);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const fileName = `${timestamp}_${randomStr}.png`;
                const filePath = `${currentNovelId}/characters/${fileName}`;
                
                storageImageUrl = await uploadImageToStorage(
                  c.imageUrl,
                  'character-images',
                  filePath
                );
                console.log(`✅ 角色 ${c.name} 图片上传成功`);
              } catch (uploadError) {
                console.error(`❌ 上传角色 ${c.name} 图片失败，使用原始URL:`, uploadError);
              }
            }
            
            return {
              id: c.id,
              name: c.name,
              description: c.description,
              image_url: storageImageUrl,
              traits: [],
            };
          })
        );
        
        await saveCharacters(currentNovelId, charactersWithStorageUrls);
        
        console.log("✅ 所有角色已保存");
        console.log("========================================");
      } catch (error) {
        console.error("批量保存角色失败:", error);
      }
    }
  };

  const handleComicGenerated = async (panels: ComicPanel[]) => {
    setComicPanels(prev => [...prev, ...panels]);
    toast.success(`生成了 ${panels.length} 个漫画分镜！`);
    
    // 保存分镜到数据库
    if (currentUser && currentNovelId && currentNovel) {
      try {
        console.log("========================================");
        console.log("💾 [保存分镜到数据库] 开始");
        console.log("分镜数量:", panels.length);
        
        // 批量上传图片到Storage
        const panelsWithStorageUrls = await Promise.all(
          panels.map(async (p) => {
            // 从chapterId找到对应的章节号
            const chapter = currentNovel.chapters.find(ch => ch.id === p.chapterId);
            const chapterNumber = chapter ? chapter.order : 1;
            
            let storageImageUrl = p.imageUrl;
            if (p.imageUrl) {
              try {
                console.log(`📤 上传分镜 ${p.order} 的图片到Storage...`);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const fileName = `${timestamp}_${randomStr}.png`;
                const filePath = `${currentNovelId}/panels/chapter_${chapterNumber}/${fileName}`;
                
                storageImageUrl = await uploadImageToStorage(
                  p.imageUrl,
                  'panel-images',
                  filePath
                );
                console.log(`✅ 分镜 ${p.order} 图片上传成功`);
              } catch (uploadError) {
                console.error(`❌ 上传分镜 ${p.order} 图片失败，使用原始URL:`, uploadError);
              }
            }
            
            return {
              id: p.id,
              chapter_number: chapterNumber,
              panel_number: p.order,
              description: p.description,
              image_url: storageImageUrl,
            };
          })
        );
        
        await savePanels(currentNovelId, panelsWithStorageUrls);
        
        console.log("✅ 分镜已保存");
        console.log("========================================");
      } catch (error) {
        console.error("保存分镜失败:", error);
      }
    }
  };

  const handleComicPanelsUpdate = async (updatedPanels: ComicPanel[]) => {
    setComicPanels(updatedPanels);
    
    // 批量保存分镜到数据库
    if (currentUser && currentNovelId && currentNovel && updatedPanels.length > 0) {
      try {
        console.log("========================================");
        console.log("💾 [批量保存分镜到数据库] 开始");
        console.log("分镜数量:", updatedPanels.length);
        
        // 批量上传图片到Storage
        const panelsWithStorageUrls = await Promise.all(
          updatedPanels.map(async (p) => {
            // 从chapterId找到对应的章节号
            const chapter = currentNovel.chapters.find(ch => ch.id === p.chapterId);
            const chapterNumber = chapter ? chapter.order : 1;
            
            let storageImageUrl = p.imageUrl;
            if (p.imageUrl) {
              try {
                console.log(`📤 上传分镜 ${p.order} 的图片到Storage...`);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const fileName = `${timestamp}_${randomStr}.png`;
                const filePath = `${currentNovelId}/panels/chapter_${chapterNumber}/${fileName}`;
                
                storageImageUrl = await uploadImageToStorage(
                  p.imageUrl,
                  'panel-images',
                  filePath
                );
                console.log(`✅ 分镜 ${p.order} 图片上传成功`);
              } catch (uploadError) {
                console.error(`❌ 上传分镜 ${p.order} 图片失败，使用原始URL:`, uploadError);
              }
            }
            
            return {
              id: p.id,
              chapter_number: chapterNumber,
              panel_number: p.order,
              description: p.description,
              image_url: storageImageUrl,
            };
          })
        );
        
        await savePanels(currentNovelId, panelsWithStorageUrls);
        
        console.log("✅ 所有分镜已保存");
        console.log("========================================");
      } catch (error) {
        console.error("批量保存分镜失败:", error);
      }
    }
  };

  const handleEnterReadingMode = (chapterIndex: number) => {
    setReadingChapterIndex(chapterIndex);
    setIsReadingMode(true);
  };

  const handleExitReadingMode = () => {
    setIsReadingMode(false);
  };

  const handleTabChange = (value: string) => {
    // 只在章节内容生成时禁止切换选项卡
    if (isChapterContentGenerating) {
      toast.warning('章节内容正在优化中，请等待完成后再切换选项卡', {
        description: '为避免内容生成失败，请耐心等待当前任务完成',
      });
      return;
    }
    setActiveTab(value);
    
    // 根据选项卡更新工作流程步骤（仅在小说已生成的情况下）
    if (currentNovel) {
      switch (value) {
        case 'character':
          setWorkflowStep(2); // 角色设计阶段
          break;
        case 'comic':
          setWorkflowStep(3); // 分镜制作阶段
          break;
        default:
          // 其他选项卡保持当前步骤
          break;
      }
    }
  };

  const handleComicGeneratingStatusChange = (isGenerating: boolean) => {
    setIsComicGenerating(isGenerating);
  };

  const handleCharacterGeneratingStatusChange = (isGenerating: boolean) => {
    setIsCharacterGenerating(isGenerating);
  };

  // 检查是否正在生成章节内容（不包括封面生成）
  const isGeneratingContent = () => {
    return isChapterContentGenerating;
  };

  // 处理进入个人中心
  const handleNavigateToProfile = () => {
    if (isChapterContentGenerating) {
      toast.warning('章节内容正在优化中，请等待完成后再进入个人中心', {
        description: '为避免内容生成失败，请耐心等待当前任务完成',
      });
      return;
    }
    navigate('/profile');
  };

  const handleSaveVersion = (version: ProjectVersion) => {
    // 保存到本地存储或服务器
    localStorage.setItem(`novel-version-${version.id}`, JSON.stringify(version));
    toast.success('项目版本保存成功！');
  };

  const handleLoadVersion = (version: ProjectVersion) => {
    setCurrentNovel(version.novel);
    setCharacters(version.characters);
    setComicPanels(version.comicPanels);
    setWorkflowStep(2);
    setActiveTab('preview');
    toast.success('项目版本加载成功！');
  };

  const handleExportProject = (format: 'pdf' | 'images' | 'zip') => {
    // 实现导出功能
    switch (format) {
      case 'pdf':
        // PDF导出功能已在NovelPreview组件中实现
        toast.info('请在小说预览页面使用PDF导出功能');
        break;
      case 'images':
        // 下载所有完成的漫画分镜
        const completedPanels = comicPanels.filter(p => p.imageUrl);
        if (completedPanels.length === 0) {
          toast.error('没有可导出的图片');
          return;
        }
        
        completedPanels.forEach((panel, index) => {
          setTimeout(() => {
            const link = document.createElement('a');
            link.href = panel.imageUrl!;
            link.download = `${currentNovel?.title || '小说'}-分镜-${panel.order}.png`;
            link.click();
          }, index * 500);
        });
        
        toast.success(`开始下载 ${completedPanels.length} 张图片`);
        break;
      case 'zip':
        toast.info('压缩包导出功能开发中...');
        break;
    }
  };

  const getWorkflowProgress = () => {
    switch (workflowStep) {
      case 0: return 0;
      case 1: return 33;
      case 2: return 66;
      case 3: return 100;
      default: return 0;
    }
  };

  const getWorkflowStepText = () => {
    switch (workflowStep) {
      case 0: return '准备开始';
      case 1: return '正在生成小说...';
      case 2: return '角色设计阶段';
      case 3: return '分镜制作阶段';
      default: return '准备开始';
    }
  };

  // 创建测试数据用于测试听书功能
  const createTestNovel = () => {
    const testNovel: Novel = {
      id: 'test-novel-1',
      title: '重生之都市修仙传说',
      description: '一个现代都市修仙的传奇故事，主角重生回到过去，凭借前世记忆在都市中修炼成仙。',
      genre: 'fantasy',
      style: 'serious',
      coverImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
      chapters: [
        {
          id: 'chapter-1',
          title: '重生归来',
          content: `第一章 重生归来

林轩猛然睁开双眼，熟悉的天花板映入眼帘。他愣愣地看着眼前的一切，心中涌起一阵难以置信的震撼。

"这里是...我的宿舍？"

他缓缓坐起身来，环顾四周。破旧的桌椅，泛黄的墙壁，还有那台老式的台式电脑，一切都是那么熟悉，仿佛时光倒流了十年。

林轩的手不由自主地颤抖起来。他记得，在前世，自己是在三十五岁那年死于一场车祸。而现在，他竟然重新回到了大学时代！

"难道...我真的重生了？"

他急忙跑到镜子前，看着镜中那张年轻的脸庞，心中的震撼更加强烈。这确实是二十五岁时的自己，那时的他还是一个普通的大学生，对修仙一无所知。

但是现在不同了。前世的他，在临死前的那一刻，意外获得了一本古老的修仙功法《太玄经》。虽然来不及修炼，但那些口诀和心法已经深深印在了他的脑海中。

"既然老天给了我重来一次的机会，这一世，我绝不会再平庸下去！"

林轩深吸一口气，开始回忆《太玄经》中的修炼方法。这部功法博大精深，分为九重境界，每一重都有着天壤之别的威力。

他盘腿坐在床上，按照功法中记载的方式开始调息。很快，他就感受到了一丝微弱的灵气在体内流转。虽然这股灵气极其微弱，但对于重生的林轩来说，这已经是一个绝佳的开始。

"果然有效！"林轩心中大喜，"看来这个世界确实存在灵气，只是普通人无法感知而已。"

就在这时，宿舍门被推开了，他的室友张伟走了进来。

"林轩，你怎么了？脸色这么奇怪？"张伟关切地问道。

林轩连忙收功，装作若无其事的样子："没什么，可能是昨晚没睡好。"

"那你要注意身体啊。对了，今天下午有专业课，你别忘了。"张伟提醒道。

"知道了，谢谢。"林轩点点头。

等张伟离开后，林轩重新开始修炼。他知道，修仙之路充满了危险和机遇，必须要尽快提升实力才行。

随着修炼的深入，林轩渐渐感受到了《太玄经》的奥妙。这部功法不仅能够吸收天地灵气，还能够淬炼身体，提升各项能力。

几个小时后，林轩睁开双眼，眼中闪过一丝精光。虽然只是初步入门，但他已经能够清晰地感受到体内灵气的存在。

"第一重境界：炼气期。"林轩喃喃自语，"按照功法记载，炼气期分为九个小境界，我现在应该是炼气一层。"

他站起身来，感受着身体的变化。力量、速度、反应能力都有了明显的提升，虽然幅度不大，但这只是一个开始。

"这一世，我要站在这个世界的巅峰！"林轩握紧拳头，眼中燃烧着熊熊的斗志。`,
          order: 1,
          wordCount: 1200,
          createdAt: new Date()
        },
        {
          id: 'chapter-2',
          title: '初露锋芒',
          content: `第二章 初露锋芒

下午的专业课上，林轩坐在教室后排，表面上在听讲，实际上却在暗中修炼《太玄经》。

经过上午的修炼，他已经初步掌握了在不被人发现的情况下吸收灵气的技巧。虽然效率不如专心修炼，但总比浪费时间要好。

"林轩同学，请你回答一下这个问题。"

突然，教授的声音传来，打断了林轩的修炼。他抬起头，发现所有人的目光都集中在自己身上。

这是一道关于高等数学的复杂题目，在前世，林轩的数学成绩并不好，经常被这种题目难住。但是现在，经过《太玄经》的淬炼，他的思维能力得到了显著提升。

林轩站起身来，仔细看了看黑板上的题目，脑海中迅速分析着解题思路。

"这道题可以用分部积分法来解决..."

他的回答清晰而准确，不仅解出了正确答案，还提供了两种不同的解题方法。教授满意地点了点头，其他同学也投来了惊讶的目光。

"很好，林轩同学的数学基础很扎实。"教授赞许道。

林轩淡然一笑，重新坐下。他知道，这只是修炼带来的好处之一。随着境界的提升，他的各项能力都会得到全面的增强。

下课后，林轩的室友李明走了过来。

"林轩，你今天怎么这么厉害？以前你最怕数学课了。"李明好奇地问道。

"最近在努力学习，可能有些进步吧。"林轩随口应付道。

"那你教教我呗，我的数学成绩一直不好。"李明请求道。

"没问题。"林轩爽快地答应了。

晚上，在宿舍里，林轩开始给李明辅导数学。令他惊讶的是，自己不仅能够轻松解出各种难题，还能够用简单易懂的方式向李明解释。

"哇，林轩，你讲得太好了！我终于明白这个知识点了。"李明兴奋地说道。

"多练习就好了。"林轩谦虚地说道。

实际上，他心中也很震撼。《太玄经》的效果比他想象的还要强大，不仅提升了身体素质，连智力和理解能力都得到了显著增强。

深夜，等室友们都睡着后，林轩开始了正式的修炼。他盘腿坐在床上，运转《太玄经》的心法，感受着天地灵气缓缓流入体内。

随着修炼的深入，他体内的灵气越来越充盈。突然，他感到一阵暖流涌遍全身，境界竟然有了突破的迹象。

"炼气二层！"

林轩心中大喜，连忙稳固境界。这个突破速度比他预想的要快得多，看来重生后的身体对灵气的亲和力更强。

就在这时，他突然感受到了一股奇异的波动。这股波动来自窗外，带着一种说不出的危险气息。

林轩悄悄走到窗边，向外望去。在月光的照耀下，他看到了一个黑影在校园中快速移动，速度快得惊人。

"那是什么？"林轩皱起眉头。

凭借着修炼者敏锐的感知，他能够感受到那个黑影身上散发出的强大气息。这绝对不是普通人能够拥有的力量。

"看来这个世界并不像表面上那么简单。"林轩心中暗想，"既然有修炼者存在，那么必然也有各种危险。我必须要尽快提升实力才行。"

他重新回到床上，更加专心地修炼起来。这一夜，他一直修炼到天亮，境界稳固在了炼气二层。

第二天早上，林轩精神饱满地起床。经过一夜的修炼，他不仅没有感到疲惫，反而更加精神奕奕。

"看来修炼确实能够代替睡眠。"他心中暗喜。

这意味着他可以有更多的时间用来修炼和学习，这对于他的发展来说是一个巨大的优势。

吃早餐的时候，林轩注意到食堂里有几个人的气息有些特殊。虽然很微弱，但他能够感受到他们体内有着淡淡的灵气波动。

"原来学校里也有其他的修炼者。"林轩心中了然。

看来这个世界的修炼者比他想象的要多，只是他们都隐藏得很好，普通人根本察觉不到。

"既然如此，我也要更加小心才行。"林轩暗自警惕。

他知道，修炼界的水很深，稍有不慎就可能招来杀身之祸。在实力不够强大之前，他必须要保持低调。`,
          order: 2,
          wordCount: 1350,
          createdAt: new Date()
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setCurrentNovel(testNovel);
    setWorkflowStep(2);
    setActiveTab('preview');
    toast.success('测试小说数据已加载，可以测试听书功能了！');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-orange-xl py-orange-lg">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          {/* 测试按钮 - 仅用于开发测试 */}
          <div className="mb-4">

          </div>

          {/* 移动端导航 - 仅在屏幕宽度小于460px时显示 */}
          <div className="max-[460px]:block min-[460px]:hidden mb-6">
            <div className="flex items-center justify-center gap-4">

            </div>
          </div>

          {/* 工作流程进度 - #FF5724 主题 */}
          <Card className="mx-auto mb-8 bg-white/90 backdrop-blur-sm shadow-xl border-[#F2E6E1] kawaii-card relative overflow-hidden">
            {/* 进度卡片装饰 */}
            <div className="absolute top-2 right-2 text-[#FF7A4D] animate-sparkle opacity-30">
              <ComicSparkle className="w-5 h-5" />
            </div>
            <div className="absolute bottom-2 left-2 text-[#FF8A5B] animate-bounce-gentle opacity-25">
              <CuteEmoji className="w-4 h-4" type="love" />
            </div>
            <div className="absolute top-1/2 right-1 text-[#FFCAB8] animate-pulse-soft opacity-20">
              <AnimeStar className="w-3 h-3" />
            </div>
            
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <ComicBubble className="w-4 h-4 text-[#FF5724]" text="✨" />
                  创作进度
                </span>
                <span className="text-sm text-gray-600 bg-gradient-to-r from-[#FF5724] to-[#E64A1F] bg-clip-text text-transparent font-semibold">
                  {getWorkflowStepText()}
                </span>
              </div>
              <Progress value={getWorkflowProgress()} className="h-3 bg-gradient-to-r from-[#FFCAB8] to-[#FF8A5B]" />
              <div className="flex justify-between mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <SakuraPetal className="w-3 h-3 text-[#FF5724]" />
                  需求输入
                </span>
                <span className="flex items-center gap-1">
                  <AnimeStar className="w-3 h-3 text-[#FF7A4D]" />
                  小说生成
                </span>
                <span className="flex items-center gap-1">
                  <CuteEmoji className="w-3 h-3 text-[#FF8A5B]" type="wink" />
                  角色设计
                </span>
                <span className="flex items-center gap-1">
                  <ComicSparkle className="w-3 h-3 text-[#E64A1F]" />
                  分镜制作
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <WorkflowRoadmap />

        {/* 主要内容区域 */}
        <div className="mt-16">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8 bg-gradient-to-r from-[#FBF5F3] via-[#F7EDE8] to-[#FFCAB8] backdrop-blur-sm shadow-xl border border-[#F2E6E1] rounded-xl p-2 relative overflow-hidden kawaii-card" style={{ height: '3.8rem' }}>
              {/* 选项卡装饰元素 - #FF5724 主题 */}
              <div className="absolute top-1 left-2 text-[#FF7A4D] animate-float opacity-25">
                <SakuraPetal className="w-4 h-4" />
              </div>
              <div className="absolute top-1 right-2 text-[#FF8A5B] animate-sparkle opacity-30">
                <AnimeStar className="w-4 h-4" />
              </div>
              <div className="absolute bottom-1 left-1/4 text-[#FFCAB8] animate-wiggle opacity-20">
                <ComicSparkle className="w-3 h-3" />
              </div>
              <div className="absolute bottom-1 right-1/4 text-[#E64A1F] animate-bounce-gentle opacity-25">
                <CuteEmoji className="w-4 h-4" type="love" />
              </div>
              <div className="absolute top-1/2 left-1/2 text-[#FF5724] animate-pulse-soft opacity-15">
                <JapaneseFan className="w-3 h-3" />
              </div>
              
              <TabsTrigger 
                value="create" 
                disabled={generatingChapterIndex >= 0 || isComicGenerating || isCharacterGenerating}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#FF5724] data-[state=active]:to-[#E64A1F] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:anime-glow transition-all duration-300 rounded-lg relative z-10"
              >
                <Sparkles className="h-4 w-4 max-[460px]:hidden" />
                创作
                {/* 选项卡装饰 */}
                <div className="absolute -top-1 -right-1 text-[#FFCAB8] animate-pulse-soft opacity-60">
                  <ComicSparkle className="w-2 h-2" />
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="preview" 
                disabled={!currentNovel || generatingChapterIndex >= 0 || isComicGenerating || isCharacterGenerating}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#FF7A4D] data-[state=active]:to-[#FF5724] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:anime-glow transition-all duration-300 rounded-lg relative z-10 hover:bg-[#F7EDE8]"
              >
                <BookOpen className="h-4 w-4 max-[460px]:hidden" />
                预览
                {currentNovel && <Badge variant="secondary" className="ml-1 bg-[#FFCAB8] text-[#7F2B12] max-[460px]:hidden">已生成</Badge>}
                {/* 选项卡装饰 */}
                <div className="absolute -top-1 -left-1 text-[#FF8A5B] animate-wiggle opacity-50">
                  <AnimeStar className="w-2 h-2" />
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="character" 
                disabled={!currentNovel || generatingChapterIndex >= 0 || isComicGenerating || isCharacterGenerating}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#FF8A5B] data-[state=active]:to-[#FF7A4D] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:anime-glow transition-all duration-300 rounded-lg relative z-10 hover:bg-[#FFCAB8]"
              >
                <UserIcon className="h-4 w-4 max-[460px]:hidden" />
                角色
                {isCharacterGenerating && (
                  <div className="flex items-center gap-1 max-[460px]:hidden">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#FF5724]"></div>
                    <span className="text-xs text-[#FF5724]">生成中</span>
                  </div>
                )}
                {!isCharacterGenerating && characters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-[#FFCAB8] text-[#7F2B12] max-[460px]:hidden">{characters.length}</Badge>
                )}
                {/* 选项卡装饰 */}
                <div className="absolute -bottom-1 -right-1 text-[#FF7A4D] animate-bounce-gentle opacity-50">
                  <CuteEmoji className="w-2 h-2" type="love" />
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="comic" 
                disabled={!currentNovel || generatingChapterIndex >= 0 || isCharacterGenerating}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#E64A1F] data-[state=active]:to-[#B3381A] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:anime-glow transition-all duration-300 rounded-lg relative z-10 hover:bg-[#F7EDE8]"
              >
                <Palette className="h-4 w-4 max-[460px]:hidden" />
                分镜
                {isComicGenerating && (
                  <div className="flex items-center gap-1 max-[460px]:hidden">
                    <div className="animate-spin rounded-full h-3 w-3 border-solid border-[0px] border-[#ffffff] bg-[#ffffffff] bg-none"></div>
                    <span className="text-xs text-[#ffffffff]">生成中</span>
                  </div>
                )}
                {!isComicGenerating && comicPanels.length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-[#FFCAB8] text-[#7F2B12] max-[460px]:hidden">{comicPanels.length}</Badge>
                )}
                {/* 选项卡装饰 */}
                <div className="absolute -top-1 -left-1 text-[#FF8A5B] animate-pulse-soft opacity-50">
                  <SakuraPetal className="w-2 h-2" />
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="manage" 
                disabled={generatingChapterIndex >= 0 || isComicGenerating || isCharacterGenerating}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#FF5724] data-[state=active]:to-[#FF7A4D] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:anime-glow transition-all duration-300 rounded-lg relative z-10"
              >
                <Settings className="h-4 w-4 max-[460px]:hidden" />
                管理
                {/* 选项卡装饰 */}
                <div className="absolute -bottom-1 -left-1 text-[#E64A1F] animate-wiggle opacity-50">
                  <ChineseSeal className="w-2 h-2" />
                </div>
              </TabsTrigger>
            </TabsList>

          {/* 创作需求页面 */}
          <TabsContent value="create" className="space-y-8 mt-8">
            <div className="mx-auto">
              <NovelRequestForm 
                onSubmit={handleNovelRequest}
                isGenerating={isGenerating}
                initialData={recreationInitialData}
                currentUser={currentUser}
              />
              
              {isGenerating && (
                <Card className="mt-8 bg-white/80 backdrop-blur-sm shadow-xl border-orange-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-700">
                      <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                      正在生成小说...
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-gray-600">
                        AI正在根据您的需求创作小说，请耐心等待...
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={stopGeneration}
                        className="border-orange-300 transition-all duration-300 text-[#ffffffff]"
                      >
                        停止生成
                      </Button>
                    </div>
                    <div className="relative pb-16"> {/* 增加底部padding为小女孩和对话框留出空间 */}
                      <Progress value={novelGenerationProgress} className="h-2" />
                      {/* 小女孩表情包和对话框 */}
                      <div 
                        className="absolute top-4 flex items-center transition-all duration-500 ease-out"
                        style={{ 
                          left: `calc(${Math.max(5, Math.min(novelGenerationProgress, 85))}% - 20px)` 
                        }}
                      >
                        {/* 小女孩表情包 */}
                        <img 
                          src="https://miaoda-site-img.cdn.bcebos.com/89081664-4bfe-4123-b7d8-04ae9f256a2d/images/4eba2774-a7ee-11f0-8500-dacf15c4e777_0.jpg"
                          alt="哈基米"
                          className="animate-bounce"
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '999px',
                            objectFit: 'cover'
                          }}
                        />
                        {/* 对话框 */}
                        <div className="ml-2 relative">
                          <div className="bg-white border-2 border-pink-300 rounded-lg px-3 py-1 shadow-lg relative backdrop-blur-sm">
                            <span className="text-sm text-pink-600 font-medium whitespace-nowrap">
                              哈基米正在加油...
                            </span>
                            {/* 对话框箭头 */}
                            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2">
                              <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-pink-300"></div>
                              <div className="absolute w-0 h-0 border-t-3 border-b-3 border-r-3 border-transparent border-r-white left-0.5 top-1/2 transform -translate-y-1/2"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 小说预览页面 */}
          <TabsContent value="preview" className="space-y-8 mt-8">
            {currentNovel && (
              <NovelPreview
                novel={currentNovel}
                currentContent={currentContent}
                isGenerating={isGenerating}
                allChaptersGenerated={allChaptersGenerated}
                chapterStatuses={chapterGenerationStatuses}
                coverStatus={coverGenerationStatus}
                isCoverGenerating={isCoverGenerating}
                onSelectChapter={handleChapterSelect}
                onGenerateCharacter={() => handleTabChange('character')}
                onGenerateComic={() => handleTabChange('comic')}
                onExport={() => handleExportProject('pdf')}
                onRetryChapter={handleRetryChapter}
                onRetryCover={handleRetryCover}
              />
            )}
          </TabsContent>

          {/* 角色生成页面 */}
          <TabsContent value="character" className="space-y-8 mt-8">
            <CharacterGenerator
              characters={characters}
              onCharacterGenerated={handleCharacterGenerated}
              onCharactersUpdate={handleCharactersUpdate}
              onGeneratingStatusChange={handleCharacterGeneratingStatusChange}
              chapters={currentNovel?.chapters || []}
              userId={currentUser?.id}
              membershipLevel={currentUser?.membership_level}
              novelId={currentNovelId}
            />
          </TabsContent>

          {/* 漫画分镜页面 */}
          <TabsContent value="comic" className="space-y-8 mt-8">
            {currentNovel && (
              <ComicGenerator
                novel={currentNovel}
                selectedChapter={selectedChapter}
                comicPanels={comicPanels}
                onComicGenerated={handleComicGenerated}
                onComicPanelsUpdate={handleComicPanelsUpdate}
                onEnterReadingMode={handleEnterReadingMode}
                onGeneratingStatusChange={handleComicGeneratingStatusChange}
                userId={currentUser?.id}
              />
            )}
          </TabsContent>

          {/* 项目统计页面 */}
          <TabsContent value="manage" className="space-y-8 mt-8">
            <ProjectManager
              currentProject={{
                novel: currentNovel,
                characters,
                comicPanels,
              }}
              onSaveVersion={handleSaveVersion}
              onLoadVersion={handleLoadVersion}
              onExportProject={handleExportProject}
            />
          </TabsContent>
        </Tabs>
        </div>

        {/* 功能特色展示 */}
        {!currentNovel && activeTab === 'create' && (
          <div className="mt-20 mb-16">
            <h2 className="text-2xl font-tomato-title font-bold text-center mb-10 text-tomato-text">平台特色功能</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {/* 小说创作 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <BookOpen className="h-12 w-12 mx-auto mb-6 text-tomato-primary" />
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">小说创作</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">
                    支持多题材小说智能生成，包含爆款标题和类型识别，情节丰富，人物鲜明
                  </p>
                </CardContent>
              </Card>
              
              {/* 角色生成与漫画制作 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="flex justify-center items-center gap-2 mb-6">

                    <Image className="h-10 w-10 text-tomato-primary" />
                  </div>
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">漫画制作</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">支持AI绘画生成角色形象，自动转化为漫画风格分镜图片</p>
                </CardContent>
              </Card>
              
              {/* 一心做剧本 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <FileText className="h-12 w-12 mx-auto mb-6 text-[#FF5724]" />
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">一心做剧本</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">
                    根据小说章节内容生成标准格式剧本，支持剧本编辑和修改
                  </p>
                  <Link to="/script">

                  </Link>
                </CardContent>
              </Card>

              {/* 一心准备 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <Settings className="h-12 w-12 mx-auto mb-6 text-[#FF5724]" />
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">一心准备</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">
                    服化道、布景与造型逻辑分析，一键生成参考图
                  </p>
                  <Link to="/preparation">

                  </Link>
                </CardContent>
              </Card>
              
              {/* 一心拍戏 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <Film className="h-12 w-12 mx-auto mb-6 text-[#FF5724]" />
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">一心拍戏</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">{"基于剧本进行六个方面的专业拍戏分析，生成短视频和解说"}</p>
                  <Link to="/filming">

                  </Link>
                </CardContent>
              </Card>
              
              {/* 平行世界 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <Wand2 className="h-12 w-12 mx-auto mb-6" style={{ color: '#FF5724' }} />
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">平行世界</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">
                    支持基于任意章节的平行世界二创续写，创造全新的故事发展方向
                  </p>
                  <Link to="/parallel">

                  </Link>
                </CardContent>
              </Card>
              
              {/* 社区广场 */}
              <Card className="text-center card-tomato hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <Users className="h-12 w-12 mx-auto mb-6 text-tomato-primary" />
                  <h3 className="text-lg font-tomato-title font-semibold mb-4 text-tomato-text">社区广场</h3>
                  <p className="text-sm text-tomato-text-light leading-tomato">提供互动交流平台，支持帖子发布、小说分享、签到码分、评论等</p>
                  <Link to="/community">

                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      {/* 阅读模式 */}
      {isReadingMode && currentNovel && (
        <ReadingMode
          novel={currentNovel}
          comicPanels={comicPanels}
          initialChapterIndex={readingChapterIndex}
          onClose={handleExitReadingMode}
        />
      )}
      {/* 封面生成弹窗 */}
      <Dialog open={isCoverGenerating} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">
              正在生成小说封面
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            <p className="text-center text-gray-600">
              正在生成小说封面，请稍后...
            </p>

          </div>
        </DialogContent>
      </Dialog>
      {/* 登录对话框 */}
      <LoginDialog
        open={isLoginDialogOpen}
        onOpenChange={setIsLoginDialogOpen}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default NovelCreationPage;
