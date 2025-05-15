
import React, { useState, useEffect } from "react";
import { getEmailsFromSupabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailData {
  email: string;
  created_at: string;
}

const EmailDataTable: React.FC = () => {
  const [emailData, setEmailData] = useState<EmailData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        setIsLoading(true);
        const { success, data, error } = await getEmailsFromSupabase();
        
        if (!success || error) {
          setError("Erreur lors de la récupération des emails");
          return;
        }
        
        setEmailData(data);
      } catch (err) {
        console.error("Error fetching email data:", err);
        setError("Erreur lors de la récupération des emails");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmails();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true,
        locale: fr
      });
    } catch (e) {
      return "Date invalide";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Adresses Email Enregistrées</span>
          <Badge variant="outline">{emailData.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            Chargement des données...
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">
            {error}
          </div>
        ) : emailData.length === 0 ? (
          <div className="text-center p-4 text-muted-foreground">
            Aucune adresse email enregistrée
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Date d'enregistrement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailData.map((item, index) => (
                <TableRow key={`${item.email}-${index}`}>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>{formatDate(item.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailDataTable;
