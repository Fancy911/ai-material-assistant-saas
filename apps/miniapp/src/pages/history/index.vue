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
function kind(item: HistoryItem) { return item.mediaType === 'IMAGE' ? '图文素材' : '视频素材'; }
function platformLabel(item: HistoryItem) { return platformNames[item.platform] || '分享链接'; }
function dateLabel(value: string) { const date = new Date(value); return `${date.getMonth() + 1}月${date.getDate()}日`; }
function open(item: HistoryItem) { uni.navigateTo({ url: `/pages/result/index?id=${item.id}&platform=${item.platform}` }); }
function goHome() { uni.switchTab({ url: '/pages/home/index' }); }
onMounted(async () => { try { history.value = await getHistory(); } catch { uni.showToast({ title: '无法加载记录', icon: 'none' }); } });
</script>

<template>
  <view class="page">
    <view class="topbar"><view><text class="eyebrow">MATERIALS</text><text class="title">提取记录</text><text class="subtitle">你提取过的内容，都在这里</text></view><view class="count"><b>{{ history.length }}</b><text>条记录</text></view></view>
    <view class="filters"><text :class="{ selected: filter === 'ALL' }" @click="filter = 'ALL'">全部</text><text :class="{ selected: filter === 'VIDEO' }" @click="filter = 'VIDEO'">视频</text><text :class="{ selected: filter === 'IMAGE' }" @click="filter = 'IMAGE'">图文</text></view>
    <view v-if="shownHistory.length" class="list"><view v-for="item in shownHistory" :key="item.id" class="record" @click="open(item)"><view class="thumb" :class="{ image: item.mediaType === 'IMAGE' }"><text>{{ item.mediaType === 'IMAGE' ? '▧' : '▶' }}</text></view><view class="record-main"><text class="record-title">{{ title(item) }}</text><text class="record-meta">{{ platformLabel(item) }} · {{ kind(item) }}</text><text class="record-date">{{ dateLabel(item.createdAt) }}</text></view><text class="arrow">›</text></view></view>
    <view v-else class="empty"><view class="empty-mark">✦</view><text class="empty-title">{{ filter === 'ALL' ? '还没有提取记录' : `暂无${filter === 'VIDEO' ? '视频' : '图文'}素材` }}</text><text class="empty-copy">{{ filter === 'ALL' ? '提取成功后，素材会在这里保留 30 天' : '换个分类看看，或去首页提取素材' }}</text><button v-if="filter === 'ALL'" @click="goHome">去提取素材</button></view>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(38rpx + var(--status-bar-height)) 32rpx 190rpx;box-sizing:border-box;background:var(--canvas)}.topbar{display:flex;justify-content:space-between;align-items:flex-start}.eyebrow{display:block;color:#8a71c5;font-size:20rpx;letter-spacing:2rpx;font-weight:800}.title{display:block;margin-top:10rpx;color:var(--ink);font-size:48rpx;line-height:1.2;font-weight:800;letter-spacing:-1rpx}.subtitle{display:block;margin-top:11rpx;color:var(--muted);font-size:24rpx}.count{display:flex;flex-direction:column;align-items:flex-end;margin-top:16rpx;color:var(--muted);font-size:19rpx}.count b{color:var(--violet);font-size:34rpx;line-height:1}.filters{display:flex;gap:12rpx;margin:38rpx 0 22rpx;padding-bottom:20rpx;border-bottom:1rpx solid var(--line)}.filters text{padding:12rpx 23rpx;border-radius:99rpx;color:var(--muted);font-size:24rpx}.filters .selected{background:var(--violet-soft);color:var(--violet);font-weight:800}.list{display:flex;flex-direction:column}.record{display:flex;align-items:center;gap:18rpx;padding:24rpx 4rpx;border-bottom:1rpx solid var(--line)}.thumb{width:76rpx;height:76rpx;flex:none;display:grid;place-items:center;border-radius:22rpx;background:#f0ebff;color:var(--violet);font-size:28rpx}.thumb.image{background:#fff0f6;color:#cb6290}.record-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:7rpx}.record-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#37303f;font-size:27rpx;font-weight:800}.record-meta,.record-date{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:21rpx}.record-date{font-size:20rpx;color:#9d96a7}.arrow{padding-right:5rpx;color:#b7afc3;font-size:37rpx}.empty{min-height:495rpx;padding:0 40rpx;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.empty-mark{width:88rpx;height:88rpx;display:grid;place-items:center;border-radius:28rpx;background:var(--violet-soft);color:var(--violet);font-size:38rpx}.empty-title{margin-top:23rpx;color:var(--ink);font-size:30rpx;font-weight:800}.empty-copy{margin-top:12rpx;color:var(--muted);font-size:23rpx;line-height:1.6}.empty button{margin-top:27rpx;padding:0 38rpx;height:80rpx;line-height:80rpx;border-radius:18rpx;background:var(--violet);color:#fff;font-size:25rpx;font-weight:700}
</style>
