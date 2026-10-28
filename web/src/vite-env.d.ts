/// <reference types="vite/client" />

interface BootData {
  /** 管理后台路径，由服务端注入（ADMIN_PATH 可配置） */
  adminPath?: string
}

interface Window {
  __BOOT__?: BootData
}
