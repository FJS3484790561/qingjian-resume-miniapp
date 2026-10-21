<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
onLaunch(() => {})
</script>

<style lang="scss">
@import './styles/tokens.scss';
@import './styles/studio.scss';
@import './styles/qingyu.scss';
page { height: 100%; background: #f0f2f0; color: #263b34; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
view, text, input, textarea, button, scroll-view { box-sizing: border-box; }
button::after { border: none; }
button { margin: 0; padding: 0; line-height: inherit; font: inherit; border-radius: 0; }
/* #ifdef H5 */
uni-page-body, #app { height: 100%; }
uni-button::after { border: none !important; }
button, [role='button'] { cursor: pointer; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent, #346c56); outline-offset: 3px; }
/* #endif */
</style>
