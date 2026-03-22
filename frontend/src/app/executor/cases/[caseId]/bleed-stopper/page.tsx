import { ExecutorCaseBleedStopperScreen } from './executor-case-bleed-stopper-screen';

export default async function ExecutorCaseBleedStopperPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <ExecutorCaseBleedStopperScreen caseId={caseId} />;
}
