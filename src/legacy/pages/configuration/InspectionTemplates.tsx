// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Sparkles } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import configService from '../../services/configService'
import { EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions } from '../../components/lists'
import type { InspectionChecklistTemplateSummary } from '../../utils/inspectionChecklist'

export default function InspectionTemplates() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<InspectionChecklistTemplateSummary[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InspectionChecklistTemplateSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activatingId, setActivatingId] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    configService.getInspectionChecklistTemplates()
      .then((data: any) => {
        if (!mounted || !Array.isArray(data)) return
        setTemplates(
          data.map((item: any) => ({
            id: Number(item.id ?? item.Id ?? 0),
            name: String(item.name ?? item.Name ?? ''),
            description: String(item.description ?? item.Description ?? ''),
            revision: Number(item.revision ?? item.Revision ?? 1),
            isActive: !!(item.isActive ?? item.IsActive),
            groupCount: Number(item.groupCount ?? item.GroupCount ?? 0),
            itemCount: Number(item.itemCount ?? item.ItemCount ?? 0),
            updatedDateTime: String(item.updatedDateTime ?? item.UpdatedDateTime ?? ''),
            createdDateTime: String(item.createdDateTime ?? item.CreatedDateTime ?? ''),
          }))
        )
      })
      .catch((error: any) => {
        showToast(error?.message || 'Failed to load inspection templates', 'error')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [showToast])

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return templates
    return templates.filter(template =>
      template.name.toLowerCase().includes(query)
      || String(template.description ?? '').toLowerCase().includes(query)
    )
  }, [searchTerm, templates])

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  const activeTemplate = useMemo(
    () => templates.find(template => template.isActive) ?? null,
    [templates]
  )

  function openDelete(template: InspectionChecklistTemplateSummary) {
    setDeleteTarget(template)
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await configService.deleteInspectionChecklistTemplate(String(deleteTarget.id))
      setTemplates(current => current.filter(template => template.id !== deleteTarget.id))
      showToast('Inspection template deleted', 'success')
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete inspection template', 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    }
  }

  async function activateTemplate(template: InspectionChecklistTemplateSummary) {
    setActivatingId(template.id)
    try {
      const updated: any = await configService.activateInspectionChecklistTemplate(String(template.id))
      const activeId = Number(updated?.id ?? updated?.Id ?? template.id)
      setTemplates(current => current.map(item => ({
        ...item,
        isActive: item.id === activeId,
      })))
      showToast(`"${template.name}" is now active for new inspections`, 'success')
    } catch (error: any) {
      showToast(error?.message || 'Failed to activate inspection template', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  function formatDate(value?: string) {
    if (!value) return 'Recently updated'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
      ? 'Recently updated'
      : parsed.toLocaleString()
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={ClipboardList}
        title="Inspection Templates"
        subtitle="Manage the checklist templates used for future vehicle inspections without disturbing saved historical inspections."
        addLabel="Add Template"
        onAdd={() => navigate('/configuration/inspection-templates/add')}
        stats={[
          { label: 'Templates', value: templates.length },
          { label: 'Active', value: activeTemplate?.name || 'None' },
        ]}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete inspection template"
        message={`Delete "${deleteTarget?.name ?? 'this template'}"? Historical inspections will keep their saved checklist snapshot.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false)
          setDeleteTarget(null)
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <Sparkles size={14} />
              Existing inspections keep the checklist JSON already stored on the record.
            </div>
          }
          right={
            <ListSearchInput
              value={searchTerm}
              onChange={(value) => { setSearchTerm(value); setPage(0) }}
              placeholder="Search template name or description..."
            />
          }
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Revision</th>
                <th className="px-5 py-3">Coverage</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={ClipboardList} colSpan={6} />}
              {paged.map(template => (
                <tr key={template.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => navigate(`/configuration/inspection-templates/${template.id}`)} className="group text-left transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                          <ClipboardList size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {template.name}
                          </div>
                          {!!template.description && (
                            <div className="mt-0.5 max-w-[32rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">
                      Rev {template.revision}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">
                    {template.groupCount} sections, {template.itemCount} items
                  </td>
                  <td className="px-5 py-4 align-middle">
                    {template.isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <CheckCircle2 size={14} />
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => activateTemplate(template)}
                        disabled={activatingId === template.id}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-300"
                      >
                        {activatingId === template.id ? 'Activating...' : 'Make Active'}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(template.updatedDateTime)}
                  </td>
                  <td className="px-5 py-4 align-middle text-right">
                    <div className="flex items-center justify-end gap-2">
                      <RowActions
                        actions={[
                          { kind: 'duplicate', onClick: () => navigate(`/configuration/inspection-templates/add?duplicateId=${template.id}`), label: `duplicate-${template.id}` },
                          { kind: 'edit', onClick: () => navigate(`/configuration/inspection-templates/${template.id}`), label: `edit-${template.id}` },
                          { kind: 'delete', onClick: () => openDelete(template), label: `delete-${template.id}` },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ListPagination
          page={page}
          pageCount={pageCount}
          rowsPerPage={rowsPerPage}
          total={filtered.length}
          onPageChange={setPage}
          onRowsPerPageChange={(value) => { setRowsPerPage(value); setPage(0) }}
        />
      </div>
    </div>
  )
}
