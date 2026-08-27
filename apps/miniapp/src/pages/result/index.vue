<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getJob } from '../../services/api';

const query = ref<{ platform?: string; id?: string }>({});
const platform = computed(() => ({ doubao: '豆包', douyin: '抖音', xhs: '小红书', qianwen: '千问', wechat_channels: '微信视频号', jimeng: '即梦', kuaishou: '快手' }[query.value.platform || ''] || '素材'));
const mediaCount = ref(0);
const isSuccess = ref(false);
const previewFailed = ref(false);
const media = ref<{ type: string; proxyUrl: string } | null>(null);

onLoad(async (options) => { const received = (options || {}) as { platform?: string; id?: string }; query.value = received; if (!received.id) return; try { const job = await getJob(received.id); mediaCount.value = job.media.length; isSuccess.value = job.status === 'SUCCESS'; media.value = job.media[0] || null; } catch { uni.showToast({ title: '无法读取解析结果', icon: 'none' }); } });
function save() { if (!media.value) return; const token = uni.getStorageSync('access_token'); uni.downloadFile({ url: media.value.proxyUrl, header: { Authorization: `Bearer ${token}` }, success: ({ tempFilePath }) => { if (media.value?.type === 'IMAGE') uni.saveImageToPhotosAlbum({ filePath: tempFilePath, success: () => uni.showToast({ title: '已保存到相册' }) }); else uni.saveVideoToPhotosAlbum({ filePath: tempFilePath, success: () => uni.showToast({ title: '已保存到相册' }) }); }, fail: () => uni.showToast({ title: '下载失败，请重试', icon: 'none' }) }); }
function copy() { if (media.value) uni.setClipboardData({ data: media.value.proxyUrl }); }
function back() { uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: '/pages/home/index' }) }); }
function home() { uni.switchTab({ url: '/pages/home/index' }); }
</script>

<template>
  <view class="page">
    <view class="topbar"><text class="back" @click="back">‹ 返回</text><text class="top-title">提取结果</text><text class="home-link" @click="home">首页</text></view>
    <view class="status"><text class="tick">{{ isSuccess ? '✓' : '…' }}</text><text class="status-title">{{ isSuccess ? '提取成功' : '正在读取结果' }}</text><text class="detail">{{ platform }} · {{ mediaCount || 1 }} 个素材</text></view>
    <view class="preview"><video v-if="media?.type === 'VIDEO' && !previewFailed" :src="media.proxyUrl" controls :show-center-play-btn="true" object-fit="contain" @error="previewFailed = true"/><image v-else-if="media?.type === 'IMAGE' && !previewFailed" :src="media.proxyUrl" mode="aspectFit" @error="previewFailed = true"/><view v-else class="preview-empty"><view class="play">▶</view><text>{{ previewFailed ? '预览加载失败，可直接保存素材' : '高清素材预览' }}</text></view></view>
    <view class="facts"><view><text>素材类型</text><b>{{ media?.type === 'IMAGE' ? '图片' : '视频' }}</b></view><view><text>素材数量</text><b>{{ mediaCount || 1 }}</b></view><view><text>解析状态</text><b>{{ isSuccess ? '成功' : '处理中' }}</b></view></view>
    <view class="actions"><button class="save" :disabled="!isSuccess" @click="save">保存到相册</button><button class="copy" :disabled="!isSuccess" @click="copy">复制链接</button><button class="again" @click="home">继续提取</button></view>
    <text class="note">解析成功后已扣除 1 点；保存失败不会再次扣点</text>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(34rpx + var(--status-bar-height)) 36rpx 72rpx;box-sizing:border-box;background:var(--canvas)}.topbar{height:72rpx;display:flex;align-items:center;justify-content:space-between;color:var(--ink)}.back,.home-link{font-size:26rpx;color:var(--violet);font-weight:700}.top-title{font-size:29rpx;font-weight:800}.status{display:flex;flex-direction:column;align-items:center;margin-top:34rpx}.tick{display:grid;place-items:center;width:88rpx;height:88rpx;border-radius:50%;background:#e6f9ef;color:#23975b;font-size:38rpx;font-weight:800}.status-title{margin-top:18rpx;font-size:38rpx;font-weight:800}.detail,.note{font-size:24rpx;font-weight:400;color:var(--muted);margin-top:10rpx}.preview{height:460rpx;margin-top:52rpx;border:1rpx solid #302a3c;border-radius:28rpx;background:#2c263b;overflow:hidden;color:#fff;font-size:24rpx;box-shadow:0 16rpx 36rpx rgba(35,27,52,.14)}.preview video,.preview image{width:100%;height:100%}.preview-empty{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center}.play{width:92rpx;height:92rpx;border-radius:50%;background:#fff;color:var(--violet);display:grid;place-items:center;font-size:35rpx;margin-bottom:22rpx}.facts{display:flex;background:var(--surface);border:1rpx solid var(--line);border-radius:24rpx;margin:28rpx 0;padding:28rpx 10rpx;justify-content:space-around}.facts view{display:flex;flex-direction:column;gap:10rpx;font-size:22rpx;color:var(--muted)}.facts b{font-size:24rpx;color:var(--ink)}.actions{display:flex;flex-direction:column;gap:18rpx}.save,.copy,.again{margin:0;border-radius:18rpx;height:94rpx;line-height:94rpx;font-weight:700}.save{background:var(--violet);color:#fff}.copy{background:var(--violet-soft);color:#5636bd}.again{background:var(--surface);border:1rpx solid var(--line);color:#5f5870}.note{display:block;text-align:center;line-height:1.5;margin:30rpx 25rpx}
</style>
