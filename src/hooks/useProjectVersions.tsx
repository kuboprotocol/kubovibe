import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface ProjectVersion {
  id: string
  project_id: string
  version_number: number
  title: string
  description: string | null
  published_at: string
}

export function useProjectVersions(projectId: string | undefined) {
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [loading, setLoading] = useState(false)

  const fetchVersions = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('project_versions' as any)
      .select('id, project_id, version_number, title, description, published_at')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
    if (error) console.error('Error fetching versions:', error)
    else setVersions((data as any) || [])
    setLoading(false)
  }, [projectId])

  const saveVersion = useCallback(async (generatedCode: string, title: string) => {
    if (!projectId) return null
    const nextVersion = versions.length > 0 ? versions[0].version_number + 1 : 1
    const { data, error } = await supabase
      .from('project_versions' as any)
      .insert({
        project_id: projectId,
        version_number: nextVersion,
        generated_code: generatedCode,
        title: `v${nextVersion} — ${title}`,
        published_at: new Date().toISOString(),
      } as any)
      .select()
      .single()
    if (error) {
      console.error('Error saving version:', error)
      toast.error('Error saving version')
      return null
    }
    await fetchVersions()
    return data
  }, [projectId, versions, fetchVersions])

  const rollbackToVersion = useCallback(async (versionId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('project_versions' as any)
      .select('generated_code')
      .eq('id', versionId)
      .single()
    if (error || !data) {
      toast.error('Error loading version')
      return null
    }
    return (data as any).generated_code
  }, [])

  return { versions, loading, fetchVersions, saveVersion, rollbackToVersion }
}
