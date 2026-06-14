// @ts-nocheck
import { CAN_VOID_PERMISSION_KEY } from '../utils/effectivePermissions'
import { useEffectivePermissionKey } from './useEffectivePermissionKey'

export function useCanVoidPermission() {
  return useEffectivePermissionKey(CAN_VOID_PERMISSION_KEY)
}
