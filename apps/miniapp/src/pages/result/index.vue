<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getJob } from '../../services/api';

type Media = { id: string; type: string; proxyUrl: string };

const query = ref<{ platform?: string; id?: string }>({});
const platform = computed(() => ({ doubao: '豆包', douyin: '抖音', xhs: '小红书', qianwen: '千问', wechat_channels: '微信视频号', jimeng: '即梦', kuaishou: '快手' }[query.value.platform || ''] || '素材'));
const mediaList = ref<Media[]>([]);
const title = ref<string | null>(null);
const content = ref<string | null>(null);
const isSuccess = ref(false);
const previewFailed = ref(false);
const activeImage = ref(0);
const savingCurrent = ref(false);
const savingAll = ref(false);

const imageMedia = computed(() => mediaList.value.filter((item) => item.type === 'IMAGE'));
const isImageResult = computed(() => imageMedia.value.length > 0);
const currentImage = computed(() => imageMedia.value[activeImage.value] || null);
const videoMedia = computed(() => mediaList.value.find((item) => item.type === 'VIDEO') || null);
const hasText = computed(() => Boolean(title.value || content.value));
const textForCopy = computed(() => [title.value?.trim(), content.value?.trim()].filter(Boolean).join('\n\n'));

onLoad(async (options) => {
  const received = (options || {}) as { platform?: string; id?: string };
  query.value = received;
  if (!received.id) return;
  try {
    const job = await getJob(received.id);
    mediaList.value = job.media;
    title.value = job.title;
    content.value = job.content;
    isSuccess.value = job.status === 'SUCCESS';
  } catch { uni.showToast({ title: '无法读取解析结果', icon: 'none' }); }
});

function back() { uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: '/pages/home/index' }) }); }
function home() { uni.switchTab({ url: '/pages/home/index' }); }
function onSlide(event: Event) { activeImage.value = (event as CustomEvent<{ current?: number }>).detail?.current || 0; previewFailed.value = false; }
function download(item: Media) {
  const token = uni.getStorageSync('access_token');
  return new Promise<string>((resolve, reject) => uni.downloadFile({ url: item.proxyUrl, header: token ? { Authorization: `Bearer ${token}` } : {}, success: ({ statusCode, tempFilePath }) => statusCode >= 200 && statusCode < 300 ? resolve(tempFilePath) : reject(new Error('DOWNLOAD_FAILED')), fail: reject }));
}
function saveImage(filePath: string) { return new Promise<void>((resolve, reject) => uni.saveImageToPhotosAlbum({ filePath, success: () => resolve(), fail: reject })); }
function saveVideo(filePath: string) { return new Promise<void>((resolve, reject) => uni.saveVideoToPhotosAlbum({ filePath, success: () => resolve(), fail: reject })); }
async function saveMedia(item: Media) { const tempFilePath = await download(item); if (item.type === 'IMAGE') await saveImage(tempFilePath); else await saveVideo(tempFilePath); }
async function saveCurrent() {
  if (!currentImage.value || savingCurrent.value) return;
  savingCurrent.value = true;
  try { await saveMedia(currentImage.value); uni.showToast({ title: '已保存到相册' }); } catch { uni.showToast({ title: '保存失败，请检查相册权限', icon: 'none' }); } finally { savingCurrent.value = false; }
}
async function saveVideoMaterial() {
  if (!videoMedia.value || savingCurrent.value) return;
  savingCurrent.value = true;
  try { await saveMedia(videoMedia.value); uni.showToast({ title: '已保存到相册' }); } catch { uni.showToast({ title: '保存失败，请检查相册权限', icon: 'none' }); } finally { savingCurrent.value = false; }
}
async function saveAll() {
  if (imageMedia.value.length < 2 || savingAll.value) return;
  savingAll.value = true;
  let saved = 0;
  for (const item of imageMedia.value) { try { await saveMedia(item); saved += 1; } catch { /* Continue saving the remaining images. */ } }
  savingAll.value = false;
  uni.showToast({ title: saved === imageMedia.value.length ? `已保存全部 ${saved} 张` : `已保存 ${saved}/${imageMedia.value.length} 张`, icon: 'none' });
}
function copyText() { if (textForCopy.value) uni.setClipboardData({ data: textForCopy.value }); }
function copyLink() { if (videoMedia.value) uni.setClipboardData({ data: videoMedia.value.proxyUrl }); }
</script>

<template>
  <view class="page">
    <view class="topbar"><text class="back" @click="back">‹ 返回</text><text class="top-title">提取结果</text><text class="home-link" @click="home">首页</text></view>
    <view class="status"><text class="tick">{{ isSuccess ? '✓' : '…' }}</text><text class="status-title">{{ isSuccess ? '提取成功' : '正在读取结果' }}</text><text class="detail">{{ platform }} · {{ mediaList.length || 1 }} 个{{ isImageResult ? '图片素材' : '视频素材' }}</text></view>

    <view v-if="isImageResult" class="gallery-card">
      <swiper class="gallery" :indicator-dots="imageMedia.length > 1" indicator-color="rgba(255,255,255,.42)" indicator-active-color="#ffffff" :current="activeImage" @change="onSlide"><swiper-item v-for="item in imageMedia" :key="item.id"><view class="gallery-image-wrap"><image :src="item.proxyUrl" mode="aspectFit" @error="previewFailed = true"/><view v-if="previewFailed" class="preview-empty"><text>图片预览加载失败，可直接保存</text></view></view></swiper-item></swiper>
      <view class="page-count">{{ activeImage + 1 }} / {{ imageMedia.length }}</view>
    </view>
    <view v-else class="preview"><video v-if="videoMedia && !previewFailed" :src="videoMedia.proxyUrl" controls :show-center-play-btn="true" object-fit="contain" @error="previewFailed = true"/><view v-else class="preview-empty"><view class="play">▶</view><text>{{ previewFailed ? '预览加载失败，可直接保存素材' : '高清素材预览' }}</text></view></view>

    <view class="facts"><view><text>素材类型</text><b>{{ isImageResult ? '图文' : '视频' }}</b></view><view><text>素材数量</text><b>{{ mediaList.length || 1 }}</b></view><view><text>解析状态</text><b>{{ isSuccess ? '成功' : '处理中' }}</b></view></view>
    <view v-if="hasText" class="text-card"><view class="text-card-head"><text>标题与正文</text><text class="copy-text" @click="copyText">复制文本</text></view><text v-if="title" class="material-title">{{ title }}</text><text v-if="content" class="material-content">{{ content }}</text></view>

    <view class="actions"><button v-if="isImageResult" class="save" :disabled="!isSuccess" :loading="savingCurrent" @click="saveCurrent">保存本张</button><button v-else class="save" :disabled="!isSuccess" :loading="savingCurrent" @click="saveVideoMaterial">保存到相册</button><button v-if="isImageResult && imageMedia.length > 1" class="copy" :disabled="!isSuccess" :loading="savingAll" @click="saveAll">一键保存全部 {{ imageMedia.length }} 张</button><button v-else-if="!isImageResult" class="copy" :disabled="!isSuccess" @click="copyLink">复制链接</button><button class="again" @click="home">继续提取</button></view>
    <text class="note">解析成功后已扣除 1 点；保存失败不会再次扣点</text>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(34rpx + var(--status-bar-height)) 36rpx 72rpx;box-sizing:border-box;background:var(--canvas)}.topbar{height:72rpx;display:flex;align-items:center;justify-content:space-between;color:var(--ink)}.back,.home-link{font-size:26rpx;color:var(--violet);font-weight:700}.top-title{font-size:29rpx;font-weight:800}.status{display:flex;flex-direction:column;align-items:center;margin-top:34rpx}.tick{display:grid;place-items:center;width:88rpx;height:88rpx;border-radius:50%;background:#e6f9ef;color:#23975b;font-size:38rpx;font-weight:800}.status-title{margin-top:18rpx;font-size:38rpx;font-weight:800}.detail,.note{font-size:24rpx;font-weight:400;color:var(--muted);margin-top:10rpx}.preview,.gallery-card{height:460rpx;margin-top:52rpx;border:1rpx solid #302a3c;border-radius:28rpx;background:#2c263b;overflow:hidden;color:#fff;font-size:24rpx;box-shadow:0 16rpx 36rpx rgba(35,27,52,.14)}.preview video{width:100%;height:100%}.gallery-card{position:relative}.gallery{width:100%;height:100%}.gallery-image-wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}.gallery-image-wrap image{width:100%;height:100%}.page-count{position:absolute;right:20rpx;top:20rpx;padding:8rpx 16rpx;border-radius:99rpx;background:rgba(0,0,0,.5);font-size:22rpx}.preview-empty{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:18rpx}.play{width:92rpx;height:92rpx;border-radius:50%;background:#fff;color:var(--violet);display:grid;place-items:center;font-size:35rpx}.facts{display:flex;background:var(--surface);border:1rpx solid var(--line);border-radius:24rpx;margin:28rpx 0;padding:28rpx 10rpx;justify-content:space-around}.facts view{display:flex;flex-direction:column;gap:10rpx;font-size:22rpx;color:var(--muted)}.facts b{font-size:24rpx;color:var(--ink)}.text-card{margin:0 0 28rpx;padding:28rpx;border:1rpx solid var(--line);border-radius:26rpx;background:var(--surface)}.text-card-head{display:flex;align-items:center;justify-content:space-between;font-size:27rpx;font-weight:800}.copy-text{padding:8rpx 14rpx;border-radius:12rpx;background:var(--violet-soft);color:var(--violet);font-size:21rpx}.material-title,.material-content{display:block;white-space:pre-wrap;line-height:1.65}.material-title{margin-top:24rpx;color:var(--ink);font-size:28rpx;font-weight:800}.material-content{margin-top:15rpx;color:#686172;font-size:25rpx}.actions{display:flex;flex-direction:column;gap:18rpx}.save,.copy,.again{margin:0;border-radius:18rpx;height:94rpx;line-height:94rpx;font-weight:700}.save{background:var(--violet);color:#fff}.copy{background:var(--violet-soft);color:#5636bd}.again{background:var(--surface);border:1rpx solid var(--line);color:#5f5870}.note{display:block;text-align:center;line-height:1.5;margin:30rpx 25rpx}
</style>
