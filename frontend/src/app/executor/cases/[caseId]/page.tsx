import { ExecutorCaseWorkspaceScreen } from './executor-case-workspace-screen';

export default async function ExecutorCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <ExecutorCaseWorkspaceScreen caseId={caseId} />;
}
