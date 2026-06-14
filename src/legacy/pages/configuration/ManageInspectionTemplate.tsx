// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ClipboardList, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import {
  cloneInspectionChecklistGroups,
  countInspectionChecklistItems,
  normalizeInspectionChecklistGroups,
  type InspectionChecklistGroup,
} from '../../utils/inspectionChecklist'

function createEmptyItem(id: number) {
  return {
    id,
    name: '',
    isRed: false,
    isAmber: false,
    isGreen: false,
    remarks: '',
  }
}

function normalizeEditorGroups(groups: InspectionChecklistGroup[]): InspectionChecklistGroup[] {
  return groups.map((group, groupIndex) => ({
    ...group,
    sequence: groupIndex + 1,
    detailsModelList: group.detailsModelList.map((item, itemIndex) => ({
      ...item,
      id: itemIndex + 1,
      isRed: false,
      isAmber: false,
      isGreen: false,
      remarks: '',
    })),
  }))
}

function createEmptyGroup(sequence: number): InspectionChecklistGroup {
  return {
    group: '',
    sequence,
    detailsModelList: [createEmptyItem(1)],
  }
}

export default function ManageInspectionTemplate() {
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const routeId = params.id
  const isAdd = routeId === 'add' || !routeId
  const duplicateId = searchParams.get('duplicateId')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [revision, setRevision] = useState(1)
  const [form, setForm] = useState({
    name: '',
    description: '',
    isActive: false,
    groups: [createEmptyGroup(1)] as InspectionChecklistGroup[],
  })

  useEffect(() => {
    let mounted = true

    async function loadTemplate() {
      if (isAdd && !duplicateId) return
      if (!routeId && !duplicateId) return
      setLoading(true)
      try {
        if (!isAdd && routeId) {
          const data: any = await configService.getInspectionChecklistTemplate(routeId)
          if (!mounted || !data) return
          setRevision(Number(data.revision ?? data.Revision ?? 1))
          setForm({
            name: String(data.name ?? data.Name ?? ''),
            description: String(data.description ?? data.Description ?? ''),
            isActive: !!(data.isActive ?? data.IsActive),
            groups: normalizeInspectionChecklistGroups(data.groups ?? data.Groups).length > 0
              ? normalizeEditorGroups(normalizeInspectionChecklistGroups(data.groups ?? data.Groups))
              : [createEmptyGroup(1)],
          })
          return
        }

        if (isAdd && duplicateId) {
          const data: any = await configService.getInspectionChecklistTemplate(duplicateId)
          if (!mounted || !data) return
          const duplicateGroups = normalizeInspectionChecklistGroups(data.groups ?? data.Groups)
          setRevision(1)
          setForm({
            name: `${String(data.name ?? data.Name ?? 'Inspection Template')} Copy`,
            description: String(data.description ?? data.Description ?? ''),
            isActive: false,
            groups: duplicateGroups.length > 0
              ? normalizeEditorGroups(cloneInspectionChecklistGroups(duplicateGroups))
              : [createEmptyGroup(1)],
          })
        }
      } catch (error: any) {
        showToast(error?.message || 'Failed to load inspection template', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadTemplate()
    return () => { mounted = false }
  }, [duplicateId, isAdd, routeId, showToast])

  const groupCount = form.groups.length
  const itemCount = useMemo(() => countInspectionChecklistItems(form.groups), [form.groups])

  const hasInvalidName = showValidation && !form.name.trim()
  const hasInvalidGroups = showValidation && form.groups.some(group =>
    !group.group.trim() || group.detailsModelList.length === 0 || group.detailsModelList.some(item => !item.name.trim())
  )

  function updateGroupName(groupIndex: number, value: string) {
    setForm(current => ({
      ...current,
      groups: current.groups.map((group, index) =>
        index === groupIndex ? { ...group, group: value } : group
      ),
    }))
  }

  function updateItemName(groupIndex: number, itemIndex: number, value: string) {
    setForm(current => ({
      ...current,
      groups: current.groups.map((group, index) => {
        if (index !== groupIndex) return group
        return {
          ...group,
          detailsModelList: group.detailsModelList.map((item, currentItemIndex) =>
            currentItemIndex === itemIndex ? { ...item, name: value } : item
          ),
        }
      }),
    }))
  }

  function addGroup() {
    setForm(current => ({
      ...current,
      groups: normalizeEditorGroups([...current.groups, createEmptyGroup(current.groups.length + 1)]),
    }))
  }

  function removeGroup(groupIndex: number) {
    setForm(current => {
      const nextGroups = current.groups.filter((_, index) => index !== groupIndex)
      return {
        ...current,
        groups: normalizeEditorGroups(nextGroups.length > 0 ? nextGroups : [createEmptyGroup(1)]),
      }
    })
  }

  function moveGroup(groupIndex: number, direction: -1 | 1) {
    setForm(current => {
      const nextIndex = groupIndex + direction
      if (nextIndex < 0 || nextIndex >= current.groups.length) return current
      const nextGroups = [...current.groups]
      ;[nextGroups[groupIndex], nextGroups[nextIndex]] = [nextGroups[nextIndex], nextGroups[groupIndex]]
      return { ...current, groups: normalizeEditorGroups(nextGroups) }
    })
  }

  function addItem(groupIndex: number) {
    setForm(current => ({
      ...current,
      groups: current.groups.map((group, index) => {
        if (index !== groupIndex) return group
        return {
          ...group,
          detailsModelList: normalizeEditorGroups([
            { ...group, detailsModelList: [...group.detailsModelList, createEmptyItem(group.detailsModelList.length + 1)] },
          ])[0].detailsModelList,
        }
      }),
    }))
  }

  function removeItem(groupIndex: number, itemIndex: number) {
    setForm(current => ({
      ...current,
      groups: current.groups.map((group, index) => {
        if (index !== groupIndex) return group
        const nextItems = group.detailsModelList.filter((_, currentItemIndex) => currentItemIndex !== itemIndex)
        return {
          ...group,
          detailsModelList: nextItems.length > 0
            ? nextItems.map((item, currentItemIndex) => ({ ...item, id: currentItemIndex + 1 }))
            : [createEmptyItem(1)],
        }
      }),
    }))
  }

  function moveItem(groupIndex: number, itemIndex: number, direction: -1 | 1) {
    setForm(current => ({
      ...current,
      groups: current.groups.map((group, index) => {
        if (index !== groupIndex) return group
        const nextIndex = itemIndex + direction
        if (nextIndex < 0 || nextIndex >= group.detailsModelList.length) return group
        const nextItems = [...group.detailsModelList]
        ;[nextItems[itemIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[itemIndex]]
        return {
          ...group,
          detailsModelList: nextItems.map((item, currentItemIndex) => ({ ...item, id: currentItemIndex + 1 })),
        }
      }),
    }))
  }

  function validate() {
    setShowValidation(true)
    if (!form.name.trim()) return false
    if (form.groups.length === 0) return false
    return !form.groups.some(group =>
      !group.group.trim()
      || group.detailsModelList.length === 0
      || group.detailsModelList.some(item => !item.name.trim())
    )
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) {
      showToast('Template name, section names, and checklist item names are required.', 'error')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        isActive: form.isActive,
        groups: normalizeEditorGroups(form.groups),
      }
      if (typeof currentUserId === 'number') {
        if (isAdd) {
          body.createdById = currentUserId
          body.updatedById = currentUserId
        } else {
          body.updatedById = currentUserId
        }
      }

      if (isAdd) {
        await configService.createInspectionChecklistTemplate(body)
      } else {
        await configService.updateInspectionChecklistTemplate(String(routeId), body)
      }

      showToast(isAdd ? 'Inspection template added' : 'Inspection template updated', 'success')
      navigate('/configuration/inspection-templates')
    } catch (error: any) {
      showToast(error?.message || 'Failed to save inspection template', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-card">
        Loading inspection template...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              {isAdd ? 'Add Inspection Template' : 'Manage Inspection Template'}
            </h2>
            {!isAdd && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Revision {revision}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Edit the checklist used for future inspections. Existing inspection records keep their own saved checklist snapshot.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <ShieldCheck size={18} />
          Snapshot-safe changes for historical inspections
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_22rem]">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ClipboardList size={16} />
                Template Details
              </div>
            </div>

            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Template Name <span className="text-rose-600">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Example: Standard PMS Inspection"
                  className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${
                    hasInvalidName ? 'border-rose-400' : 'border-slate-200'
                  }`}
                />
                {hasInvalidName && <div className="mt-1 text-sm text-rose-600">Template name is required.</div>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                  placeholder="Short note for admins about when to use this checklist template."
                  className="mt-2 min-h-[7rem] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Use as active template for new inspections</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Only one template stays active at a time. Changing the active template affects future inspections only.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Checklist Builder</div>
                <div className="mt-1 text-sm text-slate-500">Organize sections and checklist items the same way users will see them during inspection.</div>
              </div>
              <button
                onClick={addGroup}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <Plus size={16} />
                Add Section
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {form.groups.map((group, groupIndex) => {
                const groupInvalid = showValidation && !group.group.trim()
                return (
                  <div key={`${group.sequence}-${groupIndex}`} className={`rounded-2xl border ${groupInvalid ? 'border-rose-300' : 'border-slate-200'} bg-slate-50/80`}>
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sm font-semibold text-sky-700">
                          {groupIndex + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Section Name
                          </label>
                          <input
                            value={group.group}
                            onChange={event => updateGroupName(groupIndex, event.target.value)}
                            placeholder="Example: Brakes"
                            className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${
                              groupInvalid ? 'border-rose-400' : 'border-slate-200'
                            }`}
                          />
                          {groupInvalid && <div className="mt-1 text-sm text-rose-600">Section name is required.</div>}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => moveGroup(groupIndex, -1)}
                          disabled={groupIndex === 0}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Move section ${groupIndex + 1} up`}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          onClick={() => moveGroup(groupIndex, 1)}
                          disabled={groupIndex === form.groups.length - 1}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Move section ${groupIndex + 1} down`}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          onClick={() => removeGroup(groupIndex)}
                          className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50"
                          aria-label={`Delete section ${groupIndex + 1}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 px-4 py-4">
                      {group.detailsModelList.map((item, itemIndex) => {
                        const itemInvalid = showValidation && !item.name.trim()
                        return (
                          <div key={`${group.sequence}-${item.id}-${itemIndex}`} className={`rounded-xl border bg-white px-3 py-3 ${itemInvalid ? 'border-rose-300' : 'border-slate-200'}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                                  {itemIndex + 1}
                                </span>
                                <input
                                  value={item.name}
                                  onChange={event => updateItemName(groupIndex, itemIndex, event.target.value)}
                                  placeholder="Checklist item"
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => moveItem(groupIndex, itemIndex, -1)}
                                  disabled={itemIndex === 0}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Move item ${itemIndex + 1} up`}
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  onClick={() => moveItem(groupIndex, itemIndex, 1)}
                                  disabled={itemIndex === group.detailsModelList.length - 1}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Move item ${itemIndex + 1} down`}
                                >
                                  <ArrowDown size={15} />
                                </button>
                                <button
                                  onClick={() => removeItem(groupIndex, itemIndex)}
                                  className="rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                                  aria-label={`Delete item ${itemIndex + 1}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                            {itemInvalid && <div className="mt-2 text-sm text-rose-600">Checklist item name is required.</div>}
                          </div>
                        )
                      })}

                      <button
                        onClick={() => addItem(groupIndex)}
                        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                      >
                        <Plus size={15} />
                        Add Item
                      </button>
                    </div>
                  </div>
                )
              })}

              {hasInvalidGroups && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Every section needs a name, and every checklist item needs a label before the template can be saved.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card xl:sticky xl:top-6">
            <div className="text-sm font-semibold text-slate-800">Template Summary</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{groupCount}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist Items</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{itemCount}</div>
              </div>
              <div className="rounded-2xl bg-sky-50 px-4 py-4 text-sky-900">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">Future-proofing</div>
                <div className="mt-2 text-sm leading-6">
                  New inspections use the active template. Saved inspections keep the JSON snapshot already stored on their own record.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-4">
        <button
          onClick={() => navigate('/configuration/inspection-templates')}
          className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded text-sm text-white ${saving ? 'bg-sky-400 cursor-not-allowed' : 'bg-bosch-blue hover:opacity-90'}`}
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
