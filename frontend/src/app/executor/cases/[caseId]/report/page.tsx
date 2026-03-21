import { ExecutorCaseReportScreen } from './executor-case-report-screen';

export default async function ExecutorCaseReportPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <ExecutorCaseReportScreen caseId={caseId} />;
}
