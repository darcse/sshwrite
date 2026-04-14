export function prependWorldviewToSystem(
  baseSystem: string,
  worldviewContext: unknown
): string {
  const w =
    typeof worldviewContext === 'string' ? worldviewContext.trim() : ''
  if (!w) return baseSystem
  return `[세계관 설정] ${w}\n\n${baseSystem}`
}
