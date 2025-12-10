import { useState } from 'react';
import { Room } from '@/services/pdfService';

export function useDashboardDialogs() {
  // Dialog states
  const [isManualAssignmentOpen, setIsManualAssignmentOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isRedistributionDialogOpen, setIsRedistributionDialogOpen] = useState(false);
  const [isHotelSelectionOpen, setIsHotelSelectionOpen] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showActionLogPanel, setShowActionLogPanel] = useState(false);
  const [showCreateColumnDialog, setShowCreateColumnDialog] = useState(false);
  
  // Selected items
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");
  const [reportAction, setReportAction] = useState<"single" | "all">("single");
  const [reportHousekeeper, setReportHousekeeper] = useState<string>("");

  const openDeleteDialog = (room: Room) => {
    setSelectedRoom(room);
    setShowDeleteDialog(true);
  };

  const openLinkDialog = (room: Room) => {
    setSelectedRoom(room);
    setShowLinkDialog(true);
  };

  const openSingleReport = (housekeeperName: string) => {
    setReportAction("single");
    setReportHousekeeper(housekeeperName);
    setIsReportDialogOpen(true);
  };

  const openAllReports = () => {
    setReportAction("all");
    setIsReportDialogOpen(true);
  };

  return {
    // Dialog states
    isManualAssignmentOpen,
    setIsManualAssignmentOpen,
    isReportDialogOpen,
    setIsReportDialogOpen,
    isRedistributionDialogOpen,
    setIsRedistributionDialogOpen,
    isHotelSelectionOpen,
    setIsHotelSelectionOpen,
    showInviteDialog,
    setShowInviteDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    showLinkDialog,
    setShowLinkDialog,
    showActionLogPanel,
    setShowActionLogPanel,
    showCreateColumnDialog,
    setShowCreateColumnDialog,
    
    // Selected items
    selectedRoom,
    setSelectedRoom,
    selectedHousekeeper,
    setSelectedHousekeeper,
    reportAction,
    setReportAction,
    reportHousekeeper,
    setReportHousekeeper,
    
    // Helper functions
    openDeleteDialog,
    openLinkDialog,
    openSingleReport,
    openAllReports
  };
}
