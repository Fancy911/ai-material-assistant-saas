<script setup lang="ts">
import { computed, ref } from 'vue';
import { detectPlatform, extractUrl, platformNames } from '../../services/platform';
const input = ref(''); const isParsing = ref(false); const platform = computed(() => detectPlatform(input.value));
const canResolve = computed(() => Boolean(platform.value) && !isParsing.value);
function paste() { uni.getClipboardData({ success: ({ data }) => { input.value = data; }, fail: () => uni.showToast({ title: '请手动粘贴链接', icon: 'none' }) }); }
function resolve() { if (!canResolve.value) return; isParsing.value = true; setTimeout(() => { isParsing.value = false; uni.navigateTo({ url: `/pages/result/index?platform=${platform.value}&url=${encodeURIComponent(extractUrl(input.value) || '')}` }); }, 650); }
function goMe() { uni.switchTab({ url: '/pages/me/index' }); }
</script>

<template>
  <view class="screen">
    <view class="orb orb-one" /><view class="orb orb-two" />
    <view class="hero"><view class="eyebrow">LINK · MEDIA · HELPER</view><text class="title">AI素材助手</text><text class="subtitle">链接提取高清原图 / 视频素材</text></view>
    <view class="platform-panel"><text class="section-label">支持平台</text><view class="platforms"><view v-for="item in [['豆','豆包'],['抖','抖音'],['红','小红书'],['千','千问']]" :key="item[1]" class="platform"><view class="mark">{{ item[0] }}</view><text>{{ item[1] }}</text></view></view></view>
    <view class="resolve-card"><view class="card-top"><text>粘贴分享链接</text><text class="paste" @click="paste">粘贴</text></view><textarea v-model="input" :maxlength="4000" auto-height placeholder="粘贴豆包、抖音、小红书、千问分享链接或口令" /><view class="hint"><text v-if="platform">已识别：{{ platformNames[platform] }}</text><text v-else-if="input">暂不支持该链接</text><text v-else>自动识别，无需手动选择平台</text></view><button class="primary" :class="{ disabled: !canResolve }" :loading="isParsing" @click="resolve">{{ isParsing ? '正在解析素材…' : '一键提取素材' }}</button></view>
    <view class="quota"><view><text class="quota-number">10</text><text> 我的点数</text></view><text class="redeem" @click="goMe">兑换码 ›</text></view>
    <view class="recent"><text class="section-label">最近提取</text><view class="empty"><text class="empty-icon">✦</text><text>还没有提取记录</text><text class="empty-sub">粘贴一条分享链接开始吧</text></view></view>
  </view>
</template>

<style scoped>
.screen{min-height:100vh;padding:96rpx 36rpx 160rpx;box-sizing:border-box;position:relative;overflow:hidden}.orb{position:absolute;border-radius:50%;filter:blur(3px);opacity:.25}.orb-one{width:320rpx;height:320rpx;background:#a88cf8;right:-130rpx;top:-100rpx}.orb-two{width:220rpx;height:220rpx;background:#ffb8cc;left:-110rpx;top:350rpx}.hero,.platform-panel,.resolve-card,.quota,.recent{position:relative}.eyebrow,.section-label{font-size:21rpx;letter-spacing:2rpx;color:#8d87a1;font-weight:700}.title{display:block;font-family:serif;font-size:68rpx;letter-spacing:2rpx;margin-top:16rpx}.subtitle{display:block;margin-top:14rpx;color:#696374;font-size:28rpx}.platform-panel{background:#fff;border:1rpx solid #ecebf1;border-radius:32rpx;margin-top:62rpx;padding:30rpx}.platforms{display:flex;justify-content:space-between;margin-top:28rpx}.platform{font-size:22rpx;text-align:center;color:#4a4554}.mark{width:74rpx;height:74rpx;margin:0 auto 12rpx;display:grid;place-items:center;border-radius:24rpx;background:#f1edff;color:#6335e5;font-size:28rpx;font-weight:800}.resolve-card{margin-top:28rpx;background:#fff;border-radius:32rpx;padding:30rpx;box-shadow:0 18rpx 48rpx rgba(55,37,90,.08)}.card-top{display:flex;justify-content:space-between;font-size:28rpx;font-weight:700}.paste,.redeem{color:#6f3ff5}textarea{width:100%;min-height:142rpx;margin-top:24rpx;font-size:27rpx;line-height:1.6;color:#292431}.hint{font-size:22rpx;color:#928c9d;margin-top:16rpx;min-height:30rpx}.primary{margin-top:28rpx;border-radius:18rpx;background:#6f3ff5;color:#fff;font-size:30rpx;font-weight:700;height:96rpx;line-height:96rpx}.primary.disabled{opacity:.4}.quota{display:flex;justify-content:space-between;align-items:center;padding:32rpx 10rpx;font-size:25rpx}.quota-number{font-size:46rpx;font-weight:800;color:#6f3ff5}.recent{margin-top:18rpx}.empty{margin-top:22rpx;border:2rpx dashed #dedbe8;border-radius:28rpx;padding:50rpx;display:flex;flex-direction:column;align-items:center;color:#7f798c;font-size:26rpx}.empty-icon{font-size:44rpx;color:#b09aff;margin-bottom:8rpx}.empty-sub{font-size:22rpx;margin-top:8rpx;color:#a9a4b1}
</style>
