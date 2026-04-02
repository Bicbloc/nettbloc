import { AITrainingTab } from "./AITrainingTab";

interface TrainingTabProps {
  currentHotelId: string | null;
}

export function TrainingTab({ currentHotelId }: TrainingTabProps) {
  return <AITrainingTab currentHotelId={currentHotelId} />;
}
