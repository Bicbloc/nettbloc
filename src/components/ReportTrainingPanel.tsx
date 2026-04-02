import { AITrainingTab } from "./dashboard/AITrainingTab";

export const ReportTrainingPanel = ({ hotelId }: { hotelId: string }) => {
  return <AITrainingTab currentHotelId={hotelId} />;
};
