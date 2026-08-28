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
const saveProgress = ref(0);

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
  saveProgress.value = 0;
  let saved = 0;
  for (const item of imageMedia.value) { try { await saveMedia(item); saved += 1; } catch { /* Continue saving the remaining images. */ } finally { saveProgress.value += 1; } }
  savingAll.value = false;
  uni.showToast({ title: saved === imageMedia.value.length ? `已保存全部 ${saved} 张` : `已保存 ${saved}/${imageMedia.value.length} 张`, icon: 'none' });
}
function copyText() { if (textForCopy.value) uni.setClipboardData({ data: textForCopy.value }); }
function copyLink() { if (videoMedia.value) uni.setClipboardData({ data: videoMedia.value.proxyUrl }); }
</script>

<template>
  <view class="page">
    <view class="topbar"><text class="back" @click="back">‹ 返回</text><text class="top-title">提取结果</text><text class="home-link" @click="home">首页</text></view>
    <view class="status"><view class="status-icon">{{ isSuccess ? '✓' : '…' }}</view><view><text class="status-title">{{ isSuccess ? '素材已整理好' : '正在读取结果' }}</text><text class="detail">{{ platform }} · {{ mediaList.length || 1 }} 个{{ isImageResult ? '图片素材' : '视频素材' }}</text></view></view>

    <view v-if="isImageResult" class="gallery-card"><swiper class="gallery" :indicator-dots="imageMedia.length > 1" indicator-color="rgba(255,255,255,.42)" indicator-active-color="#ffffff" :current="activeImage" @change="onSlide"><swiper-item v-for="item in imageMedia" :key="item.id"><view class="gallery-image-wrap"><image :src="item.proxyUrl" mode="aspectFit" @error="previewFailed = true"/><view v-if="previewFailed" class="preview-empty"><text>图片预览加载失败，可直接保存</text></view></view></swiper-item></swiper><view class="page-count">{{ activeImage + 1 }} / {{ imageMedia.length }}</view></view>
    <view v-else class="preview"><video v-if="videoMedia && !previewFailed" :src="videoMedia.proxyUrl" controls :show-center-play-btn="true" object-fit="contain" @error="previewFailed = true"/><view v-else class="preview-empty"><view class="play">▶</view><text>{{ previewFailed ? '预览加载失败，可直接保存素材' : '高清素材预览' }}</text></view></view>

    <view class="facts"><view><text>素材类型</text><b>{{ isImageResult ? '图文' : '视频' }}</b></view><view><text>素材数量</text><b>{{ mediaList.length || 1 }}</b></view><view><text>解析状态</text><b class="success">{{ isSuccess ? '成功' : '处理中' }}</b></view></view>
    <view v-if="hasText" class="text-card"><view class="text-card-head"><view><text class="text-title">AI 提取的标题与正文</text><text class="text-subtitle">可复制后继续创作或整理</text></view><text class="copy-text" @click="copyText">复制</text></view><text v-if="title" class="material-title">{{ title }}</text><text v-if="content" class="material-content">{{ content }}</text></view>

    <view class="actions"><button v-if="isImageResult" class="save" :disabled="!isSuccess || savingAll" :loading="savingCurrent" @click="saveCurrent">保存本张</button><button v-else class="save" :disabled="!isSuccess" :loading="savingCurrent" @click="saveVideoMaterial">保存到相册</button><button v-if="isImageResult && imageMedia.length > 1" class="secondary" :disabled="!isSuccess || savingCurrent" :loading="savingAll" @click="saveAll">{{ savingAll ? `正在保存 ${saveProgress}/${imageMedia.length} 张` : `一键保存全部 ${imageMedia.length} 张` }}</button><button v-else-if="!isImageResult" class="secondary" :disabled="!isSuccess" @click="copyLink">复制链接</button><button class="again" @click="home">继续提取</button></view>
    <text class="note">解析成功后已扣除 1 点；保存失败不会再次扣点</text>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(32rpx + var(--status-bar-height)) 32rpx 70rpx;box-sizing:border-box;background:var(--canvas)}.topbar{height:72rpx;display:flex;align-items:center;justify-content:space-between}.back,.home-link{color:var(--violet);font-size:25rpx;font-weight:700}.top-title{color:var(--ink);font-size:29rpx;font-weight:800}.status{display:flex;align-items:center;gap:17rpx;margin-top:38rpx}.status-icon{width:70rpx;height:70rpx;flex:none;display:grid;place-items:center;border-radius:23rpx;background:#e6f8ef;color:#279964;font-size:33rpx;font-weight:800}.status-title,.detail{display:block}.status-title{color:var(--ink);font-size:35rpx;font-weight:800;letter-spacing:-1rpx}.detail{margin-top:7rpx;color:var(--muted);font-size:23rpx}.preview,.gallery-card{height:460rpx;margin-top:40rpx;border:1rpx solid #1d416f;border-radius:27rpx;background:#132b4c;overflow:hidden;color:#fff;font-size:24rpx;box-shadow:0 14rpx 32rpx rgba(27,68,124,.14)}.preview video{width:100%;height:100%}.gallery-card{position:relative}.gallery{width:100%;height:100%}.gallery-image-wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}.gallery-image-wrap image{width:100%;height:100%}.page-count{position:absolute;right:18rpx;top:18rpx;padding:8rpx 15rpx;border-radius:99rpx;background:rgba(5,20,40,.48);font-size:21rpx}.preview-empty{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:18rpx}.play{width:84rpx;height:84rpx;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--violet);font-size:31rpx}.facts{display:flex;margin:26rpx 0;padding:25rpx 7rpx;border-top:1rpx solid var(--line);border-bottom:1rpx solid var(--line);justify-content:space-around}.facts view{display:flex;flex-direction:column;gap:9rpx;color:var(--muted);font-size:21rpx}.facts b{color:#32445f;font-size:24rpx}.facts .success{color:#299768}.text-card{margin:0 0 27rpx;padding:25rpx 0;border-top:1rpx solid var(--line);border-bottom:1rpx solid var(--line)}.text-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.text-title,.text-subtitle{display:block}.text-title{color:var(--ink);font-size:27rpx;font-weight:800}.text-subtitle{margin-top:6rpx;color:var(--muted);font-size:20rpx}.copy-text{padding:9rpx 16rpx;border-radius:13rpx;background:var(--violet-soft);color:var(--violet);font-size:21rpx;font-weight:700}.material-title,.material-content{display:block;white-space:pre-wrap;line-height:1.68}.material-title{margin-top:23rpx;color:#283a55;font-size:28rpx;font-weight:800}.material-content{margin-top:15rpx;color:#62718a;font-size:25rpx}.actions{display:flex;flex-direction:column;gap:15rpx}.save,.secondary,.again{margin:0;height:92rpx;line-height:92rpx;border-radius:18rpx;font-size:27rpx;font-weight:700}.save{background:var(--violet);color:#fff;box-shadow:0 11rpx 22rpx rgba(40,120,240,.16)}.secondary{background:var(--violet-soft);color:#246bd5}.again{border:1rpx solid #dce8f7;background:var(--surface);color:#52647f}.note{display:block;margin:28rpx 20rpx 0;color:var(--muted);text-align:center;font-size:21rpx;line-height:1.55}
</style>
