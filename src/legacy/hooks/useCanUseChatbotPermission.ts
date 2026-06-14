// @ts-nocheck
import { CAN_USE_CHATBOT_PERMISSION_KEY } from '../utils/effectivePermissions'
import { useEffectivePermissionKey } from './useEffectivePermissionKey'

export function useCanUseChatbotPermission() {
  return useEffectivePermissionKey(CAN_USE_CHATBOT_PERMISSION_KEY)
}
