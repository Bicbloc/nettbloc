import { TechnicianProfileEditor } from '@/components/technician/TechnicianProfileEditor';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';

function TechnicianProfileContent() {
  return <TechnicianProfileEditor />;
}

export default function TechnicianProfile() {
  return (
    <UserTypeGuard expectedType="technician">
      <TechnicianProfileContent />
    </UserTypeGuard>
  );
}
