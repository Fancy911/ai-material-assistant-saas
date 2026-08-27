<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getMe, recordPaywallIntent, redeemCode } from '../../services/api';

const code = ref('');
const points = ref(0);
const total = ref(0);
async function load() { try { const me = await getMe(); points.value = me.pointsBalance; total.value = me.totalResolves; } catch { uni.showToast({ title: '无法加载账户', icon: 'none' }); } }
async function redeem() { if (!code.value.trim()) return uni.showToast({ title: '请输入兑换码', icon: 'none' }); try { const result = await redeemCode(code.value); points.value = result.pointsBalance; code.value = ''; uni.showToast({ title: `成功获得 ${result.pointsAdded} 点`, icon: 'none' }); } catch { uni.showToast({ title: '兑换码不可用或已被使用', icon: 'none' }); } }
async function intent() { await recordPaywallIntent('20-points'); uni.showToast({ title: '已记录开通意向', icon: 'none' }); }
onMounted(load);
</script>

<template>
  <view class="page">
    <view class="topbar"><view><text class="eyebrow">YOUR MATERIAL SPACE</text><text class="title">我的</text></view><view class="avatar">材</view></view>
    <view class="balance"><text class="balance-label">当前可用点数</text><view class="balance-row"><b>{{ points }}</b><text>点</text></view><view class="balance-foot"><text>累计已提取 {{ total }} 次</text><text>免费内测用户</text></view></view>
    <view class="section"><text class="section-title">兑换点数</text><view class="redeem-card"><text class="redeem-copy">输入兑换码，立即补充使用次数</text><view class="redeem-row"><input v-model="code" placeholder="输入兑换码" placeholder-class="placeholder"/><button @click="redeem">兑换</button></view></view></view>
    <view class="section"><text class="section-title">更多服务</text><view class="intent-card"><view><b>想要更多次数？</b><text>当前为免费内测，正式付费暂未开放。</text></view><button @click="intent">我想开通</button></view></view>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(34rpx + var(--status-bar-height)) 36rpx 56rpx;box-sizing:border-box;background:var(--canvas)}.topbar{height:128rpx;display:flex;justify-content:space-between;align-items:center}.eyebrow{display:block;color:var(--muted);font-size:20rpx;letter-spacing:2rpx;font-weight:700}.title{display:block;margin-top:12rpx;font-family:serif;font-size:50rpx;font-weight:800}.avatar{width:72rpx;height:72rpx;display:grid;place-items:center;border-radius:25rpx;background:var(--violet);color:#fff;font-size:30rpx;font-weight:800;box-shadow:0 12rpx 30rpx rgba(111,63,245,.24)}.balance{margin-top:25rpx;padding:34rpx;border-radius:32rpx;background:var(--violet-deep);color:#fff;box-shadow:0 18rpx 44rpx rgba(56,36,91,.2)}.balance-label{font-size:23rpx;color:#dcd1fa}.balance-row{display:flex;align-items:baseline;gap:10rpx;margin-top:12rpx}.balance-row b{font-size:84rpx;line-height:1;font-family:serif}.balance-row text{font-size:26rpx;color:#dcd1fa}.balance-foot{display:flex;justify-content:space-between;margin-top:24rpx;padding-top:20rpx;border-top:1rpx solid rgba(255,255,255,.18);color:#dcd1fa;font-size:22rpx}.section{margin-top:38rpx}.section-title{display:block;margin:0 4rpx 16rpx;font-size:27rpx;font-weight:800}.redeem-card,.intent-card{border:1rpx solid var(--line);border-radius:28rpx;background:var(--surface);box-shadow:0 10rpx 28rpx rgba(44,33,67,.04)}.redeem-card{padding:28rpx}.redeem-copy{display:block;color:var(--muted);font-size:22rpx}.redeem-row{display:flex;gap:16rpx;margin-top:22rpx}.redeem-row input{min-width:0;flex:1;padding:0 22rpx;height:82rpx;border-radius:18rpx;background:#f5f3f9;font-size:25rpx}.placeholder{color:#aaa4b3}.redeem-row button,.intent-card button{margin:0;border-radius:18rpx;font-weight:700}.redeem-row button{width:128rpx;height:82rpx;line-height:82rpx;background:var(--violet);color:#fff;font-size:25rpx}.intent-card{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:28rpx}.intent-card view{display:flex;flex-direction:column;gap:9rpx}.intent-card b{font-size:27rpx}.intent-card text{color:var(--muted);font-size:21rpx}.intent-card button{padding:0 22rpx;height:66rpx;line-height:66rpx;white-space:nowrap;background:var(--violet-soft);color:var(--violet);font-size:22rpx}
</style>
