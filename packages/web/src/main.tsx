// ⚠️ 必须在最顶部导入，在任何 Semi 组件之前（React 19 兼容）
import '@douyinfe/semi-ui/react19-adapter';
// Semi 基础样式：构建时豁免了 semi barrel 的副作用标记（见 vite.config.ts treeshake），
// 其内联的 base.css 会被摇树裁剪，故在入口显式引入
import '@douyinfe/semi-ui/lib/es/_base/base.css';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/query';
import { AuthProvider } from './providers/AuthProvider';
import './styles/global.css';
import { enableMocking } from './mocks';

async function bootstrap() {
  await enableMocking();

  createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );
}


bootstrap();
