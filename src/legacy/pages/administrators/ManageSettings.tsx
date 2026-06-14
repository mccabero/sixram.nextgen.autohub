// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Image as ImageIcon, Monitor, UploadCloud, Trash2, Loader2, Settings as SettingsIcon, RefreshCw, Building2, Save, Clock, Camera } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import {
  getLoginSettings,
  updateLoginSettings,
  uploadLoginBackground,
  uploadLoginLogo,
  deleteLoginBackground,
  deleteLoginLogo,
  getHikvisionCameraSettings,
  updateHikvisionCameraSettings,
  testHikvisionSnapshotSettings,
} from '../../services/adminService'
import { useCanDeletePermission } from '../../hooks/useCanDeletePermission'

type LoginSettingsState = {
  companyName: string
  showIsChanganOption: boolean
  cameraEventCooldownSeconds: number
  backgroundImageUrl: string
  logoUrl: string
}

type CameraSnapshotSettingsState = {
  snapshotCaptureEnabled: boolean
  cameraIp: string
  username: string
  password: string
  snapshotChannel: string
  passwordConfigured: boolean
}

const EMPTY_STATE: LoginSettingsState = {
  companyName: '',
  showIsChanganOption: true,
  cameraEventCooldownSeconds: 60,
  backgroundImageUrl: '',
  logoUrl: '',
}

const EMPTY_CAMERA_STATE: CameraSnapshotSettingsState = {
  snapshotCaptureEnabled: false,
  cameraIp: '',
  username: 'admin',
  password: '',
  snapshotChannel: '101',
  passwordConfigured: false,
}

const LOGIN_SETTINGS_UPDATED_EVENT = 'login-settings-updated'

function notifyLoginSettingsUpdated(settings: LoginSettingsState) {
  try {
    window.dispatchEvent(new CustomEvent(LOGIN_SETTINGS_UPDATED_EVENT, { detail: settings }))
  } catch {}
}

function parseBooleanSetting(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function parseCooldownSeconds(value: unknown, fallback = 60) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(3600, Math.round(parsed))) : fallback
}

export default function ManageSettings() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState<LoginSettingsState>(EMPTY_STATE)
  const [cameraSettings, setCameraSettings] = useState<CameraSnapshotSettingsState>(EMPTY_CAMERA_STATE)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [removingBackground, setRemovingBackground] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [testingSnapshot, setTestingSnapshot] = useState(false)
  const [testSnapshotUrl, setTestSnapshotUrl] = useState('')
  const canDelete = useCanDeletePermission()

  async function loadSettings(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true)
    else setLoading(true)

    try {
      const [loginResult, cameraResult] = await Promise.allSettled([
        getLoginSettings(),
        getHikvisionCameraSettings(),
      ])
      if (loginResult.status !== 'fulfilled') throw loginResult.reason

      const data: any = loginResult.value
      const nextSettings = {
        companyName: String(data?.companyName ?? ''),
        showIsChanganOption: parseBooleanSetting(data?.showIsChanganOption),
        cameraEventCooldownSeconds: parseCooldownSeconds(data?.cameraEventCooldownSeconds),
        backgroundImageUrl: String(data?.backgroundImageUrl ?? data?.backgroundUrl ?? ''),
        logoUrl: String(data?.logoUrl ?? ''),
      }
      setSettings(nextSettings)
      notifyLoginSettingsUpdated(nextSettings)

      if (cameraResult.status === 'fulfilled') {
        const cameraData: any = cameraResult.value
        setCameraSettings({
          snapshotCaptureEnabled: Boolean(cameraData?.snapshotCaptureEnabled),
          cameraIp: String(cameraData?.cameraIp ?? ''),
          username: String(cameraData?.username ?? 'admin') || 'admin',
          password: '',
          snapshotChannel: String(cameraData?.snapshotChannel ?? '101') || '101',
          passwordConfigured: Boolean(cameraData?.passwordConfigured),
        })
      } else if (!nextSettings.showIsChanganOption) {
        showToast('Failed to load camera settings: ' + (cameraResult.reason?.message || 'Unknown error'), 'error')
      }
    } catch (e: any) {
      showToast('Failed to load login settings: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  function validateImage(file: File | null) {
    if (!file) return false
    if (!file.type.startsWith('image/')) {
      showToast(`"${file.name}" is not an image`, 'error')
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(`"${file.name}" exceeds the 10 MB limit`, 'error')
      return false
    }
    return true
  }

  async function handleLogoSelected(file: File | null) {
    if (!validateImage(file)) return

    setUploadingLogo(true)
    try {
      const res: any = await uploadLoginLogo(file!)
      const nextSettings = {
        ...settings,
        logoUrl: String(res?.logoUrl ?? res?.url ?? settings.logoUrl ?? ''),
        backgroundImageUrl: String(res?.backgroundImageUrl ?? settings.backgroundImageUrl ?? ''),
      }
      setSettings(nextSettings)
      notifyLoginSettingsUpdated(nextSettings)
      showToast('Login logo updated', 'success')
    } catch (e: any) {
      showToast('Login logo upload failed: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleBackgroundSelected(file: File | null) {
    if (!validateImage(file)) return

    setUploadingBackground(true)
    try {
      const res: any = await uploadLoginBackground(file!)
      const nextSettings = {
        ...settings,
        backgroundImageUrl: String(res?.backgroundImageUrl ?? res?.url ?? settings.backgroundImageUrl ?? ''),
        logoUrl: String(res?.logoUrl ?? settings.logoUrl ?? ''),
      }
      setSettings(nextSettings)
      notifyLoginSettingsUpdated(nextSettings)
      showToast('Login background updated', 'success')
    } catch (e: any) {
      showToast('Login background upload failed: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setUploadingBackground(false)
    }
  }

  async function handleRemoveLogo() {
    if (!canDelete) {
      showToast('You are not allowed to delete records.', 'error')
      return
    }
    setRemovingLogo(true)
    try {
      await deleteLoginLogo()
      const nextSettings = { ...settings, logoUrl: '' }
      setSettings(nextSettings)
      notifyLoginSettingsUpdated(nextSettings)
      showToast('Login logo removed', 'success')
    } catch (e: any) {
      showToast('Failed to remove login logo: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setRemovingLogo(false)
    }
  }

  async function handleRemoveBackground() {
    if (!canDelete) {
      showToast('You are not allowed to delete records.', 'error')
      return
    }
    setRemovingBackground(true)
    try {
      await deleteLoginBackground()
      const nextSettings = { ...settings, backgroundImageUrl: '' }
      setSettings(nextSettings)
      notifyLoginSettingsUpdated(nextSettings)
      showToast('Login background removed', 'success')
    } catch (e: any) {
      showToast('Failed to remove login background: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setRemovingBackground(false)
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      const [res, cameraRes]: any[] = await Promise.all([
        updateLoginSettings({
          companyName: settings.companyName.trim(),
          showIsChanganOption: settings.showIsChanganOption,
          cameraEventCooldownSeconds: settings.cameraEventCooldownSeconds,
        }),
        settings.showIsChanganOption ? Promise.resolve(null) : updateHikvisionCameraSettings(buildCameraSettingsPayload()),
      ])
      const nextSettings = {
        ...settings,
        companyName: String(res?.companyName ?? ''),
        showIsChanganOption: parseBooleanSetting(res?.showIsChanganOption, settings.showIsChanganOption),
        cameraEventCooldownSeconds: parseCooldownSeconds(res?.cameraEventCooldownSeconds, settings.cameraEventCooldownSeconds),
        backgroundImageUrl: String(res?.backgroundImageUrl ?? settings.backgroundImageUrl ?? ''),
        logoUrl: String(res?.logoUrl ?? settings.logoUrl ?? ''),
      }
      setSettings(nextSettings)
      if (cameraRes) {
        setCameraSettings(prev => ({
          ...prev,
          snapshotCaptureEnabled: Boolean(cameraRes?.snapshotCaptureEnabled),
          cameraIp: String(cameraRes?.cameraIp ?? ''),
          username: String(cameraRes?.username ?? 'admin') || 'admin',
          password: '',
          snapshotChannel: String(cameraRes?.snapshotChannel ?? '101') || '101',
          passwordConfigured: Boolean(cameraRes?.passwordConfigured),
        }))
      }
      notifyLoginSettingsUpdated(nextSettings)
      showToast('Settings updated', 'success')
    } catch (e: any) {
      showToast('Failed to update settings: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  function buildCameraSettingsPayload() {
    const payload: {
      snapshotCaptureEnabled: boolean
      cameraIp: string
      username: string
      snapshotChannel: string
      password?: string
    } = {
      snapshotCaptureEnabled: cameraSettings.snapshotCaptureEnabled,
      cameraIp: cameraSettings.cameraIp.trim(),
      username: cameraSettings.username.trim(),
      snapshotChannel: cameraSettings.snapshotChannel.trim() || '101',
    }
    if (cameraSettings.password.trim()) payload.password = cameraSettings.password
    return payload
  }

  async function handleTestSnapshot() {
    setTestingSnapshot(true)
    setTestSnapshotUrl('')
    try {
      const res: any = await testHikvisionSnapshotSettings(buildCameraSettingsPayload())
      setTestSnapshotUrl(String(res?.imageDataUrl ?? ''))
      showToast('Snapshot captured', 'success')
    } catch (e: any) {
      showToast('Snapshot test failed: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setTestingSnapshot(false)
    }
  }

  const busy = uploadingLogo || uploadingBackground || removingLogo || removingBackground || refreshing || savingSettings || testingSnapshot
  const canSaveSettings = !savingSettings

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <SettingsIcon size={14} />
            Settings
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Manage Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Configure the login page background and logo. Uploaded images are stored in <span className="font-semibold text-slate-700 dark:text-slate-200">uploads/login</span> and apply automatically on the login screen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadSettings(true)}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Login page assets</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Recommended: wide image for the background, transparent PNG or WebP for the logo, a short company name for the sign-in card, and enable the IsChangan switch only when your team uses it.
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
            <Monitor size={14} />
            Updates are visible on the next visit to the login page
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Login Company Name</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Shown as the main heading on the login page.</p>
            </div>
          </div>

          {savingSettings && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Company Name</label>
              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-900/30">
                <Building2 size={18} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={e => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Enter company name for login page"
                  disabled={savingSettings}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Leave blank to fall back to the company name from Company Information.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Activate BOSCH</div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    When enabled, the POS operates in BOSCH mode. When disabled, it operates in GW Car Care mode.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, showIsChanganOption: !prev.showIsChanganOption }))}
                  disabled={savingSettings}
                  aria-pressed={settings.showIsChanganOption}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${settings.showIsChanganOption ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings.showIsChanganOption ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                Current: {settings.showIsChanganOption ? 'BOSCH mode enabled' : 'GW Car Care mode enabled'}
              </div>
            </div>

            {!settings.showIsChanganOption && (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/30">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <Clock size={18} className="mt-0.5 shrink-0 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Camera Event Cooldown</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          VMD active events from the same camera are ignored within this window.
                        </p>
                      </div>
                    </div>

                    <div className="w-full lg:w-44">
                      <label className="mb-2 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Seconds</label>
                      <input
                        type="number"
                        min={0}
                        max={3600}
                        step={1}
                        value={settings.cameraEventCooldownSeconds}
                        onChange={e => setSettings(prev => ({ ...prev, cameraEventCooldownSeconds: parseCooldownSeconds(e.target.value) }))}
                        disabled={savingSettings}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/30">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Hikvision Snapshot Capture</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Saves one camera image when a VMD active event passes cooldown.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCameraSettings(prev => ({ ...prev, snapshotCaptureEnabled: !prev.snapshotCaptureEnabled }))}
                        disabled={savingSettings}
                        aria-pressed={cameraSettings.snapshotCaptureEnabled}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${cameraSettings.snapshotCaptureEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${cameraSettings.snapshotCaptureEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-4">
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Camera IP</label>
                        <input
                          type="text"
                          value={cameraSettings.cameraIp}
                          onChange={e => setCameraSettings(prev => ({ ...prev, cameraIp: e.target.value }))}
                          placeholder="192.168.254.64"
                          disabled={savingSettings}
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Username</label>
                        <input
                          type="text"
                          value={cameraSettings.username}
                          onChange={e => setCameraSettings(prev => ({ ...prev, username: e.target.value }))}
                          disabled={savingSettings}
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                          Password{cameraSettings.passwordConfigured ? ' saved' : ''}
                        </label>
                        <input
                          type="password"
                          value={cameraSettings.password}
                          onChange={e => setCameraSettings(prev => ({ ...prev, password: e.target.value }))}
                          placeholder={cameraSettings.passwordConfigured ? 'Leave blank to keep' : 'Camera password'}
                          disabled={savingSettings}
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Channel</label>
                        <input
                          type="text"
                          value={cameraSettings.snapshotChannel}
                          onChange={e => setCameraSettings(prev => ({ ...prev, snapshotChannel: e.target.value }))}
                          disabled={savingSettings}
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={handleTestSnapshot}
                        disabled={busy || !cameraSettings.cameraIp.trim() || !cameraSettings.username.trim()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        {testingSnapshot ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        {testingSnapshot ? 'Testing...' : 'Test Snapshot'}
                      </button>

                      {testSnapshotUrl && (
                        <a href={testSnapshotUrl} target="_blank" rel="noreferrer" className="block h-20 w-32 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                          <img src={testSnapshotUrl} alt="Hikvision test snapshot" className="h-full w-full object-cover" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="lg:self-start lg:pt-[30px]">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!canSaveSettings}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              Save Settings
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                <ImageIcon size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Login Logo</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Displayed above the sign-in form.</p>
              </div>
            </div>

            {(uploadingLogo || removingLogo) && <Loader2 size={16} className="animate-spin text-slate-400" />}
          </div>

          <div className="mt-5 flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/30">
            {loading ? (
              <Loader2 size={24} className="animate-spin text-slate-400" />
            ) : settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Login logo" className="max-h-40 w-full object-contain" />
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  <ImageIcon size={24} />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">No login logo uploaded</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The login page will fall back to the company logo.</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              id="login-logo-input"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={e => {
                const file = e.target.files ? e.target.files[0] : null
                void handleLogoSelected(file)
                e.currentTarget.value = ''
              }}
              className="hidden"
            />
            <label
              htmlFor="login-logo-input"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${busy ? 'pointer-events-none cursor-not-allowed bg-violet-400' : 'cursor-pointer bg-violet-600 hover:bg-violet-700'} transition-colors`}
            >
              <UploadCloud size={16} />
              {settings.logoUrl ? 'Replace Logo' : 'Upload Logo'}
            </label>

            {canDelete && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={busy || !settings.logoUrl}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                <Monitor size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Login Background</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Full-page background behind the login card.</p>
              </div>
            </div>

            {(uploadingBackground || removingBackground) && <Loader2 size={16} className="animate-spin text-slate-400" />}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30">
            <div
              className="relative min-h-[280px] bg-cover bg-center"
              style={settings.backgroundImageUrl ? { backgroundImage: `url('${settings.backgroundImageUrl}')` } : undefined}
            >
              <div className={`absolute inset-0 ${settings.backgroundImageUrl ? 'bg-black/30' : 'bg-slate-100 dark:bg-slate-900/40'}`} />
              <div className="relative flex min-h-[280px] items-center justify-center p-6">
                {loading ? (
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                ) : settings.backgroundImageUrl ? (
                  <div className="rounded-2xl border border-white/20 bg-[#1c2530]/80 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
                    <div className="text-base font-semibold text-white">Login page preview</div>
                    <div className="mt-1 text-sm text-white/70">This background is now used on the sign-in screen.</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      <Monitor size={24} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">No custom background uploaded</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The login page will keep the default background image.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              id="login-background-input"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={e => {
                const file = e.target.files ? e.target.files[0] : null
                void handleBackgroundSelected(file)
                e.currentTarget.value = ''
              }}
              className="hidden"
            />
            <label
              htmlFor="login-background-input"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${busy ? 'pointer-events-none cursor-not-allowed bg-sky-400' : 'cursor-pointer bg-sky-600 hover:bg-sky-700'} transition-colors`}
            >
              <UploadCloud size={16} />
              {settings.backgroundImageUrl ? 'Replace Background' : 'Upload Background'}
            </label>

            {canDelete && (
              <button
                type="button"
                onClick={handleRemoveBackground}
                disabled={busy || !settings.backgroundImageUrl}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
