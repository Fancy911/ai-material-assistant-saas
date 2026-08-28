<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
onLaunch(() => { /* app lifecycle reserved for session restoration */ });
</script>
<style>
page {
  --ink: #282231;
  --muted: #878092;
  --canvas: #f8f7fc;
  --surface: #ffffff;
  --line: #ebe7f1;
  --violet: #6f3ff5;
  --violet-soft: #eee9ff;
  --violet-deep: #38245b;
  --warm: #df8a51;
  background: var(--canvas);
  color: var(--ink);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
button::after { border: 0; }
</style>
