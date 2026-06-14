// @ts-nocheck
import { CAN_FILTER_DASHBOARD_PERMISSION_KEY } from '../utils/effectivePermissions'
import { useEffectivePermissionKey } from './useEffectivePermissionKey'

export function useCanFilterDashboardPermission() {
  return useEffectivePermissionKey(CAN_FILTER_DASHBOARD_PERMISSION_KEY)
}
