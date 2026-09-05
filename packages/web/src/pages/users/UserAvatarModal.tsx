import { useRef, useState } from 'react';
import { Button, Spin, Toast } from '@douyinfe/semi-ui';
import { AppModal } from '@/components/AppModal';
import { AvatarCropperModal } from '@/components/AvatarCropperModal';
import { PresetAvatarPickerModal } from '@/components/PresetAvatarPickerModal';
import { userContract, type User } from '@zenith/shared/identity';
import { fileContract } from '@zenith/shared/platform';
import { useApiMutation } from '@/lib/contract-query';
import { UserAvatar } from '@/components/UserAvatar';
import { confirmDelete } from '@/utils/confirm';

interface UserAvatarModalProps {
  readonly visible: boolean;
  readonly user: User;
  readonly onClose: () => void;
  readonly onUpdated: (user: User) => void;
}

export function UserAvatarModal({ visible, user, onClose, onUpdated }: UserAvatarModalProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [presetVisible, setPresetVisible] = useState(false);
  // 失败提示由调用处按场景给出，请求层静默；code !== 0 由 api() 抛 ApiError
  const uploadAvatarMutation = useApiMutation(fileContract.uploadOne, { requestOptions: { silent: true } });
  const updateAvatarMutation = useApiMutation(userContract.update, { requestOptions: { silent: true } });
  const updateAvatar = (avatar: string | null) => updateAvatarMutation.mutateAsync({ params: { id: user.id }, body: { avatar } });
  const avatarLoading = uploadAvatarMutation.isPending || updateAvatarMutation.isPending;

  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    e.target.value = '';
  }

  async function handleCropConfirm(blob: Blob) {
    const formData = new FormData();
    formData.append('file', blob, 'avatar.jpg');
    let uploadedUrl: string;
    try {
      uploadedUrl = (await uploadAvatarMutation.mutateAsync({ body: formData })).url;
    } catch (err) {
      Toast.error(err instanceof Error && err.message ? err.message : '上传失败');
      return;
    }
    try {
      onUpdated(await updateAvatar(uploadedUrl));
      Toast.success('头像已更新');
      setCropFile(null);
      onClose();
    } catch (err) {
      Toast.error(err instanceof Error && err.message ? err.message : '头像更新失败');
    }
  }

  async function handleApplyPreset(url: string) {
    setPresetVisible(false);
    try {
      onUpdated(await updateAvatar(url));
      Toast.success('头像已更新');
      onClose();
    } catch (err) {
      Toast.error(err instanceof Error && err.message ? err.message : '更新失败');
    }
  }

  function handleRemoveAvatar() {
    confirmDelete({
      title: '确定要移除该用户头像吗？',
      content: '移除后将使用昵称缩写作为默认头像。',
      onOk: async () => {
        try {
          onUpdated(await updateAvatar(null));
          Toast.success('头像已移除');
          onClose();
        } catch (err) {
          Toast.error(err instanceof Error && err.message ? err.message : '移除失败');
        }
      },
    });
  }

  return (
    <>
      {/* 主弹窗 */}
      <AppModal
        title={`管理头像 — ${user.nickname || user.username}`}
        visible={visible}
        onCancel={onClose}
        footer={null}
        width={340}
        centered
        closeOnEsc
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0 16px' }}>
          {avatarLoading ? (
            <div style={{ width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin />
            </div>
          ) : (
            <UserAvatar
              name={user.nickname || user.username}
              avatar={user.avatar}
              semiSize="extra-large"
              size={96}
              style={{ fontSize: 32 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <Button
              block
              theme="light"
              loading={avatarLoading}
              onClick={() => avatarInputRef.current?.click()}
            >
              更换头像
            </Button>
            <Button
              block
              theme="borderless"
              onClick={() => setPresetVisible(true)}
            >
              选择预设头像
            </Button>
            {user.avatar && (
              <Button
                block
                theme="borderless"
                type="danger"
                loading={avatarLoading}
                onClick={handleRemoveAvatar}
              >
                移除头像
              </Button>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarFileSelect}
          />
        </div>
      </AppModal>

      {/* 预设头像 Modal */}
      <PresetAvatarPickerModal
        visible={presetVisible}
        currentAvatar={user.avatar}
        onCancel={() => setPresetVisible(false)}
        onSelect={(url) => void handleApplyPreset(url)}
      />

      {/* 裁剪 Modal */}
      <AvatarCropperModal
        file={cropFile}
        confirmLoading={avatarLoading}
        onCancel={() => setCropFile(null)}
        onConfirm={(blob) => void handleCropConfirm(blob)}
      />
    </>
  );
}
