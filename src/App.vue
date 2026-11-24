<script>
import { installKeyboardSupport } from './lib/keyboard.js'

export default {
  onLaunch() {
    // #ifdef H5
    installKeyboardSupport()
    // #endif
  },
}
</script>

<style>
@import './styles/icons.css';
@import './styles/base.css';
</style>
