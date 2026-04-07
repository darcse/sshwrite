'use client'

import { ProjectCard } from '@/components/ui/ProjectCard'
import { ProjectModal, type ProjectModalProject } from '@/components/ui/ProjectModal'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

type DashboardProject = ProjectModalProject & {
  place_image_url?: string | null
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingProject, setEditingProject] = useState<ProjectModalProject | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    if (!user) {
      setProjects([])
      setListLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('write_projects')
      .select('id, title, description, cover_color, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setListLoading(false)
    if (error) {
      setProjects([])
      return
    }
    const base = (data ?? []) as DashboardProject[]
    if (base.length === 0) {
      setProjects([])
      return
    }
    const projectIds = base.map((p) => p.id)
    const { data: placeRows } = await supabase
      .from('write_characters')
      .select('project_id, image_url, order_index')
      .eq('user_id', user.id)
      .eq('type', 'place')
      .in('project_id', projectIds)
      .not('image_url', 'is', null)
      .order('order_index', { ascending: true })
    const firstImageByProject = new Map<string, string>()
    ;(placeRows ?? []).forEach((row) => {
      const projectId = (row as { project_id?: string }).project_id
      const imageUrl = (row as { image_url?: string | null }).image_url
      if (!projectId || !imageUrl || firstImageByProject.has(projectId)) return
      firstImageByProject.set(projectId, imageUrl)
    })
    setProjects(
      base.map((p) => ({
        ...p,
        place_image_url: firstImageByProject.get(p.id) ?? null,
      }))
    )
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  function openCreate() {
    setModalMode('create')
    setEditingProject(null)
    setModalOpen(true)
  }

  function openEdit(p: ProjectModalProject) {
    setModalMode('edit')
    setEditingProject(p)
    setModalOpen(true)
  }

  async function handleDelete(p: ProjectModalProject) {
    if (!window.confirm(`「${p.title}」 프로젝트를 삭제할까요? 하위 문서도 함께 삭제됩니다.`)) {
      return
    }
    setDeletingId(p.id)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDeletingId(null)
      return
    }
    const { error } = await supabase
      .from('write_projects')
      .delete()
      .eq('id', p.id)
      .eq('user_id', user.id)
    setDeletingId(null)
    if (!error) {
      await loadProjects()
    }
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-8 bg-[var(--background)] px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="page-title">Projects</h1>
        {userId ? (
          <button
            type="button"
            onClick={openCreate}
            className="btn-apple btn-apple-primary shrink-0 px-5 py-2.5 text-sm font-semibold"
          >
            새 프로젝트
          </button>
        ) : null}
      </div>

      {!userId && !listLoading ? (
        <p className="text-sm text-[var(--muted)]">프로젝트를 보려면 로그인해 주세요.</p>
      ) : null}

      {listLoading ? (
        <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
      ) : userId && projects.length === 0 ? (
        <div className="empty-state-apple flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="text-[var(--foreground)]">아직 프로젝트가 없습니다.</p>
          <p className="text-sm text-[var(--muted)]">새 프로젝트를 만들어 보세요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                project={p}
                deleting={deletingId === p.id}
                onEdit={() => openEdit(p)}
                onDelete={() => handleDelete(p)}
              />
            </li>
          ))}
        </ul>
      )}

      <ProjectModal
        open={modalOpen}
        mode={modalMode}
        project={modalMode === 'edit' ? editingProject : null}
        onClose={() => setModalOpen(false)}
        onSaved={loadProjects}
      />
    </main>
  )
}
