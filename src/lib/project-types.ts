/** Round-robin database keys: 'a' = primary (myapp-5a04d), 'b' = aite-76. */
export type ProjectId = 'a' | 'b';

export function otherProject(project: ProjectId): ProjectId {
  return project === 'a' ? 'b' : 'a';
}
