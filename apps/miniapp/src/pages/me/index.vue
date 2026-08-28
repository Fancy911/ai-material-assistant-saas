<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getMe, recordPaywallIntent, redeemCode } from '../../services/api';

const code = ref('');
const points = ref(0);
const total = ref(0);
const today = ref(0);
const pointCost = ref(1);
const serviceActive = ref(false);
const notice = ref('');
async function load() { try { const me = await getMe(); points.value = me.pointsBalance; total.value = me.totalResolves; today.value = me.todayResolves; pointCost.value = me.pointCost; serviceActive.value = me.service.canResolve; notice.value = me.notice || ''; } catch { uni.showToast({ title: '无法加载账户', icon: 'none' }); } }
async function redeem() { if (!code.value.trim()) return uni.showToast({ title: '请输入兑换码', icon: 'none' }); try { const result = await redeemCode(code.value); points.value = result.pointsBalance; code.value = ''; uni.showToast({ title: `成功获得 ${result.pointsAdded} 点`, icon: 'none' }); } catch { uni.showToast({ title: '兑换码不可用或已被使用', icon: 'none' }); } }
async function intent() { await recordPaywallIntent('20-points'); uni.showToast({ title: '已记录开通意向', icon: 'none' }); }
onMounted(load);
</script>

<template>
  <view class="page">
    <view class="topbar"><view><text class="eyebrow">MY WORKSPACE</text><text class="title">我的空间</text><text class="subtitle">管理你的素材提取权益</text></view><view class="avatar">AI</view></view>
    <view class="balance"><view class="balance-top"><view><text class="balance-label">当前可用次数</text><view class="balance-row"><b>{{ points }}</b><text>次</text></view></view><view class="balance-icon">✦</view></view><view class="balance-foot"><text>累计已提取 {{ total }} 次 · 今日 {{ today }} 次</text><text>每次消耗 {{ pointCost }} 次</text></view></view>
    <view class="service-state" :class="{ active: serviceActive }"><text>{{ serviceActive ? '服务已开通，可正常提取' : '服务尚未开通，请联系运营方' }}</text></view>
    <view v-if="notice" class="notice"><text>{{ notice }}</text></view>
    <view class="section"><view class="section-head"><text class="section-title">兑换点数</text><text>兑换码即时到账</text></view><view class="redeem-card"><text class="redeem-copy">输入兑换码，补充素材提取次数</text><view class="redeem-row"><input v-model="code" placeholder="输入兑换码" placeholder-class="placeholder"/><button @click="redeem">兑换</button></view></view></view>
    <view class="section"><view class="section-head"><text class="section-title">更多服务</text></view><view class="intent-card"><view class="intent-copy"><b>想要更多次数？</b><text>当前为免费内测，正式付费服务即将开放。</text></view><button @click="intent">我想开通</button></view></view>
  </view>
</template>

<style scoped>
.page{min-height:100vh;padding:calc(38rpx + var(--status-bar-height)) 32rpx 190rpx;box-sizing:border-box;background:var(--canvas)}.topbar{display:flex;justify-content:space-between;align-items:flex-start}.eyebrow{display:block;color:#8a71c5;font-size:20rpx;letter-spacing:2rpx;font-weight:800}.title{display:block;margin-top:10rpx;color:var(--ink);font-size:48rpx;line-height:1.2;font-weight:800;letter-spacing:-1rpx}.subtitle{display:block;margin-top:11rpx;color:var(--muted);font-size:24rpx}.avatar{width:70rpx;height:70rpx;margin-top:5rpx;display:grid;place-items:center;border-radius:24rpx;background:#eee9ff;color:var(--violet);font-size:24rpx;font-weight:800}.balance{margin-top:42rpx;padding:31rpx 30rpx 25rpx;border:1rpx solid #ded2fb;border-radius:30rpx;background:linear-gradient(135deg,#f8f5ff,#eee7ff);color:#412a79;box-shadow:0 17rpx 36rpx rgba(75,47,134,.1)}.balance-top{display:flex;align-items:flex-start;justify-content:space-between}.balance-label{display:block;color:#806aa8;font-size:22rpx}.balance-row{display:flex;align-items:baseline;gap:10rpx;margin-top:12rpx}.balance-row b{font-size:78rpx;line-height:1;font-weight:800;letter-spacing:-2rpx}.balance-row text{font-size:25rpx;color:#806aa8}.balance-icon{width:58rpx;height:58rpx;display:grid;place-items:center;border-radius:19rpx;background:#fff;color:var(--violet);font-size:26rpx;box-shadow:0 7rpx 18rpx rgba(77,43,143,.1)}.balance-foot{display:flex;justify-content:space-between;margin-top:25rpx;padding-top:19rpx;border-top:1rpx solid #dfd4f7;color:#8b75af;font-size:21rpx}.service-state,.notice{margin-top:18rpx;padding:16rpx 20rpx;border-radius:17rpx;background:#fff3dd;color:#9b6718;font-size:21rpx}.service-state.active{background:#e8f8ef;color:#27754a}.notice{background:#f1edff;color:#7257b2}.section{margin-top:39rpx}.section-head{display:flex;align-items:center;justify-content:space-between;margin:0 4rpx 16rpx;color:var(--muted);font-size:20rpx}.section-title{color:var(--ink);font-size:28rpx;font-weight:800}.redeem-card{padding:26rpx;border:1rpx solid #e9e3f1;border-radius:25rpx;background:rgba(255,255,255,.74)}.redeem-copy{display:block;color:var(--muted);font-size:22rpx}.redeem-row{display:flex;gap:14rpx;margin-top:21rpx}.redeem-row input{min-width:0;flex:1;padding:0 20rpx;height:82rpx;border-radius:17rpx;background:#f7f4fb;color:var(--ink);font-size:25rpx}.placeholder{color:#aaa2b7}.redeem-row button{width:124rpx;height:82rpx;line-height:82rpx;margin:0;border-radius:17rpx;background:var(--violet);color:#fff;font-size:25rpx;font-weight:700}.intent-card{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:27rpx 4rpx;border-top:1rpx solid var(--line);border-bottom:1rpx solid var(--line)}.intent-copy{min-width:0;display:flex;flex-direction:column;gap:9rpx}.intent-copy b{color:#393142;font-size:27rpx}.intent-copy text{color:var(--muted);font-size:21rpx;line-height:1.45}.intent-card button{margin:0;padding:0 19rpx;height:66rpx;line-height:66rpx;white-space:nowrap;border-radius:15rpx;background:var(--violet-soft);color:var(--violet);font-size:22rpx;font-weight:700}
</style>
