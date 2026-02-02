import { supabase } from "./supabase";
import type { 
  DbUser, 
  DbNovel, 
  CreateNovelInput, 
  UpdateNovelInput, 
  ChapterData, 
  CharacterData, 
  PanelData, 
  ScriptData,
  CreditTransaction,
  FeaturePrice,
  DeductCreditsResult,
  GrantCreditsResult,
  UpgradeMembershipResult,
  MembershipLevel,
  SystemSetting,
  SystemSettingKey,
  RechargePackage,
  RechargeResult,
  UpgradeMembershipNextMonthResult,
  ApplyPendingMembershipResult,
  PromotionSettings,
  MembershipPackage
} from "@/types/database";
import { handleUserRegistration } from "./invite-api";

// ==================== 认证相关 ====================

const buildNickname = (email?: string | null, fallback?: string | null) => {
  if (email) {
    return email.split("@")[0].slice(0, 12) || "新用户";
  }
  if (fallback) {
    return `用户${fallback.slice(-4)}`;
  }
  return `用户${Date.now().toString().slice(-4)}`;
};

const ensureUserProfile = async (
  user: { id: string; email?: string | null; phone?: string | null },
  inviteCode?: string,
  allowRewards: boolean = true
) => {
  console.log("🔍 [检查用户] 开始查询users表，用户ID:", user.id);
  const { data: existingUser, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  console.log("🔍 [检查用户] 查询完成");

  if (userError) {
    console.error("❌ [检查用户] 查询失败:", userError);
    return;
  }

  const email = user.email ?? null;
  const phone = user.phone ?? null;

  if (!existingUser) {
    console.log("➕ [创建用户] 用户不存在，开始创建新用户记录");
    const { error: insertError } = await supabase
      .from("users")
      .insert({
        id: user.id,
        email,
        phone,
        nickname: buildNickname(email, phone),
      });

    console.log("➕ [创建用户] 插入操作完成");

    if (insertError) {
      console.error("❌ [创建用户] 失败:", insertError);
      return;
    }

    console.log("✅ [创建用户] 成功");

    if (allowRewards) {
      console.log("🎁 [注册奖励] 开始处理注册奖励和邀请奖励");
      try {
        await handleUserRegistration(user.id, inviteCode);
        console.log("✅ [注册奖励] 处理完成");
      } catch (rewardError) {
        console.error("❌ [注册奖励] 处理失败:", rewardError);
      }
    }
    return;
  }

  if (!existingUser.email && email) {
    console.log("✏️ [检查用户] 补充邮箱信息");
    await supabase.from("users").update({ email }).eq("id", user.id);
  }

  if (allowRewards) {
    try {
      await handleUserRegistration(user.id, inviteCode);
    } catch (rewardError) {
      console.error("❌ [注册奖励] 处理失败:", rewardError);
    }
  }
};

/**
 * 邮箱注册
 */
export async function registerWithEmail(email: string, password: string, inviteCode?: string) {
  console.log("========================================");
  console.log("📧 [邮箱注册] 开始");
  console.log("邮箱:", email);
  console.log("邀请码:", inviteCode || "无");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("❌ [邮箱注册] 失败:", error);
      throw error;
    }

    console.log("✅ [邮箱注册] 成功");
    console.log("用户信息:", data.user);
    console.log("会话信息:", data.session);

    if (data.user) {
      const allowRewards = Boolean(data.session);
      await ensureUserProfile(data.user, inviteCode, allowRewards);
    }

    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [邮箱注册] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 邮箱登录
 */
export async function loginWithEmail(email: string, password: string) {
  console.log("========================================");
  console.log("🔐 [邮箱登录] 开始");
  console.log("邮箱:", email);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ [邮箱登录] 失败:", error);
      throw error;
    }

    console.log("✅ [邮箱登录] 成功");
    console.log("用户信息:", data.user);
    console.log("会话信息:", data.session);

    if (data.user) {
      await ensureUserProfile(data.user, undefined, true);
    }

    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [邮箱登录] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 退出登录
 */
export async function signOut() {
  console.log("========================================");
  console.log("👋 [退出登录] 开始");
  
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("❌ [退出登录] 失败:", error);
      throw error;
    }
    
    console.log("✅ [退出登录] 成功");
    console.log("========================================");
  } catch (error) {
    console.error("❌ [退出登录] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  console.log("========================================");
  console.log("👤 [获取当前用户] 开始");
  
  try {
    // 直接尝试获取用户信息，不先检查session
    // 因为getSession可能很慢，而getUser会自动检查session
    console.log("🔍 [获取当前用户] 准备调用getUser...");
    
    const userTimeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn("⚠️ [获取当前用户] getUser超时（10秒），返回null");
        resolve(null);
      }, 10000); // 10秒超时
    });
    
    const userPromise = supabase.auth.getUser().then(result => {
      console.log("🔍 [获取当前用户] getUser响应完成");
      return result;
    });
    
    const userResult = await Promise.race([userPromise, userTimeoutPromise]);
    
    // 如果超时，返回null
    if (userResult === null) {
      console.log("ℹ️ [获取当前用户] getUser超时，返回null");
      console.log("========================================");
      return null;
    }
    
    const { data: { user }, error } = userResult;
    
    if (error) {
      console.error("❌ [获取当前用户] 失败:", error);
      // 如果是AuthSessionMissingError，返回null而不是抛出错误
      if (error.message?.includes('Auth session missing')) {
        console.log("ℹ️ [获取当前用户] 会话丢失，返回null");
        console.log("========================================");
        return null;
      }
      throw error;
    }
    
    if (!user) {
      console.log("ℹ️ [获取当前用户] 没有用户，返回null");
      console.log("========================================");
      return null;
    }
    
    console.log("✅ [获取当前用户] 成功");
    console.log("用户ID:", user?.id);
    console.log("用户邮箱:", user?.email || user?.phone);
    console.log("========================================");
    return user;
  } catch (error) {
    // 如果是AbortError，不输出错误日志，直接抛出
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("⚠️ [获取当前用户] 请求被取消");
      console.log("========================================");
      throw error;
    }
    
    // 如果是AuthSessionMissingError，返回null而不是抛出错误
    if (error instanceof Error && error.message?.includes('Auth session missing')) {
      console.log("ℹ️ [获取当前用户] 会话丢失，返回null");
      console.log("========================================");
      return null;
    }
    
    console.error("❌ [获取当前用户] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

// ==================== 用户信息相关 ====================

/**
 * 获取用户信息
 */
export async function getUserProfile(userId: string): Promise<DbUser | null> {
  console.log("========================================");
  console.log("📋 [获取用户信息] 开始");
  console.log("用户ID:", userId);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error("❌ [获取用户信息] 失败:", error);
      throw error;
    }

    console.log("✅ [获取用户信息] 成功");
    console.log("用户数据:", data);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [获取用户信息] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 更新用户信息
 */
export async function updateUserProfile(userId: string, updates: Partial<DbUser>) {
  console.log("========================================");
  console.log("✏️ [更新用户信息] 开始");
  console.log("用户ID:", userId);
  console.log("更新内容:", updates);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error("❌ [更新用户信息] 失败:", error);
      throw error;
    }

    console.log("✅ [更新用户信息] 成功");
    console.log("更新后的数据:", data);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [更新用户信息] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

// ==================== 小说相关 ====================

/**
 * 创建小说
 */
export async function createNovel(input: CreateNovelInput): Promise<DbNovel> {
  console.log("========================================");
  console.log("📚 [创建小说] 开始");
  console.log("输入数据:", input);
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .insert({
        user_id: input.user_id,
        novel_title: input.novel_title,
        novel_content: input.novel_content || null,
        novel_thumb: input.novel_thumb || null,
        novel_type: input.novel_type || null,
      })
      .select()
      .single();

    if (error) {
      console.error("❌ [创建小说] 失败:", error);
      throw error;
    }

    console.log("✅ [创建小说] 成功");
    console.log("小说ID:", data.id);
    console.log("小说标题:", data.novel_title);
    console.log("小说类型:", data.novel_type);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [创建小说] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 更新小说基本信息（标题、简介、封面、类型、章节简介）
 */
export async function updateNovelBasicInfo(novelId: string, updates: { 
  novel_title?: string; 
  novel_content?: string; 
  novel_thumb?: string; 
  novel_type?: string;
  simple_context?: Array<{ chapter_number: number; title: string; summary: string }>;
}) {
  console.log("========================================");
  console.log("📝 [更新小说基本信息] 开始");
  console.log("小说ID:", novelId);
  console.log("更新内容:", updates);
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .update(updates)
      .eq('id', novelId)
      .select()
      .single();

    if (error) {
      console.error("❌ [更新小说基本信息] 失败:", error);
      throw error;
    }

    console.log("✅ [更新小说基本信息] 成功");
    console.log("更新后的数据:", data);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [更新小说基本信息] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 保存优化后的章节内容（重要：只保存优化后的内容）
 */
export async function saveOptimizedChapters(novelId: string, chapters: ChapterData[]) {
  console.log("========================================");
  console.log("📖 [保存优化后章节] 开始");
  console.log("小说ID:", novelId);
  console.log("章节数量:", chapters.length);
  
  // 过滤出已优化的章节
  const optimizedChapters = chapters.filter(ch => ch.optimized === true);
  console.log("✅ 已优化章节数量:", optimizedChapters.length);
  console.log("❌ 未优化章节数量:", chapters.length - optimizedChapters.length);
  
  if (optimizedChapters.length === 0) {
    console.warn("⚠️ [保存优化后章节] 没有已优化的章节，跳过保存");
    console.log("========================================");
    return null;
  }
  
  try {
    // 获取现有章节数据
    const { data: existingNovel, error: fetchError } = await supabase
      .from('novels')
      .select('chapters_data')
      .eq('id', novelId)
      .single();

    if (fetchError) {
      console.error("❌ [保存优化后章节] 获取现有数据失败:", fetchError);
      throw fetchError;
    }

    console.log("📚 现有章节数据:", existingNovel?.chapters_data);

    // 合并章节数据（保留旧的，更新新的）
    const existingChapters = (existingNovel?.chapters_data as ChapterData[]) || [];
    const mergedChapters = [...existingChapters];
    
    optimizedChapters.forEach(newChapter => {
      const existingIndex = mergedChapters.findIndex(ch => ch.chapter_number === newChapter.chapter_number);
      if (existingIndex >= 0) {
        console.log(`🔄 更新章节 ${newChapter.chapter_number}: ${newChapter.title}`);
        mergedChapters[existingIndex] = newChapter;
      } else {
        console.log(`➕ 新增章节 ${newChapter.chapter_number}: ${newChapter.title}`);
        mergedChapters.push(newChapter);
      }
    });

    // 按章节号排序
    mergedChapters.sort((a, b) => a.chapter_number - b.chapter_number);
    
    console.log("💾 准备保存的章节数据:", mergedChapters.map(ch => ({
      chapter_number: ch.chapter_number,
      title: ch.title,
      content_length: ch.content.length,
      optimized: ch.optimized
    })));

    const { data, error } = await supabase
      .from('novels')
      .update({ chapters_data: mergedChapters })
      .eq('id', novelId)
      .select()
      .single();

    if (error) {
      console.error("❌ [保存优化后章节] 失败:", error);
      throw error;
    }

    console.log("✅ [保存优化后章节] 成功");
    console.log("保存的章节总数:", mergedChapters.length);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [保存优化后章节] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 保存角色信息
 */
export async function saveCharacters(novelId: string, characters: CharacterData[]) {
  console.log("========================================");
  console.log("👥 [保存角色信息] 开始");
  console.log("小说ID:", novelId);
  console.log("角色数量:", characters.length);
  console.log("角色列表:", characters.map(ch => ({ name: ch.name, description: ch.description })));
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .update({ characters_data: characters })
      .eq('id', novelId)
      .select()
      .single();

    if (error) {
      console.error("❌ [保存角色信息] 失败:", error);
      throw error;
    }

    console.log("✅ [保存角色信息] 成功");
    console.log("保存的角色数量:", characters.length);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [保存角色信息] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 保存分镜信息
 */
export async function savePanels(novelId: string, panels: PanelData[]) {
  console.log("========================================");
  console.log("🎬 [保存分镜信息] 开始");
  console.log("小说ID:", novelId);
  console.log("分镜数量:", panels.length);
  console.log("分镜列表:", panels.map(p => ({ 
    chapter: p.chapter_number, 
    panel: p.panel_number, 
    description: p.description 
  })));
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .update({ panels_data: panels })
      .eq('id', novelId)
      .select()
      .single();

    if (error) {
      console.error("❌ [保存分镜信息] 失败:", error);
      throw error;
    }

    console.log("✅ [保存分镜信息] 成功");
    console.log("保存的分镜数量:", panels.length);
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [保存分镜信息] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 获取用户的所有小说
 */
export async function getUserNovels(userId: string): Promise<DbNovel[]> {
  console.log("========================================");
  console.log("📚 [获取用户小说列表] 开始");
  console.log("用户ID:", userId);
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("❌ [获取用户小说列表] 失败:", error);
      throw error;
    }

    console.log("✅ [获取用户小说列表] 成功");
    console.log("小说数量:", data?.length || 0);
    console.log("小说列表:", data?.map(n => ({ id: n.id, title: n.novel_title })));
    console.log("========================================");
    return data || [];
  } catch (error) {
    console.error("❌ [获取用户小说列表] 异常:", error);
    console.log("========================================");
    return [];
  }
}

/**
 * 获取小说详情
 */
export async function getNovelById(novelId: string): Promise<DbNovel | null> {
  console.log("========================================");
  console.log("📖 [获取小说详情] 开始");
  console.log("小说ID:", novelId);
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .select('*')
      .eq('id', novelId)
      .maybeSingle();

    if (error) {
      console.error("❌ [获取小说详情] 失败:", error);
      throw error;
    }

    console.log("✅ [获取小说详情] 成功");
    if (data) {
      console.log("小说标题:", data.novel_title);
      console.log("章节数量:", (data.chapters_data as ChapterData[])?.length || 0);
      console.log("角色数量:", (data.characters_data as CharacterData[])?.length || 0);
      console.log("分镜数量:", (data.panels_data as PanelData[])?.length || 0);
    }
    console.log("========================================");
    return data;
  } catch (error) {
    console.error("❌ [获取小说详情] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * 删除小说
 */
export async function deleteNovel(novelId: string) {
  console.log("========================================");
  console.log("🗑️ [删除小说] 开始");
  console.log("小说ID:", novelId);
  
  try {
    const { error } = await supabase
      .from('novels')
      .delete()
      .eq('id', novelId);

    if (error) {
      console.error("❌ [删除小说] 失败:", error);
      throw error;
    }

    console.log("✅ [删除小说] 成功");
    console.log("========================================");
  } catch (error) {
    console.error("❌ [删除小说] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

// ==================== 头像相关 ====================

/**
 * 压缩图片到指定大小
 */
async function compressImage(file: File, maxSizeMB = 1): Promise<File> {
  console.log("🔧 [压缩图片] 开始");
  console.log("原始文件大小:", (file.size / 1024 / 1024).toFixed(2), "MB");
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // 限制最大分辨率为1080p
        const maxDimension = 1080;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // 尝试不同的质量设置
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('压缩失败'));
                return;
              }
              
              const sizeMB = blob.size / 1024 / 1024;
              console.log(`尝试质量 ${quality}，大小: ${sizeMB.toFixed(2)} MB`);
              
              if (sizeMB <= maxSizeMB || quality <= 0.1) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });
                console.log("✅ [压缩图片] 完成，最终大小:", (compressedFile.size / 1024 / 1024).toFixed(2), "MB");
                resolve(compressedFile);
              } else {
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/webp',
            quality
          );
        };
        
        tryCompress();
      };
      img.onerror = () => reject(new Error('图片加载失败'));
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
  });
}

/**
 * 上传头像到Supabase Storage
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  console.log("========================================");
  console.log("📤 [上传头像] 开始");
  console.log("用户ID:", userId);
  console.log("文件名:", file.name);
  console.log("文件大小:", (file.size / 1024 / 1024).toFixed(2), "MB");
  console.log("文件类型:", file.type);
  
  try {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('不支持的文件格式，请上传 JPEG、PNG、GIF、WEBP 或 AVIF 格式的图片');
    }
    
    // 检查文件大小，如果超过1MB则压缩
    let uploadFile = file;
    if (file.size > 1024 * 1024) {
      console.log("⚠️ 文件超过1MB，开始压缩...");
      uploadFile = await compressImage(file);
    }
    
    // 生成文件名（仅包含英文字母和数字）
    const timestamp = Date.now();
    const ext = uploadFile.name.split('.').pop() || 'webp';
    const fileName = `${userId}/${timestamp}.${ext}`;
    
    console.log("📁 上传路径:", fileName);
    
    // 上传到Supabase Storage
    const { data, error } = await supabase.storage
      .from('app-6r71zzjmv5kx_avatars_images')
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) {
      console.error("❌ [上传头像] 失败:", error);
      throw error;
    }
    
    // 获取公开URL
    const { data: { publicUrl } } = supabase.storage
      .from('app-6r71zzjmv5kx_avatars_images')
      .getPublicUrl(fileName);
    
    console.log("✅ [上传头像] 成功");
    console.log("头像URL:", publicUrl);
    console.log("========================================");
    
    return publicUrl;
  } catch (error) {
    console.error("❌ [上传头像] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * AI生成头像 - 提交任务
 */
export async function generateAvatarAI(prompt: string): Promise<string> {
  console.log("========================================");
  console.log("🎨 [AI生成头像] 提交任务");
  console.log("提示词:", prompt);
  
  try {
    const appId = import.meta.env.VITE_APP_ID;
    const response = await fetch('/api/miaoda/runtime/apicenter/source/proxy/iragtextToImageiiVMkBQMEHfZ6rd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': appId,
      },
      body: JSON.stringify({
        prompt: `${prompt}，1:1`,
      }),
    });
    
    const result = await response.json();
    
    if (result.status !== 0) {
      console.error("❌ [AI生成头像] 提交失败:", result);
      if (result.status === 999) {
        throw new Error(result.msg || 'AI生成头像失败');
      }
      throw new Error(result.msg || 'AI生成头像失败');
    }
    
    const taskId = result.data.task_id;
    console.log("✅ [AI生成头像] 任务已提交");
    console.log("任务ID:", taskId);
    console.log("========================================");
    
    return taskId;
  } catch (error) {
    console.error("❌ [AI生成头像] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

/**
 * AI生成头像 - 查询结果
 */
export async function getAvatarGenerationResult(taskId: string): Promise<{ status: string; imageUrl?: string }> {
  console.log("========================================");
  console.log("🔍 [查询AI生成结果] 开始");
  console.log("任务ID:", taskId);
  
  try {
    const appId = import.meta.env.VITE_APP_ID;
    const response = await fetch('/api/miaoda/runtime/apicenter/source/proxy/iraggetImgjWUTzny87hoV6fSaYzr2Rj', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': appId,
      },
      body: JSON.stringify({
        task_id: taskId,
      }),
    });
    
    const result = await response.json();
    
    if (result.status !== 0) {
      console.error("❌ [查询AI生成结果] 失败:", result);
      if (result.status === 999) {
        throw new Error(result.msg || '查询失败');
      }
      throw new Error(result.msg || '查询失败');
    }
    
    const taskStatus = result.data.task_status;
    console.log("任务状态:", taskStatus);
    
    if (taskStatus === 'SUCCESS') {
      const imageUrl = result.data.sub_task_result_list?.[0]?.final_image_list?.[0]?.img_url;
      console.log("✅ [查询AI生成结果] 成功");
      console.log("图片URL:", imageUrl);
      console.log("========================================");
      return { status: 'SUCCESS', imageUrl };
    }
    
    if (taskStatus === 'FAILED') {
      console.error("❌ [查询AI生成结果] 任务失败");
      console.log("========================================");
      return { status: 'FAILED' };
    }
    
    console.log("⏳ [查询AI生成结果] 任务进行中...");
    console.log("========================================");
    return { status: taskStatus };
  } catch (error) {
    console.error("❌ [查询AI生成结果] 异常:", error);
    console.log("========================================");
    throw error;
  }
}

// 更新小说的剧本数据
export async function updateNovelScripts(novelId: string, scripts: ScriptData[]) {
  console.log('========================================');
  console.log('💾 [更新剧本数据] 开始');
  console.log('小说ID:', novelId);
  console.log('剧本数量:', scripts.length);
  
  try {
    // 先获取当前小说数据
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('scripts_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ [更新剧本数据] 获取小说失败:', fetchError);
      throw fetchError;
    }

    // 合并现有剧本和新剧本
    const existingScripts = (novel?.scripts_data as ScriptData[]) || [];
    console.log('现有剧本数量:', existingScripts.length);
    
    // 创建一个Map来存储剧本，以章节号为key
    const scriptsMap = new Map<number, ScriptData>();
    
    // 先添加现有剧本
    existingScripts.forEach(script => {
      scriptsMap.set(script.chapter_number, script);
    });
    
    // 用新剧本覆盖或添加
    scripts.forEach(script => {
      scriptsMap.set(script.chapter_number, script);
    });
    
    // 转换回数组并按章节号排序
    const mergedScripts = Array.from(scriptsMap.values()).sort(
      (a, b) => a.chapter_number - b.chapter_number
    );
    
    console.log('合并后剧本数量:', mergedScripts.length);
    
    // 更新数据库
    const { error: updateError } = await supabase
      .from('novels')
      .update({ 
        scripts_data: mergedScripts,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId);

    if (updateError) {
      console.error('❌ [更新剧本数据] 更新失败:', updateError);
      throw updateError;
    }

    console.log('✅ [更新剧本数据] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [更新剧本数据] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 更新小说数据（通用更新函数）
 */
export async function updateNovel(novelId: string, updates: UpdateNovelInput) {
  console.log('========================================');
  console.log('💾 [更新小说数据] 开始');
  console.log('小说ID:', novelId);
  console.log('更新字段:', Object.keys(updates));
  console.log('更新内容:', updates);
  
  try {
    const { data, error } = await supabase
      .from('novels')
      .update({ 
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId)
      .select('id, novel_thumb, updated_at')
      .single();

    if (error) {
      console.error('❌ [更新小说数据] 更新失败:', error);
      throw error;
    }

    console.log('✅ [更新小说数据] 成功');
    console.log('更新后的数据:', data);
    console.log('========================================');
    
    return data;
  } catch (error) {
    console.error('❌ [更新小说数据] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

// ==================== 小说购买相关 ====================

/**
 * 检查用户是否已购买小说
 */
export async function checkNovelPurchase(userId: string, novelId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('novel_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('novel_id', novelId)
      .maybeSingle();

    if (error) {
      console.error('检查购买记录失败:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('检查购买记录异常:', error);
    return false;
  }
}

// ==================== 剧本修改相关 ====================

/**
 * 修改单个章节的剧本内容
 */
export async function updateScriptContent(
  novelId: string, 
  chapterNumber: number, 
  newContent: string
) {
  console.log('========================================');
  console.log('✏️ [修改剧本内容] 开始');
  console.log('小说ID:', novelId);
  console.log('章节号:', chapterNumber);
  console.log('新内容长度:', newContent.length);
  
  try {
    // 获取当前小说的剧本数据
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('scripts_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ [修改剧本内容] 获取小说数据失败:', fetchError);
      throw fetchError;
    }

    if (!novel) {
      throw new Error('小说不存在');
    }

    // 更新剧本数据
    const scriptsData = novel.scripts_data || [];
    const scriptIndex = scriptsData.findIndex((s: ScriptData) => s.chapter_number === chapterNumber);

    if (scriptIndex === -1) {
      throw new Error(`章节 ${chapterNumber} 的剧本不存在`);
    }

    // 更新剧本内容
    scriptsData[scriptIndex] = {
      ...scriptsData[scriptIndex],
      script_content: newContent,
      updated_at: new Date().toISOString()
    };

    // 保存到数据库
    const { error: updateError } = await supabase
      .from('novels')
      .update({ 
        scripts_data: scriptsData,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId);

    if (updateError) {
      console.error('❌ [修改剧本内容] 更新失败:', updateError);
      throw updateError;
    }

    console.log('✅ [修改剧本内容] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [修改剧本内容] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

// ==================== 拍戏分析修改相关 ====================

/**
 * 修改服装分析内容
 */
export async function updateCostumeAnalysis(
  novelId: string,
  chapterNumber: number,
  itemIndex: number,
  updates: Partial<{
    character: string;
    description: string;
    material: string;
    color: string;
    style: string;
    purpose: string;
  }>
) {
  console.log('========================================');
  console.log('✏️ [修改服装分析] 开始');
  console.log('小说ID:', novelId);
  console.log('章节号:', chapterNumber);
  console.log('项目索引:', itemIndex);
  
  try {
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('costume_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!novel) throw new Error('小说不存在');

    const costumeData = novel.costume_data || [];
    const items = costumeData.filter((item: { chapter_number: number }) => item.chapter_number === chapterNumber);
    
    if (itemIndex >= items.length) {
      throw new Error('项目索引超出范围');
    }

    // 找到全局索引
    const globalIndex = costumeData.findIndex(
      (item: { chapter_number: number }, idx: number) => 
        item.chapter_number === chapterNumber && 
        costumeData.slice(0, idx + 1).filter((i: { chapter_number: number }) => i.chapter_number === chapterNumber).length === itemIndex + 1
    );

    // 更新数据
    costumeData[globalIndex] = {
      ...costumeData[globalIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('novels')
      .update({ 
        costume_data: costumeData,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId);

    if (updateError) throw updateError;

    console.log('✅ [修改服装分析] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [修改服装分析] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 修改化妆分析内容
 */
export async function updateMakeupAnalysis(
  novelId: string,
  chapterNumber: number,
  itemIndex: number,
  updates: Partial<{
    character: string;
    description: string;
    style: string;
    details: string;
  }>
) {
  console.log('========================================');
  console.log('✏️ [修改化妆分析] 开始');
  
  try {
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('makeup_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!novel) throw new Error('小说不存在');

    const makeupData = novel.makeup_data || [];
    const items = makeupData.filter((item: { chapter_number: number }) => item.chapter_number === chapterNumber);
    
    if (itemIndex >= items.length) {
      throw new Error('项目索引超出范围');
    }

    const globalIndex = makeupData.findIndex(
      (item: { chapter_number: number }, idx: number) => 
        item.chapter_number === chapterNumber && 
        makeupData.slice(0, idx + 1).filter((i: { chapter_number: number }) => i.chapter_number === chapterNumber).length === itemIndex + 1
    );

    makeupData[globalIndex] = {
      ...makeupData[globalIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('novels')
      .update({ 
        makeup_data: makeupData,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId);

    if (updateError) throw updateError;

    console.log('✅ [修改化妆分析] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [修改化妆分析] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 修改道具分析内容
 */
export async function updatePropsAnalysis(
  novelId: string,
  chapterNumber: number,
  itemIndex: number,
  updates: Partial<{
    name: string;
    description: string;
    function: string;
  }>
) {
  console.log('========================================');
  console.log('✏️ [修改道具分析] 开始');
  
  try {
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('props_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!novel) throw new Error('小说不存在');

    const propsData = novel.props_data || [];
    const items = propsData.filter((item: { chapter_number: number }) => item.chapter_number === chapterNumber);
    
    if (itemIndex >= items.length) {
      throw new Error('项目索引超出范围');
    }

    const globalIndex = propsData.findIndex(
      (item: { chapter_number: number }, idx: number) => 
        item.chapter_number === chapterNumber && 
        propsData.slice(0, idx + 1).filter((i: { chapter_number: number }) => i.chapter_number === chapterNumber).length === itemIndex + 1
    );

    propsData[globalIndex] = {
      ...propsData[globalIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('novels')
      .update({ 
        props_data: propsData,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId);

    if (updateError) throw updateError;

    console.log('✅ [修改道具分析] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [修改道具分析] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 修改布景分析内容
 */
export async function updateSceneAnalysis(
  novelId: string,
  chapterNumber: number,
  itemIndex: number,
  updates: Partial<{
    location: string;
    layout: string;
    decoration: string;
    atmosphere: string;
    lighting: string;
  }>
) {
  console.log('========================================');
  console.log('✏️ [修改布景分析] 开始');
  
  try {
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('scene_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!novel) throw new Error('小说不存在');

    const sceneData = novel.scene_data || [];
    const items = sceneData.filter((item: { chapter_number: number }) => item.chapter_number === chapterNumber);
    
    if (itemIndex >= items.length) {
      throw new Error('项目索引超出范围');
    }

    const globalIndex = sceneData.findIndex(
      (item: { chapter_number: number }, idx: number) => 
        item.chapter_number === chapterNumber && 
        sceneData.slice(0, idx + 1).filter((i: { chapter_number: number }) => i.chapter_number === chapterNumber).length === itemIndex + 1
    );

    sceneData[globalIndex] = {
      ...sceneData[globalIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('novels')
      .update({ 
        scene_data: sceneData,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelId);

    if (updateError) throw updateError;

    console.log('✅ [修改布景分析] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [修改布景分析] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 更新小说章节内容
 */
export async function updateNovelChapter(
  novelId: string,
  chapterIndex: number,
  title: string,
  content: string
) {
  console.log('========================================');
  console.log('📝 [更新章节] 开始');
  console.log('小说ID:', novelId);
  console.log('章节索引:', chapterIndex);
  console.log('章节标题:', title);
  console.log('内容长度:', content.length);

  try {
    // 获取当前小说数据
    const { data: novel, error: fetchError } = await supabase
      .from('novels')
      .select('chapters_data')
      .eq('id', novelId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ [更新章节] 获取小说失败:', fetchError);
      throw fetchError;
    }

    if (!novel) {
      console.error('❌ [更新章节] 小说不存在');
      throw new Error('小说不存在');
    }

    // 更新章节数据
    const chapters = novel.chapters_data || [];
    if (chapterIndex < 0 || chapterIndex >= chapters.length) {
      console.error('❌ [更新章节] 章节索引无效');
      throw new Error('章节索引无效');
    }

    chapters[chapterIndex] = {
      ...chapters[chapterIndex],
      title,
      content
    };

    // 保存到数据库
    const { error: updateError } = await supabase
      .from('novels')
      .update({ chapters_data: chapters })
      .eq('id', novelId);

    if (updateError) {
      console.error('❌ [更新章节] 保存失败:', updateError);
      throw updateError;
    }

    console.log('✅ [更新章节] 成功');
    console.log('========================================');
  } catch (error) {
    console.error('❌ [更新章节] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

// ==================== 会员系统相关 ====================

/**
 * 获取功能价格配置
 */
export async function getFeaturePrices(): Promise<FeaturePrice[]> {
  console.log('========================================');
  console.log('💰 [获取功能价格] 开始');

  try {
    const { data, error } = await supabase
      .from('feature_prices')
      .select('*')
      .eq('is_active', true)
      .order('feature_key', { ascending: true });

    if (error) {
      console.error('❌ [获取功能价格] 失败:', error);
      throw error;
    }

    console.log('✅ [获取功能价格] 成功，共', data?.length || 0, '条');
    console.log('========================================');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ [获取功能价格] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 根据功能键获取价格
 */
/**
 * 获取单个功能的价格
 * 优先从 system_settings 读取，如果没有则从 feature_prices 读取
 */
export async function getFeaturePrice(featureKey: string): Promise<number> {
  console.log('========================================');
  console.log('💰 [获取功能价格] 功能键:', featureKey);

  try {
    // 映射 feature_key 到 system_setting_key
    const settingKeyMap: Record<string, SystemSettingKey> = {
      'novel_creation': 'novel_generation_cost',
      'character_creation': 'character_generation_cost',
      'panel_creation': 'comic_generation_cost',
      'script_creation': 'script_generation_cost',
      'filming_analysis': 'filming_analysis_cost',
      'parallel_world': 'parallel_world_cost',
      'script_image_generation': 'script_image_generation_cost'
    };

    // 如果有对应的系统设置键，优先从系统设置读取
    const settingKey = settingKeyMap[featureKey];
    if (settingKey) {
      try {
        const costs = await getCreditCosts();
        const price = costs[settingKey];
        console.log('✅ [获取功能价格] 从系统设置获取，价格:', price);
        console.log('========================================');
        return price;
      } catch (error) {
        console.warn('⚠️ [获取功能价格] 从系统设置获取失败，回退到 feature_prices 表');
      }
    }

    // 回退到 feature_prices 表
    const { data, error } = await supabase
      .from('feature_prices')
      .select('price')
      .eq('feature_key', featureKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('❌ [获取功能价格] 失败:', error);
      throw error;
    }

    const price = data?.price || 0;
    console.log('✅ [获取功能价格] 从 feature_prices 表获取，价格:', price);
    console.log('========================================');
    return price;
  } catch (error) {
    console.error('❌ [获取功能价格] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 扣减用户码分
 */
export async function deductCredits(
  userId: string,
  featureKey: string,
  description?: string
): Promise<DeductCreditsResult> {
  console.log('========================================');
  console.log('💳 [扣减码分] 开始');
  console.log('用户ID:', userId);
  console.log('功能键:', featureKey);
  console.log('描述:', description);

  try {
    // 先获取功能价格
    const price = await getFeaturePrice(featureKey);
    
    if (price === 0) {
      console.log('✅ [扣减码分] 功能免费，无需扣减');
      console.log('========================================');
      return { success: true, balance: 0, deducted: 0 };
    }

    // 调用数据库函数扣减码分
    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_amount: price,
      p_description: description || null
    });

    if (error) {
      console.error('❌ [扣减码分] 失败:', error);
      throw error;
    }

    const result = data as DeductCreditsResult;
    
    if (!result.success) {
      console.error('❌ [扣减码分] 失败:', result.error);
      console.log('========================================');
      return result;
    }

    console.log('✅ [扣减码分] 成功');
    console.log('扣减数量:', result.deducted);
    console.log('剩余余额:', result.balance);
    console.log('========================================');
    return result;
  } catch (error) {
    console.error('❌ [扣减码分] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 按数量扣减码分（用于分镜生成、剧本图片生成等按张数计费的功能）
 */
export async function deductCreditsByQuantity(
  userId: string,
  featureKey: string,
  quantity: number,
  description?: string
): Promise<DeductCreditsResult> {
  console.log('========================================');
  console.log('💳 [按数量扣减码分] 开始');
  console.log('用户ID:', userId);
  console.log('功能键:', featureKey);
  console.log('数量:', quantity);
  console.log('描述:', description);

  try {
    // 先获取单价
    const unitPrice = await getFeaturePrice(featureKey);
    
    if (unitPrice === 0) {
      console.log('✅ [按数量扣减码分] 功能免费，无需扣减');
      console.log('========================================');
      return { success: true, balance: 0, deducted: 0 };
    }

    // 计算总价
    const totalAmount = unitPrice * quantity;
    console.log('单价:', unitPrice, '码分');
    console.log('总价:', totalAmount, '码分');

    // 调用数据库函数扣减码分
    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_amount: totalAmount,
      p_description: description || null
    });

    if (error) {
      console.error('❌ [按数量扣减码分] 失败:', error);
      throw error;
    }

    const result = data as DeductCreditsResult;
    
    if (!result.success) {
      console.error('❌ [按数量扣减码分] 失败:', result.error);
      console.log('========================================');
      return result;
    }

    console.log('✅ [按数量扣减码分] 成功');
    console.log('扣减数量:', result.deducted);
    console.log('剩余余额:', result.balance);
    console.log('========================================');
    return result;
  } catch (error) {
    console.error('❌ [按数量扣减码分] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 发放码分
 */
export async function grantCredits(
  userId: string,
  amount: number,
  description?: string
): Promise<GrantCreditsResult> {
  console.log('========================================');
  console.log('🎁 [发放码分] 开始');
  console.log('用户ID:', userId);
  console.log('数量:', amount);
  console.log('描述:', description);

  try {
    const { data, error } = await supabase.rpc('grant_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description || '系统发放'
    });

    if (error) {
      console.error('❌ [发放码分] 失败:', error);
      throw error;
    }

    const result = data as GrantCreditsResult;
    
    if (!result.success) {
      console.error('❌ [发放码分] 失败:', result.error);
      console.log('========================================');
      return result;
    }

    console.log('✅ [发放码分] 成功');
    console.log('发放数量:', result.granted);
    console.log('当前余额:', result.balance);
    console.log('========================================');
    return result;
  } catch (error) {
    console.error('❌ [发放码分] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 升级会员
 */
export async function upgradeMembership(
  userId: string,
  newLevel: MembershipLevel
): Promise<UpgradeMembershipResult> {
  console.log('========================================');
  console.log('⬆️ [升级会员] 开始');
  console.log('用户ID:', userId);
  console.log('新等级:', newLevel);

  try {
    const { data, error } = await supabase.rpc('upgrade_membership', {
      p_user_id: userId,
      p_new_level: newLevel
    });

    if (error) {
      console.error('❌ [升级会员] 失败:', error);
      throw error;
    }

    const result = data as UpgradeMembershipResult;
    
    if (!result.success) {
      console.error('❌ [升级会员] 失败:', result.error);
      console.log('========================================');
      return result;
    }

    console.log('✅ [升级会员] 成功');
    console.log('新等级:', result.new_level);
    console.log('发放码分:', result.granted);
    console.log('========================================');
    return result;
  } catch (error) {
    console.error('❌ [升级会员] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 检查并发放每月码分
 */
export async function checkAndGrantMonthlyCredits(userId: string): Promise<GrantCreditsResult> {
  console.log('========================================');
  console.log('📅 [检查每月码分] 开始');
  console.log('用户ID:', userId);

  try {
    const { data, error } = await supabase.rpc('check_and_grant_monthly_credits', {
      p_user_id: userId
    });

    if (error) {
      console.error('❌ [检查每月码分] 失败:', error);
      throw error;
    }

    const result = data as GrantCreditsResult;
    
    if (!result.success) {
      // 本月已发放不算错误
      if (result.error === '本月已发放') {
        console.log('ℹ️ [检查每月码分] 本月已发放');
      } else {
        console.error('❌ [检查每月码分] 失败:', result.error);
      }
      console.log('========================================');
      return result;
    }

    console.log('✅ [检查每月码分] 发放成功');
    console.log('发放数量:', result.granted);
    console.log('当前余额:', result.balance);
    console.log('========================================');
    return result;
  } catch (error) {
    console.error('❌ [检查每月码分] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

/**
 * 获取用户码分交易记录
 */
export async function getCreditTransactions(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  console.log('========================================');
  console.log('📊 [获取交易记录] 开始');
  console.log('用户ID:', userId);
  console.log('限制数量:', limit);

  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ [获取交易记录] 失败:', error);
      throw error;
    }

    console.log('✅ [获取交易记录] 成功，共', data?.length || 0, '条');
    console.log('========================================');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ [获取交易记录] 异常:', error);
    console.log('========================================');
    throw error;
  }
}

// ==================== 系统设置相关 ====================

/**
 * 获取所有系统设置
 */
export async function getAllSystemSettings(): Promise<SystemSetting[]> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      console.error('获取系统设置失败:', error);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('获取系统设置异常:', error);
    throw error;
  }
}

/**
 * 获取单个系统设置
 */
export async function getSystemSetting(key: SystemSettingKey): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.error(`获取系统设置 ${key} 失败:`, error);
      throw error;
    }

    return data?.value || null;
  } catch (error) {
    console.error(`获取系统设置 ${key} 异常:`, error);
    throw error;
  }
}

/**
 * 更新系统设置
 */
export async function updateSystemSetting(
  key: SystemSettingKey,
  value: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .update({
        value,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('key', key);

    if (error) {
      console.error(`更新系统设置 ${key} 失败:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`更新系统设置 ${key} 异常:`, error);
    throw error;
  }
}

/**
 * 批量更新系统设置
 */
export async function batchUpdateSystemSettings(
  settings: Array<{ key: SystemSettingKey; value: string }>,
  userId: string
): Promise<void> {
  try {
    const updates = settings.map(setting => 
      supabase
        .from('system_settings')
        .update({
          value: setting.value,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('key', setting.key)
    );

    const results = await Promise.all(updates);
    
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('批量更新系统设置失败:', errors);
      throw new Error('批量更新系统设置失败');
    }
  } catch (error) {
    console.error('批量更新系统设置异常:', error);
    throw error;
  }
}

/**
 * 获取积分消耗配置（带缓存）
 */
let creditCostCache: Record<SystemSettingKey, number> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

export async function getCreditCosts(): Promise<Record<SystemSettingKey, number>> {
  const now = Date.now();
  
  // 如果缓存有效，直接返回
  if (creditCostCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return creditCostCache;
  }

  try {
    const settings = await getAllSystemSettings();
    const costs: Record<string, number> = {};

    settings.forEach(setting => {
      if (
        setting.key === 'novel_generation_cost' ||
        setting.key === 'character_generation_cost' ||
        setting.key === 'comic_generation_cost' ||
        setting.key === 'script_generation_cost' ||
        setting.key === 'filming_analysis_cost' ||
        setting.key === 'parallel_world_cost' ||
        setting.key === 'script_image_generation_cost'
      ) {
        costs[setting.key] = parseInt(setting.value, 10) || 0;
      }
    });

    // 设置默认值
    creditCostCache = {
      novel_generation_cost: costs.novel_generation_cost || 10,
      character_generation_cost: costs.character_generation_cost || 1,
      comic_generation_cost: costs.comic_generation_cost || 10,
      script_generation_cost: costs.script_generation_cost || 1, // 每章节1码分
      filming_analysis_cost: costs.filming_analysis_cost || 1, // 每章节1码分
      parallel_world_cost: costs.parallel_world_cost || 8,
      script_image_generation_cost: costs.script_image_generation_cost || 1
    };

    cacheTimestamp = now;
    return creditCostCache;
  } catch (error) {
    console.error('获取积分消耗配置失败:', error);
    // 返回默认值
    return {
      novel_generation_cost: 10,
      character_generation_cost: 1,
      comic_generation_cost: 10,
      script_generation_cost: 1, // 每章节1码分
      filming_analysis_cost: 1, // 每章节1码分
      parallel_world_cost: 8,
      script_image_generation_cost: 1
    };
  }
}

/**
 * 清除积分消耗配置缓存
 */
export function clearCreditCostCache(): void {
  creditCostCache = null;
  cacheTimestamp = 0;
}

// ==================== 充值相关 ====================

/**
 * 获取所有充值套餐
 */
export async function getRechargePackages() {
  const { data, error } = await supabase
    .from('recharge_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取充值套餐失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 充值码分
 */
export async function rechargeCredits(
  userId: string,
  amountYuan: number
): Promise<import('@/types/database').RechargeResult> {
  const { data, error } = await supabase.rpc('recharge_credits', {
    p_user_id: userId,
    p_amount_yuan: amountYuan
  });

  if (error) {
    console.error('充值码分失败:', error);
    throw error;
  }

  return data as import('@/types/database').RechargeResult;
}

/**
 * 升级会员（次月生效）
 */
export async function upgradeMembershipNextMonth(
  userId: string,
  newLevel: MembershipLevel
): Promise<import('@/types/database').UpgradeMembershipNextMonthResult> {
  const { data, error } = await supabase.rpc('upgrade_membership_next_month', {
    p_user_id: userId,
    p_new_level: newLevel
  });

  if (error) {
    console.error('升级会员失败:', error);
    throw error;
  }

  return data as import('@/types/database').UpgradeMembershipNextMonthResult;
}

/**
 * 升级会员（立即生效）
 * 用于尝鲜版升级到付费会员
 */
export async function upgradeMembershipImmediately(
  userId: string,
  newLevel: MembershipLevel
): Promise<import('@/types/database').UpgradeMembershipImmediatelyResult> {
  const { data, error } = await supabase.rpc('upgrade_membership_immediately', {
    p_user_id: userId,
    p_new_level: newLevel
  });

  if (error) {
    console.error('立即升级会员失败:', error);
    throw error;
  }

  return data as import('@/types/database').UpgradeMembershipImmediatelyResult;
}


/**
 * 应用待生效的会员等级
 */
export async function applyPendingMembership(
  userId: string
): Promise<import('@/types/database').ApplyPendingMembershipResult> {
  const { data, error } = await supabase.rpc('apply_pending_membership', {
    p_user_id: userId
  });

  if (error) {
    console.error('应用待生效会员等级失败:', error);
    throw error;
  }

  return data as import('@/types/database').ApplyPendingMembershipResult;
}

/**
 * 取消待生效的会员等级
 */
export async function cancelPendingMembership(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      pending_membership_level: null,
      pending_membership_effective_date: null
    })
    .eq('id', userId);

  if (error) {
    console.error('取消待生效会员等级失败:', error);
    throw error;
  }
}

// ==================== 限免设置相关 ====================

/**
 * 获取限免设置
 */
export async function getPromotionSettings(): Promise<PromotionSettings | null> {
  const { data, error } = await supabase
    .from('promotion_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('获取限免设置失败:', error);
    throw error;
  }

  return data;
}

/**
 * 更新限免设置（仅管理员）
 */
export async function updatePromotionSettings(settings: {
  is_enabled: boolean;
  start_time: string | null;
  end_time: string | null;
  description?: string | null;
}): Promise<PromotionSettings> {
  // 先获取现有记录
  const existing = await getPromotionSettings();
  
  if (existing) {
    // 更新现有记录
    const { data, error } = await supabase
      .from('promotion_settings')
      .update(settings)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('更新限免设置失败:', error);
      throw error;
    }

    return data;
  } else {
    // 创建新记录
    const { data, error } = await supabase
      .from('promotion_settings')
      .insert(settings)
      .select()
      .single();

    if (error) {
      console.error('创建限免设置失败:', error);
      throw error;
    }

    return data;
  }
}

/**
 * 检查当前是否在限免期间
 */
export async function isPromotionActive(): Promise<boolean> {
  const settings = await getPromotionSettings();
  
  if (!settings || !settings.is_enabled) {
    return false;
  }

  if (!settings.start_time || !settings.end_time) {
    return false;
  }

  const now = new Date();
  const startTime = new Date(settings.start_time);
  const endTime = new Date(settings.end_time);

  return now >= startTime && now <= endTime;
}

/**
 * 检查用户是否有权限使用会员功能
 * @param userLevel 用户会员等级
 * @param requiredLevel 所需会员等级（默认为basic，即需要付费会员）
 * @returns 是否有权限
 */
export async function checkMembershipAccess(
  userLevel: MembershipLevel,
  requiredLevel: MembershipLevel = 'basic'
): Promise<boolean> {
  // 如果在限免期间，所有用户都可以使用
  const isPromotion = await isPromotionActive();
  if (isPromotion) {
    return true;
  }

  // 会员等级顺序
  const levelOrder: MembershipLevel[] = ['free', 'basic', 'intermediate', 'premium'];
  const userLevelIndex = levelOrder.indexOf(userLevel);
  const requiredLevelIndex = levelOrder.indexOf(requiredLevel);

  // 用户等级必须大于等于所需等级
  return userLevelIndex >= requiredLevelIndex;
}

// ==================== 会员套餐管理 ====================

/**
 * 获取所有会员套餐
 */
export async function getAllMembershipPackages() {
  const { data, error } = await supabase
    .from('membership_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取会员套餐失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 根据等级获取会员套餐
 */
export async function getMembershipPackageByLevel(level: MembershipLevel) {
  const { data, error } = await supabase
    .from('membership_packages')
    .select('*')
    .eq('level', level)
    .maybeSingle();

  if (error) {
    console.error('获取会员套餐失败:', error);
    throw error;
  }

  return data;
}

/**
 * 更新会员套餐
 */
export async function updateMembershipPackage(
  level: MembershipLevel,
  updates: {
    name?: string;
    monthly_credits?: number;
    color?: string;
    price?: number;
    original_price?: number;
    benefits?: string[];
    sort_order?: number;
  }
) {
  const { data, error } = await supabase
    .from('membership_packages')
    .update(updates)
    .eq('level', level)
    .select()
    .maybeSingle();

  if (error) {
    console.error('更新会员套餐失败:', error);
    throw error;
  }

  return data;
}

/**
 * 批量更新会员套餐
 */
export async function batchUpdateMembershipPackages(
  packages: Array<{
    level: MembershipLevel;
    name: string;
    monthly_credits: number;
    color: string;
    price: number;
    original_price: number;
    benefits: string[];
  }>
) {
  const promises = packages.map(pkg =>
    updateMembershipPackage(pkg.level, {
      name: pkg.name,
      monthly_credits: pkg.monthly_credits,
      color: pkg.color,
      price: pkg.price,
      original_price: pkg.original_price,
      benefits: pkg.benefits
    })
  );

  const results = await Promise.all(promises);
  return results;
}

// ==================== 拍戏场景相关 ====================

/**
 * 创建拍戏场景
 */
export async function createFilmingScene(sceneData: {
  novel_id: string;
  chapter_number: number;
  scene_name: string;
  scene_elements: unknown;
  prompt?: string;
}) {
  const { data, error } = await supabase
    .from('filming_scenes')
    .insert({
      novel_id: sceneData.novel_id,
      chapter_number: sceneData.chapter_number,
      scene_name: sceneData.scene_name,
      scene_elements: sceneData.scene_elements,
      prompt: sceneData.prompt
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建拍戏场景失败:', error);
    throw error;
  }

  return data;
}

/**
 * 获取小说的所有场景
 */
export async function getFilmingScenes(novelId: string) {
  const { data, error } = await supabase
    .from('filming_scenes')
    .select('*')
    .eq('novel_id', novelId)
    .order('chapter_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取拍戏场景失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 获取指定章节的场景
 */
export async function getChapterFilmingScenes(novelId: string, chapterNumber: number) {
  const { data, error } = await supabase
    .from('filming_scenes')
    .select('*')
    .eq('novel_id', novelId)
    .eq('chapter_number', chapterNumber)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取章节场景失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 更新场景
 */
export async function updateFilmingScene(sceneId: string, updates: {
  scene_name?: string;
  scene_elements?: unknown;
  prompt?: string;
  narration_text?: string;
  narration_audio_url?: string;
}) {
  const { data, error } = await supabase
    .from('filming_scenes')
    .update(updates)
    .eq('id', sceneId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('更新场景失败:', error);
    throw error;
  }

  return data;
}

/**
 * 批量更新场景解说
 */
export async function updateScenesNarration(updates: Array<{
  sceneId: string;
  narration_text: string;
}>) {
  console.log('📝 批量更新场景解说:', updates.length, '个场景');
  
  const promises = updates.map(({ sceneId, narration_text }) =>
    supabase
      .from('filming_scenes')
      .update({ narration_text })
      .eq('id', sceneId)
  );

  const results = await Promise.all(promises);
  
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('批量更新解说失败:', errors);
    throw new Error(`${errors.length}个场景更新失败`);
  }

  console.log('✅ 批量更新解说成功');
  return true;
}

/**
 * 更新场景配音网址
 */
export async function updateSceneNarrationAudio(sceneId: string, audioUrl: string | null) {
  console.log('🎵 更新场景配音:', sceneId, audioUrl ? '设置新URL' : '删除URL');
  
  const { data, error } = await supabase
    .from('filming_scenes')
    .update({ narration_audio_url: audioUrl })
    .eq('id', sceneId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('更新配音网址失败:', error);
    throw error;
  }

  console.log('✅ 更新配音网址成功');
  return data;
}

/**
 * 删除场景
 */
export async function deleteFilmingScene(sceneId: string) {
  const { error } = await supabase
    .from('filming_scenes')
    .delete()
    .eq('id', sceneId);

  if (error) {
    console.error('删除场景失败:', error);
    throw error;
  }
}

// ==================== 合成图片相关 ====================

/**
 * 创建合成图片记录
 */
export async function createCompositeImage(imageData: {
  scene_id: string;
  image_url: string;
  storage_path: string;
  prompt?: string;
}) {
  const { data, error } = await supabase
    .from('filming_composite_images')
    .insert({
      scene_id: imageData.scene_id,
      image_url: imageData.image_url,
      storage_path: imageData.storage_path,
      prompt: imageData.prompt
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建合成图片记录失败:', error);
    throw error;
  }

  return data;
}

/**
 * 获取场景的合成图片
 */
export async function getSceneCompositeImages(sceneId: string) {
  const { data, error } = await supabase
    .from('filming_composite_images')
    .select('*')
    .eq('scene_id', sceneId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取合成图片失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 批量更新合成图片的显示顺序
 */
export async function updateCompositeImagesOrder(updates: { id: string; display_order: number }[]) {
  try {
    // 使用Promise.all并发更新所有图片的顺序
    const promises = updates.map(({ id, display_order }) =>
      supabase
        .from('filming_composite_images')
        .update({ display_order })
        .eq('id', id)
    );

    const results = await Promise.all(promises);

    // 检查是否有错误
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('更新图片顺序失败:', errors);
      throw new Error('更新图片顺序失败');
    }

    console.log(`✅ 成功更新${updates.length}个图片的显示顺序`);
    return true;
  } catch (error) {
    console.error('批量更新图片顺序失败:', error);
    throw error;
  }
}

/**
 * 删除合成图片
 */
export async function deleteCompositeImage(imageId: string) {
  const { error } = await supabase
    .from('filming_composite_images')
    .delete()
    .eq('id', imageId);

  if (error) {
    console.error('删除合成图片失败:', error);
    throw error;
  }
}

// ==================== 视频相关 ====================

/**
 * 创建视频记录
 */
export async function createFilmingVideo(videoData: {
  composite_image_id: string;
  video_url: string;
  storage_path: string;
  duration?: number;
}) {
  const { data, error } = await supabase
    .from('filming_videos')
    .insert({
      composite_image_id: videoData.composite_image_id,
      video_url: videoData.video_url,
      storage_path: videoData.storage_path,
      duration: videoData.duration
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建视频记录失败:', error);
    throw error;
  }

  return data;
}

/**
 * 获取合成图片的视频
 */
export async function getCompositeImageVideos(compositeImageId: string) {
  const { data, error } = await supabase
    .from('filming_videos')
    .select('*')
    .eq('composite_image_id', compositeImageId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取视频失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 获取场景的所有视频
 */
export async function getSceneVideos(sceneId: string) {
  const { data, error } = await supabase
    .from('filming_videos')
    .select(`
      *,
      filming_composite_images!inner(scene_id)
    `)
    .eq('filming_composite_images.scene_id', sceneId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取场景视频失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 删除视频
 */
export async function deleteFilmingVideo(videoId: string) {
  const { error } = await supabase
    .from('filming_videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    console.error('删除视频失败:', error);
    throw error;
  }
}

// ==================== 最终视频相关 ====================

/**
 * 创建最终拼接视频记录
 */
export async function createFinalVideo(videoData: {
  novel_id: string;
  chapter_number: number;
  video_url: string;
  storage_path: string;
  source_video_ids: string[];
  duration?: number;
}) {
  const { data, error } = await supabase
    .from('filming_final_videos')
    .insert({
      novel_id: videoData.novel_id,
      chapter_number: videoData.chapter_number,
      video_url: videoData.video_url,
      storage_path: videoData.storage_path,
      source_video_ids: videoData.source_video_ids,
      duration: videoData.duration
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建最终视频记录失败:', error);
    throw error;
  }

  return data;
}

/**
 * 获取章节的最终视频
 */
export async function getChapterFinalVideos(novelId: string, chapterNumber: number) {
  const { data, error } = await supabase
    .from('filming_final_videos')
    .select('*')
    .eq('novel_id', novelId)
    .eq('chapter_number', chapterNumber)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取最终视频失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 获取小说的所有最终视频
 */
export async function getNovelFinalVideos(novelId: string) {
  const { data, error } = await supabase
    .from('filming_final_videos')
    .select('*')
    .eq('novel_id', novelId)
    .order('chapter_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取小说视频失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 删除最终视频
 */
export async function deleteFinalVideo(videoId: string) {
  const { error } = await supabase
    .from('filming_final_videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    console.error('删除最终视频失败:', error);
    throw error;
  }
}

// ==================== 系统配置相关 ====================

/**
 * AI模型配置类型
 */
export interface AIModelConfig {
  provider: 'miaoda' | 'custom';
  customApiUrl?: string;
  customApiKey?: string;
  customModel?: string;
}

/**
 * 获取AI模型配置
 */
export async function getAIModelConfig(): Promise<AIModelConfig> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'ai_model_config')
    .maybeSingle();

  if (error) {
    console.error('获取AI模型配置失败:', error);
    throw error;
  }

  if (!data) {
    // 返回默认配置
    return {
      provider: 'miaoda'
    };
  }

  try {
    const config = typeof data.value === 'string' 
      ? JSON.parse(data.value) 
      : data.value;
    
    return {
      provider: config.provider || 'miaoda',
      customApiUrl: config.customApiUrl,
      customApiKey: config.customApiKey,
      customModel: config.customModel
    };
  } catch (e) {
    console.error('解析AI模型配置失败:', e);
    return {
      provider: 'miaoda'
    };
  }
}

/**
 * 更新AI模型配置（仅管理员）
 */
export async function updateAIModelConfig(config: AIModelConfig): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .update({
      value: JSON.stringify(config),
      updated_at: new Date().toISOString()
    })
    .eq('key', 'ai_model_config');

  if (error) {
    console.error('更新AI模型配置失败:', error);
    throw error;
  }
}
