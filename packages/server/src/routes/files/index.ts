import { defineRouteDomain } from '../_kit';
import businessFilesRoutes from './business-files';
import fileStorageConfigsRoutes from './file-storage-configs';
import filesRoutes from './files';

export default defineRouteDomain({
  name: 'files',
  mounts: () => [
    ['/api/file-storage-configs', fileStorageConfigsRoutes],
    ['/api/files', filesRoutes],
    ['/api/business-files', businessFilesRoutes],
  ],
});
