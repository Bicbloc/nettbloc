import { TrainingWizard } from "./training";

export const ReportTrainingPanel = ({ hotelId }: { hotelId: string }) => {
  return <TrainingWizard hotelId={hotelId} />;
};
