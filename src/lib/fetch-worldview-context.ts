import { createClient } from '@/lib/supabase/client'

export async function fetchWorldviewContext(projectId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('write_projects')
    .select('worldview_context')
    .eq('id', projectId)
    .maybeSingle()
  if (error) {
    console.error(error)
    return ''
  }
  const row = data as { worldview_context?: string | null } | null
  return typeof row?.worldview_context === 'string' ? row.worldview_context : ''
}
