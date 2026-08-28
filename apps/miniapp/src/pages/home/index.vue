<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { detectPlatform, extractUrl, platformNames } from '../../services/platform';
import { ensureSession, getMe, resolveMaterial } from '../../services/api';

const input = ref('');
const isParsing = ref(false);
const points = ref(0);
const platform = computed(() => detectPlatform(input.value));
const canResolve = computed(() => Boolean(platform.value) && !isParsing.value);
const platforms = [
  { name: '豆包', icon: '/static/platform-icons/doubao.svg' },
  { name: '抖音', icon: '/static/platform-icons/douyin.svg' },
  { name: '小红书', icon: '/static/platform-icons/xiaohongshu.svg' },
  { name: '视频号', icon: '/static/platform-icons/wechat-channels.svg' },
  { name: '即梦', icon: '/static/platform-icons/jimeng.svg' },
  { name: '快手', icon: '/static/platform-icons/kuaishou.svg' },
];

function paste() {
  uni.getClipboardData({ success: ({ data }) => { input.value = data; }, fail: () => uni.showToast({ title: '请手动粘贴链接', icon: 'none' }) });
}
function onInput(event: Event) {
  const detail = (event as CustomEvent<{ value?: string }>).detail;
  input.value = detail?.value || (event.target as HTMLTextAreaElement | null)?.value || '';
}
async function resolve() {
  if (!canResolve.value) return;
  isParsing.value = true;
  try {
    const job = await resolveMaterial(input.value);
    points.value -= 1;
    uni.navigateTo({ url: `/pages/result/index?id=${job.id}&platform=${job.platform}` });
  } catch (error) {
    const message = (error as { message?: string })?.message || '暂时没有解析成功，请检查链接或稍后重试';
    if (message.includes('NO_POINTS')) {
      uni.showModal({ title: '点数不足', content: '可使用兑换码补充点数；当前为免费内测。', confirmText: '去兑换', success: ({ confirm }) => { if (confirm) goMe(); } });
    } else uni.showToast({ title: message, icon: 'none' });
  } finally { isParsing.value = false; }
}
function goMe() { uni.switchTab({ url: '/pages/me/index' }); }
function goHistory() { uni.switchTab({ url: '/pages/history/index' }); }
onMounted(async () => {
  try { await ensureSession(); points.value = (await getMe()).pointsBalance; }
  catch { uni.showToast({ title: '服务连接失败，请检查 API', icon: 'none' }); }
});
</script>

<template>
  <view class="screen">
    <view class="brand-head">
      <image class="brand-icon" src="/static/brand/baoxiaoyin-watermark-icon.png" mode="aspectFit"/>
      <view class="brand-copy"><text class="brand-name">包小印去水印</text><text class="brand-subtitle">豆包等 30+ 平台视频、图文素材提取</text></view>
      <view class="points-badge" @click="goMe"><b>{{ points }}</b><text>点</text></view>
    </view>

    <view class="platform-panel"><view class="support-label"><text>支持平台</text><text>30+</text></view><view class="support-icons"><view v-for="item in platforms" :key="item.name" class="platform"><image :src="item.icon" mode="aspectFit"/><text>{{ item.name }}</text></view></view></view>

    <view class="resolve-panel">
      <view class="resolve-glow"></view>
      <view class="prompt-top"><view class="spark">✦</view><view><text class="prompt-kicker">AI 智能提取</text><text class="prompt-title">粘贴分享链接</text><text class="prompt-subtitle">视频、图文与文案一次整理好</text></view><text class="paste" @click="paste">一键粘贴</text></view>
      <view class="input-shell"><textarea :value="input" :maxlength="4000" auto-height placeholder="粘贴豆包、即梦、抖音、小红书、视频号等分享链接" @input="onInput" /></view>
      <view class="recognition"><view class="recognition-dot" :class="{ active: platform }"/><text v-if="platform">已识别 {{ platformNames[platform] }} 链接</text><text v-else-if="input">请输入完整的分享链接</text><text v-else>支持 30+ 平台，无需手动选择</text></view>
      <button class="primary" :class="{ disabled: !canResolve }" :loading="isParsing" @click="resolve">{{ isParsing ? '正在整理素材…' : '开始提取' }}</button>
    </view>

    <view class="recent"><view class="section-head"><text class="section-title">最近提取</text><text class="history-link" @click="goHistory">查看记录</text></view><view class="empty"><view class="empty-mark">✦</view><view><text class="empty-title">这里会出现你的素材</text><text class="empty-sub">提取后的图片、视频和文案都会保留在记录中</text></view></view></view>
  </view>
</template>

<style scoped>
.screen{min-height:100vh;padding:calc(158rpx + var(--status-bar-height)) 32rpx 190rpx;box-sizing:border-box;background:linear-gradient(180deg,#fbf9ff 0,#f8f7fc 430rpx,var(--canvas) 100%)}
.brand-head{display:flex;align-items:center;gap:16rpx}.brand-icon{width:78rpx;height:78rpx;flex:none;border-radius:26rpx;box-shadow:0 12rpx 25rpx rgba(82,54,160,.17)}.brand-copy{min-width:0;flex:1}.brand-name,.brand-subtitle{display:block}.brand-name{color:var(--ink);font-size:38rpx;line-height:1.25;font-weight:800;letter-spacing:-1rpx}.brand-subtitle{margin-top:8rpx;color:#756d82;font-size:21rpx;white-space:nowrap}.points-badge{display:flex;align-items:baseline;gap:4rpx;padding:12rpx 15rpx;border:1rpx solid #e5ddf8;border-radius:17rpx;background:rgba(255,255,255,.78);color:#6944c5}.points-badge b{font-size:27rpx}.points-badge text{font-size:20rpx}
.platform-panel{margin-top:32rpx;padding:25rpx 24rpx 24rpx;border:1rpx solid #e4dbf4;border-radius:30rpx;background:linear-gradient(145deg,#fff,#faf8ff);box-shadow:0 14rpx 32rpx rgba(72,46,119,.07)}.support-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:19rpx;color:#8d8598;font-size:20rpx}.support-label text:first-child{color:#4d435a;font-size:25rpx;font-weight:800}.support-label text:last-child{padding:6rpx 13rpx;border-radius:99rpx;background:#f0ebff;color:var(--violet);font-size:18rpx;font-weight:800}.support-icons{display:flex;justify-content:space-between;gap:6rpx}.platform{width:82rpx;flex:none;display:flex;flex-direction:column;align-items:center;gap:9rpx}.platform image{width:61rpx;height:61rpx;border-radius:19rpx;box-shadow:0 6rpx 15rpx rgba(49,34,79,.11)}.platform text{color:#534a60;font-size:19rpx;line-height:1.2}
.resolve-panel{position:relative;overflow:hidden;margin-top:23rpx;padding:32rpx;border:1rpx solid #ded4f4;border-radius:36rpx;background:linear-gradient(150deg,#fff 0,#fcfbff 57%,#f3eeff 100%);box-shadow:0 22rpx 54rpx rgba(70,45,117,.12)}.resolve-panel::before{content:'';position:absolute;width:260rpx;height:260rpx;right:-120rpx;top:-155rpx;border-radius:50%;background:rgba(164,131,255,.14)}.resolve-panel::after{content:'';position:absolute;width:180rpx;height:180rpx;left:-100rpx;bottom:-120rpx;border-radius:50%;background:rgba(239,190,226,.16)}.resolve-glow{position:absolute;right:35rpx;top:36rpx;width:12rpx;height:12rpx;border-radius:50%;background:#d8caff;box-shadow:0 0 0 9rpx rgba(216,202,255,.2)}.prompt-top,.input-shell,.recognition,.primary{position:relative;z-index:1}.prompt-top{display:flex;align-items:center;gap:15rpx}.spark{width:58rpx;height:58rpx;display:grid;place-items:center;border-radius:20rpx;background:linear-gradient(145deg,#7d58f8,#a18aff);color:#fff;font-size:28rpx;box-shadow:0 11rpx 20rpx rgba(98,61,224,.23)}.prompt-top view:nth-child(2){min-width:0;flex:1}.prompt-kicker,.prompt-title,.prompt-subtitle{display:block}.prompt-kicker{margin-bottom:2rpx;color:#896ae8;font-size:18rpx;font-weight:800;letter-spacing:1rpx}.prompt-title{font-size:31rpx;font-weight:800;letter-spacing:-.5rpx}.prompt-subtitle{margin-top:5rpx;color:var(--muted);font-size:21rpx}.paste{padding:12rpx 17rpx;border:1rpx solid #ded2fd;border-radius:15rpx;background:#f7f3ff;color:var(--violet);font-size:21rpx;font-weight:800;box-shadow:inset 0 1rpx rgba(255,255,255,.8)}.input-shell{margin-top:25rpx;padding:2rpx;border-radius:23rpx;background:linear-gradient(135deg,#e6dcff,#f4efff 58%,#fff)}textarea{width:100%;min-height:185rpx;box-sizing:border-box;padding:20rpx;border-radius:21rpx;background:rgba(255,255,255,.94);color:var(--ink);font-size:27rpx;line-height:1.65}.recognition{display:flex;align-items:center;gap:10rpx;margin-top:17rpx;min-height:30rpx;color:var(--muted);font-size:22rpx}.recognition-dot{width:10rpx;height:10rpx;border-radius:50%;background:#c6bdcf}.recognition-dot.active{background:#42b883;box-shadow:0 0 0 6rpx #e4f8ef}.primary{margin-top:25rpx;height:100rpx;line-height:100rpx;border-radius:23rpx;background:linear-gradient(105deg,#6f3ff5,#936ff6);color:#fff;font-size:30rpx;font-weight:800;letter-spacing:.5rpx;box-shadow:0 15rpx 28rpx rgba(96,58,209,.27)}.primary.disabled{opacity:.42;box-shadow:none}
.recent{margin-top:40rpx}.section-head{display:flex;align-items:center;justify-content:space-between;margin:0 4rpx 17rpx;color:var(--muted);font-size:21rpx}.section-title{color:var(--ink);font-size:28rpx;font-weight:800}.history-link{color:var(--violet);font-weight:700}
.empty{display:flex;align-items:center;gap:19rpx;padding:25rpx 22rpx;border:1rpx solid #e9e3f0;border-radius:25rpx;background:rgba(255,255,255,.68)}.empty-mark{width:60rpx;height:60rpx;flex:none;display:grid;place-items:center;border-radius:19rpx;background:#f0ebff;color:var(--violet);font-size:27rpx}.empty-title,.empty-sub{display:block}.empty-title{font-size:25rpx;color:#3b3447;font-weight:700}.empty-sub{margin-top:7rpx;color:var(--muted);font-size:20rpx;line-height:1.45}
</style>
