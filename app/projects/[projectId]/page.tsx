export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return (
    <main>
      <h1>에디터 — {params.projectId}</h1>
    </main>
  )
}
