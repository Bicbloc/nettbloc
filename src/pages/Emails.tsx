
import React from "react";
import EmailDataTable from "@/components/EmailDataTable";

const EmailsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Données des Emails</h1>
      <EmailDataTable />
    </div>
  );
};

export default EmailsPage;
