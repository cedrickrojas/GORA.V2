import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

import { IonicVue } from '@ionic/vue';

import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

import './theme/variables.css';
import './theme/responsive.css';
import './theme/keyboard.css';

// The shared viewport handler also covers native HTML inputs and overlay forms.
const app = createApp(App).use(IonicVue, { scrollAssist: false, scrollPadding: false }).use(createPinia()).use(router);

router.isReady().then(() => {
  app.mount('#app');
});
