import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import HomeLanding from './components/home/HomeLanding.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('HomeLanding', HomeLanding);
  },
};
