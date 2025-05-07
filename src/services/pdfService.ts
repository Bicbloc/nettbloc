
// Basic PDF service that will handle PDF processing
// This is a stub implementation that can be expanded later with real PDF parsing logic

import { toast } from "@/components/ui/use-toast";

export interface Room {
  number: string;
  status: string;
  cleaningType: 'full' | 'quick' | 'none';
  priority: 'high' | 'medium' | 'low';
  assignedTo?: string;
}

// Mock function to simulate PDF processing
export async function processPdf(file: File): Promise<Room[]> {
  try {
    // In a real implementation, this would use pdf.js or a similar library
    // to extract text from the PDF and parse it
    
    // For now, let's simulate processing with a delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return mock data
    toast({
      title: "PDF Processed",
      description: `Successfully processed ${file.name}`,
    });
    
    return generateMockRoomData();
  } catch (error) {
    console.error("Error processing PDF:", error);
    toast({
      variant: "destructive",
      title: "Processing Failed",
      description: "Failed to process the PDF file. Please try again.",
    });
    throw error;
  }
}

// Helper function to generate mock room data
function generateMockRoomData(): Room[] {
  const statuses = ['needs-cleaning', 'clean', 'occupied', 'maintenance'];
  const cleaningTypes = ['full', 'quick', 'none'] as const;
  const priorities = ['high', 'medium', 'low'] as const;
  const housekeepers = [undefined, 'Housekeeper 1', 'Housekeeper 2', 'Housekeeper 3'];
  
  return Array.from({ length: 50 }, (_, i) => {
    const floor = Math.floor(i / 20) + 1;
    const room = (i % 20) + 1;
    const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
    
    return {
      number: roomNumber,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      cleaningType: cleaningTypes[Math.floor(Math.random() * cleaningTypes.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      assignedTo: housekeepers[Math.floor(Math.random() * housekeepers.length)]
    };
  });
}
