import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Tag } from "lucide-react";
import { useState } from "react";
import { UploadDialog } from "@/components/UploadDialog";
import { Room } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeepers, setHousekeepers] = useState([
    { id: 1, name: "Housekeeper 1", assignedRooms: [] as Room[] },
    { id: 2, name: "Housekeeper 2", assignedRooms: [] as Room[] },
    { id: 3, name: "Housekeeper 3", assignedRooms: [] as Room[] },
    { id: 4, name: "Housekeeper 4", assignedRooms: [] as Room[] },
  ]);
  
  const handlePdfProcessed = (data: Room[]) => {
    setRooms(data);
    
    // Auto-assign rooms to housekeepers for demonstration
    const assignedRooms = [...data];
    const updatedHousekeepers = housekeepers.map(hk => ({ ...hk, assignedRooms: [] as Room[] }));
    
    // Simple round-robin assignment
    assignedRooms.forEach((room, index) => {
      const hkIndex = index % updatedHousekeepers.length;
      updatedHousekeepers[hkIndex].assignedRooms.push(room);
    });
    
    setHousekeepers(updatedHousekeepers);
    setActiveTab("rooms"); // Switch to rooms tab automatically
  };
  
  // Calculate statistics
  const totalRooms = rooms.length;
  const roomsToClean = rooms.filter(r => r.status === 'needs-cleaning').length;
  const priorityRooms = rooms.filter(r => r.priority === 'high').length;
  const cleanedRooms = rooms.filter(r => r.status === 'clean').length;
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Needs Cleaning</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Clean</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Occupied</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">High</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };
  
  const getCleaningTypeBadge = (type: string) => {
    switch (type) {
      case 'full':
        return "Full Service";
      case 'quick':
        return "Quick Service";
      case 'none':
        return "No Service";
      default:
        return type;
    }
  };
  
  const handleRoomAssignment = (roomNumber: string, housekeeperId: number) => {
    // Find the room
    const roomToAssign = rooms.find(r => r.number === roomNumber);
    if (!roomToAssign) return;
    
    // Update housekeepers
    const updatedHousekeepers = housekeepers.map(hk => {
      // Remove from current assignment
      const filteredRooms = hk.assignedRooms.filter(r => r.number !== roomNumber);
      
      // Add to new housekeeper
      if (hk.id === housekeeperId) {
        return {
          ...hk,
          assignedRooms: [...filteredRooms, roomToAssign]
        };
      }
      
      return {
        ...hk,
        assignedRooms: filteredRooms
      };
    });
    
    setHousekeepers(updatedHousekeepers);
  };
  
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Hotel Room Management</h1>
          <UploadDialog onPdfProcessed={handlePdfProcessed} />
        </div>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="housekeeping">Housekeeping</TabsTrigger>
            <TabsTrigger value="rooms">All Rooms</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRooms}</div>
                  <p className="text-xs text-muted-foreground">Total rooms in report</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Housekeepers</CardTitle>
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{housekeepers.length}</div>
                  <p className="text-xs text-muted-foreground">Available today</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rooms to Clean</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{roomsToClean}</div>
                  <p className="text-xs text-muted-foreground">Rooms requiring service</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Priority Rooms</CardTitle>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{priorityRooms}</div>
                  <p className="text-xs text-muted-foreground">High priority rooms</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Report</CardTitle>
                  <CardDescription>
                    Upload a PDF report from Mews to analyze room statuses
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-10 text-center">
                    <p className="text-gray-500 mb-2">Drag and drop your Mews PDF report here</p>
                    <p className="text-gray-400 text-sm mb-4">or</p>
                    <UploadDialog onPdfProcessed={handlePdfProcessed} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Housekeeping Status</CardTitle>
                  <CardDescription>
                    Current progress of room cleaning
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium flex-1">Clean Rooms</span>
                        <span className="text-sm text-gray-500">{cleanedRooms}/{totalRooms}</span>
                      </div>
                      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-green-500" 
                          style={{ width: totalRooms > 0 ? `${(cleanedRooms/totalRooms)*100}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium flex-1">Priority Rooms</span>
                        <span className="text-sm text-gray-500">
                          {priorityRooms > 0 ? 
                            `${rooms.filter(r => r.priority === 'high' && r.status === 'clean').length}/${priorityRooms}` : 
                            '0/0'}
                        </span>
                      </div>
                      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-red-500" 
                          style={{ 
                            width: priorityRooms > 0 ? 
                              `${(rooms.filter(r => r.priority === 'high' && r.status === 'clean').length/priorityRooms)*100}%` : 
                              '0%' 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="housekeeping" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Housekeeper Assignment</CardTitle>
                <CardDescription>
                  Assign rooms to housekeepers and monitor their workload
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {housekeepers.map((housekeeper) => (
                    <div 
                      key={housekeeper.id} 
                      className="border rounded-md p-4 space-y-3"
                    >
                      <div className="flex items-center space-x-2">
                        <UserIcon className="h-5 w-5 text-blue-500" />
                        <h3 className="font-medium">{housekeeper.name}</h3>
                      </div>
                      <div className="text-sm text-gray-500">
                        <p>Assigned rooms: {housekeeper.assignedRooms.length}</p>
                        <p>Completed: {housekeeper.assignedRooms.filter(r => r.status === 'clean').length}</p>
                      </div>
                      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-blue-500" 
                          style={{ 
                            width: housekeeper.assignedRooms.length > 0 ? 
                              `${(housekeeper.assignedRooms.filter(r => r.status === 'clean').length/housekeeper.assignedRooms.length)*100}%` : 
                              '0%' 
                          }}
                        ></div>
                      </div>
                      <div className="space-y-2 mt-4">
                        <h4 className="text-sm font-medium">Assigned Rooms:</h4>
                        <div className="flex flex-wrap gap-1">
                          {housekeeper.assignedRooms.map(room => (
                            <span 
                              key={room.number}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {room.number}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="rooms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Rooms</CardTitle>
                <CardDescription>
                  View and manage all rooms in the hotel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Room</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Cleaning Type</th>
                        <th className="text-left py-3 px-4 font-medium">Priority</th>
                        <th className="text-left py-3 px-4 font-medium">Assigned To</th>
                        <th className="text-left py-3 px-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-500">
                            No rooms available. Please upload a Mews report.
                          </td>
                        </tr>
                      ) : (
                        rooms.map((room) => {
                          // Find which housekeeper this room is assigned to
                          const assignedHousekeeper = housekeepers.find(hk => 
                            hk.assignedRooms.some(r => r.number === room.number)
                          );

                          return (
                            <tr key={room.number} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">{room.number}</td>
                              <td className="py-3 px-4">{getStatusBadge(room.status)}</td>
                              <td className="py-3 px-4">{getCleaningTypeBadge(room.cleaningType)}</td>
                              <td className="py-3 px-4">{getPriorityBadge(room.priority)}</td>
                              <td className="py-3 px-4">
                                {assignedHousekeeper?.name || 'Unassigned'}
                              </td>
                              <td className="py-3 px-4">
                                <select 
                                  className="border rounded px-2 py-1 text-sm"
                                  value={assignedHousekeeper?.id || ''}
                                  onChange={(e) => handleRoomAssignment(room.number, parseInt(e.target.value))}
                                >
                                  <option value="">Unassigned</option>
                                  {housekeepers.map(hk => (
                                    <option key={hk.id} value={hk.id}>{hk.name}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
