// @ts-nocheck
import { CAN_DELETE_PERMISSION_KEY } from '../utils/effectivePermissions'
import { useEffectivePermissionKey } from './useEffectivePermissionKey'

export function useCanDeletePermission() {
  return useEffectivePermissionKey(CAN_DELETE_PERMISSION_KEY)
}
