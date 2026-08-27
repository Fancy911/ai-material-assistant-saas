<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getHistory } from '../../services/api';
import { platformNames } from '../../services/platform';

type Filter = 'ALL' | 'VIDEO' | 'IMAGE';
type HistoryItem = { id: string; platform: string; status: string; mediaType: string | null; title: string | null; createdAt: string };

const history = ref<HistoryItem[]>([]);
const filter = ref<Filter>('ALL');
const shownHistory = computed(() => filter.value === 'ALL' ? history.value : history.value.filter((item) => item.mediaType === filter.value));

function title(item: HistoryItem) { return item.title || platformNames[item.platform] || '已提取素材'; }
function kind(item: HistoryItem) { return item.mediaType === 'IMAGE' ? '图片' : '视频'; }
function platformLabel(item: HistoryItem) { return platformNames[item.platform] || '分享链接'; }
function dateLabel(value: string) { const date = new Date(value); return `${date.getMonth() + 1}月${date.getDate()}日`; }
function open(item: HistoryItem) { uni.navigateTo({ url: `/pages/result/index?id=${item.id}&platform=${item.platform}` }); }
function goHome() { uni.switchTab({ url: '/pages/home/index' }); }
onMounted(async () => { try { history.value = await getHistory(); } catch { uni.showToast({ title: '无法加载记录', icon: 'none' }); } });
</script>

<template>
  <view class="page">
    <view class="topbar"><view><text class="eyebrow">MATERIAL LIBRARY</text><text class="title">提取记录</text></view><text class="count">{{ history.length }} 条</text></view>
    <view class="filters"><text :class="{ selected: filter === 'ALL' }" @click="filter = 'ALL'">全部</text><text :class="{ selected: filter === 'VIDEO' }" @click="filter = 'VIDEO'">视频</text><text :class="{ selected: filter === 'IMAGE' }" @click="filter = 'IMAGE'">图片</text></view>
    <view v-if="shownHistory.length" class="list">
      <view v-for="item in shownHistory" :key="item.id" class="record" @click="open(item)">
        <view class="thumb"><text>{{ item.mediaType === 'IMAGE' ? '▧' : '▶' }}</text></view>
        <view class="record-main"><text class="record-title">{{ title(item) }}</text><text class="record-meta">{{ platformLabel(item) }} · {{ kind(item) }} · {{ dateLabel(item.createdAt) }}</text></view>
        <text class="arrow">›</text>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-mark">⌁</view><text class="empty-title">{{ filter === 'ALL' ? '还没有提取记录' : `暂无${filter === 'VIDEO' ? '视频' : '图片'}素材` }}</text><text>{{ filter === 'ALL' ? '成功提取后会在这里保留 30 天' : '换个分类看看，或去首页提取素材' }}</text><button v-if="filter === 'ALL'" @click="goHome">去提取</button></view>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(34rpx + var(--status-bar-height)) 36rpx 56rpx;box-sizing:border-box;background:var(--canvas)}.topbar{height:128rpx;display:flex;justify-content:space-between;align-items:center}.eyebrow{display:block;color:var(--muted);font-size:20rpx;letter-spacing:2rpx;font-weight:700}.title{display:block;margin-top:12rpx;font-family:serif;font-size:50rpx;font-weight:800}.count{padding:11rpx 18rpx;border-radius:99rpx;background:var(--violet-soft);color:var(--violet);font-size:22rpx;font-weight:700}.filters{display:flex;gap:16rpx;margin:24rpx 0 28rpx}.filters text{padding:14rpx 28rpx;border:1rpx solid var(--line);border-radius:99rpx;background:var(--surface);color:var(--muted);font-size:24rpx}.filters .selected{border-color:var(--violet);background:var(--violet);color:#fff;font-weight:700}.list{display:flex;flex-direction:column;gap:18rpx}.record{display:flex;gap:20rpx;align-items:center;padding:22rpx;background:var(--surface);border:1rpx solid var(--line);border-radius:26rpx;box-shadow:0 10rpx 28rpx rgba(44,33,67,.04)}.thumb{width:82rpx;height:82rpx;flex:none;display:grid;place-items:center;border-radius:22rpx;background:var(--violet-soft);color:var(--violet);font-size:32rpx}.record-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:10rpx}.record-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:27rpx;font-weight:800}.record-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:21rpx}.arrow{font-size:38rpx;color:#b3adbf}.empty{height:500rpx;padding:0 32rpx;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:14rpx}.empty-mark{width:100rpx;height:100rpx;display:grid;place-items:center;border-radius:36rpx;background:var(--violet-soft);color:var(--violet);font-size:54rpx}.empty-title{font-size:30rpx!important;color:var(--ink)!important;font-weight:800}.empty text{color:var(--muted);font-size:23rpx}.empty button{margin-top:18rpx;padding:0 46rpx;height:78rpx;line-height:78rpx;border-radius:18rpx;background:var(--violet);color:#fff;font-size:25rpx;font-weight:700}
</style>
