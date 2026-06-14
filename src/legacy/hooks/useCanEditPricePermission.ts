// @ts-nocheck
import { CAN_EDIT_PRICE_PERMISSION_KEY } from '../utils/effectivePermissions'
import { useEffectivePermissionKey } from './useEffectivePermissionKey'

export function useCanEditPricePermission() {
  return useEffectivePermissionKey(CAN_EDIT_PRICE_PERMISSION_KEY)
}
