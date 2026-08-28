import type { IotDeviceGroup } from '@zenith/shared/iot';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { iotDeviceKeys } from './iot-devices';

export interface IotDeviceGroupListParams extends CrudListParams {
  keyword?: string;
}

export const {
  keys: iotGroupKeys,
  useList: useIotGroupList,
  useDetail: useIotGroupDetail,
  useSave: useSaveIotGroup,
  useDelete: useDeleteIotGroups,
  useLookup: useAllIotGroups,
} = createCrudQueries<IotDeviceGroup, IotDeviceGroupListParams, Partial<IotDeviceGroup>>({
  resource: 'iot-groups',
  path: '/api/iot/groups',
  deleteMode: 'single',
  lookup: true,
  // 分组成员变更影响设备列表的「所属分组」列
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists }),
});
