import { BotAutomationStudio } from "./bot-automation-studio";

export default async function BotAutomationPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  return <BotAutomationStudio profileId={profileId} />;
}
