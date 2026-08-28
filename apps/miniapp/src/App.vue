<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
onLaunch(() => { /* app lifecycle reserved for session restoration */ });
</script>
<style>
page {
  --ink: #172033;
  --muted: #70809a;
  --canvas: #f7faff;
  --surface: #ffffff;
  --line: #e8eef8;
  --violet: #2878f0;
  --violet-soft: #eaf2ff;
  --violet-deep: #163d72;
  --warm: #f59a4a;
  background: var(--canvas);
  color: var(--ink);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
button::after { border: 0; }
</style>
