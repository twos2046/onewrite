// 管理后台API

import { supabase } from './supabase';
import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  UserWithAdmin,
  AdminStats,
  Post,
} from '@/types/community';

// ==================== 权限检查 ====================

/**
 * 检查当前用户是否为管理员
 */
export async function checkIsAdmin(): Promise<boolean> {
  console.log('🔐 检查管理员权限');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('❌ 用户未登录');
    return false;
  }

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('❌ 检查管理员权限失败:', error);
    return false;
  }

  const isAdmin = data?.is_admin || false;
  console.log(isAdmin ? '✅ 用户是管理员' : '❌ 用户不是管理员');
  return isAdmin;
}

// ==================== 公告管理 ====================

/**
 * 获取所有公告（管理员）
 */
export async function getAllAnnouncements(): Promise<Announcement[]> {
  console.log('📢 获取所有公告（管理员）');

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      *,
      creator:users!created_by(nickname, avatar_url)
    `)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 获取公告失败:', error);
    throw error;
  }

  console.log('✅ 获取公告成功:', data?.length);
  return data || [];
}

/**
 * 获取激活的公告（普通用户）
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  console.log('📢 获取激活的公告');

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      *,
      creator:users!created_by(nickname, avatar_url)
    `)
    .eq('is_active', true)
    .lte('start_date', now)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 获取激活公告失败:', error);
    throw error;
  }

  console.log('✅ 获取激活公告成功:', data?.length);
  return data || [];
}

/**
 * 创建公告
 */
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  console.log('📢 创建公告:', input);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('用户未登录');
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      ...input,
      created_by: user.id,
    })
    .select(`
      *,
      creator:users!created_by(nickname, avatar_url)
    `)
    .maybeSingle();

  if (error) {
    console.error('❌ 创建公告失败:', error);
    throw error;
  }

  if (!data) {
    throw new Error('创建公告失败：未返回数据');
  }

  console.log('✅ 创建公告成功:', data.id);
  return data;
}

/**
 * 更新公告
 */
export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput
): Promise<Announcement> {
  console.log('📢 更新公告:', id, input);

  const { data, error } = await supabase
    .from('announcements')
    .update(input)
    .eq('id', id)
    .select(`
      *,
      creator:users!created_by(nickname, avatar_url)
    `)
    .maybeSingle();

  if (error) {
    console.error('❌ 更新公告失败:', error);
    throw error;
  }

  if (!data) {
    throw new Error('更新公告失败：未返回数据');
  }

  console.log('✅ 更新公告成功:', data.id);
  return data;
}

/**
 * 删除公告
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  console.log('📢 删除公告:', id);

  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌ 删除公告失败:', error);
    throw error;
  }

  console.log('✅ 删除公告成功:', id);
}

// ==================== 帖子管理 ====================

/**
 * 获取所有帖子（管理员）
 */
export async function getAllPosts(limit: number = 50): Promise<Post[]> {
  console.log('📝 获取所有帖子（管理员）');

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(nickname, avatar_url),
      novel:novels(novel_title, novel_thumb)
    `)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ 获取帖子失败:', error);
    throw error;
  }

  console.log('✅ 获取帖子成功:', data?.length);
  return data || [];
}

/**
 * 搜索帖子（管理员）
 */
export async function searchPosts(keyword: string): Promise<Post[]> {
  console.log('🔍 搜索帖子:', keyword);

  if (!keyword || keyword.trim() === '') {
    return getAllPosts();
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(nickname, avatar_url),
      novel:novels(novel_title, novel_thumb)
    `)
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ 搜索帖子失败:', error);
    throw error;
  }

  console.log('✅ 搜索帖子成功:', data?.length);
  return data || [];
}

/**
 * 置顶/取消置顶帖子
 */
export async function togglePostPin(postId: string, isPinned: boolean): Promise<void> {
  console.log('📌 切换帖子置顶状态:', postId, isPinned);

  const { error } = await supabase
    .from('posts')
    .update({ is_pinned: isPinned })
    .eq('id', postId);

  if (error) {
    console.error('❌ 切换帖子置顶状态失败:', error);
    throw error;
  }

  console.log('✅ 切换帖子置顶状态成功:', postId);
}

/**
 * 删除帖子
 */
export async function deletePost(postId: string): Promise<void> {
  console.log('🗑️ 删除帖子:', postId);

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    console.error('❌ 删除帖子失败:', error);
    throw error;
  }

  console.log('✅ 删除帖子成功:', postId);
}

// ==================== 用户管理 ====================

/**
 * 获取所有用户（管理员）
 */
export async function getAllUsers(limit: number = 100): Promise<UserWithAdmin[]> {
  console.log('👥 获取所有用户（管理员）');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ 获取用户失败:', error);
    throw error;
  }

  console.log('✅ 获取用户成功:', data?.length);
  return data || [];
}

/**
 * 搜索用户（管理员）
 */
export async function searchUsers(keyword: string): Promise<UserWithAdmin[]> {
  console.log('🔍 搜索用户:', keyword);

  if (!keyword || keyword.trim() === '') {
    return getAllUsers();
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`nickname.ilike.%${keyword}%,email.ilike.%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ 搜索用户失败:', error);
    throw error;
  }

  console.log('✅ 搜索用户成功:', data?.length);
  return data || [];
}

/**
 * 更新用户积分
 */
export async function updateUserScore(userId: string, scoreChange: number, reason: string): Promise<void> {
  console.log('💰 更新用户积分:', userId, scoreChange, reason);

  // 获取当前用户积分
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('score')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    console.error('❌ 获取用户积分失败:', userError);
    throw userError;
  }

  if (!userData) {
    throw new Error('用户不存在');
  }

  const currentScore = userData.score || 0;
  const newScore = Math.max(0, currentScore + scoreChange);

  // 更新用户积分
  const { error: updateError } = await supabase
    .from('users')
    .update({ score: newScore })
    .eq('id', userId);

  if (updateError) {
    console.error('❌ 更新用户积分失败:', updateError);
    throw updateError;
  }

  // 记录积分变动
  const { error: recordError } = await supabase
    .from('score_records')
    .insert({
      user_id: userId,
      score_change: scoreChange,
      reason: `管理员操作：${reason}`,
      balance_after: newScore,
    });

  if (recordError) {
    console.error('❌ 记录积分变动失败:', recordError);
    // 不抛出错误，因为积分已经更新成功
  }

  console.log('✅ 更新用户积分成功:', userId, newScore);
}

// ==================== 统计数据 ====================

/**
 * 获取管理员统计数据
 */
export async function getAdminStats(): Promise<AdminStats> {
  console.log('📊 获取管理员统计数据');

  // 获取用户总数
  const { count: totalUsers, error: usersError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (usersError) {
    console.error('❌ 获取用户总数失败:', usersError);
  }

  // 获取帖子总数
  const { count: totalPosts, error: postsError } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });

  if (postsError) {
    console.error('❌ 获取帖子总数失败:', postsError);
  }

  // 获取小说总数
  const { count: totalNovels, error: novelsError } = await supabase
    .from('novels')
    .select('*', { count: 'exact', head: true });

  if (novelsError) {
    console.error('❌ 获取小说总数失败:', novelsError);
  }

  // 获取公告总数
  const { count: totalAnnouncements, error: announcementsError } = await supabase
    .from('announcements')
    .select('*', { count: 'exact', head: true });

  if (announcementsError) {
    console.error('❌ 获取公告总数失败:', announcementsError);
  }

  // 获取今日活跃用户数（今日有签到或发帖的用户）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const { count: activeUsersToday, error: activeError } = await supabase
    .from('check_in_records')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', todayStr);

  if (activeError) {
    console.error('❌ 获取今日活跃用户数失败:', activeError);
  }

  const stats: AdminStats = {
    total_users: totalUsers || 0,
    total_posts: totalPosts || 0,
    total_novels: totalNovels || 0,
    total_announcements: totalAnnouncements || 0,
    active_users_today: activeUsersToday || 0,
  };

  console.log('✅ 获取管理员统计数据成功:', stats);
  return stats;
}
