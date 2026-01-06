import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Room } from "@/services/pdfService";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const formSchema = z.object({
  number: z.string().min(1, "Room number is required"),
  status: z.string().min(1, "Status is required"),
  cleaningType: z.enum(['a_blanc', 'recouche', 'none', 'full', 'quick'], {
    required_error: "Cleaning type is required",
  }),
  priority: z.enum(['high', 'medium', 'low'], {
    required_error: "Priority is required",
  }),
  floor: z.string().optional(),
  isTwin: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
  notUrgent: z.boolean().default(false),
  notes: z.string().optional(),
  linkedRooms: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof formSchema>;

interface AddRoomDialogProps {
  onAddRoom: (room: Room) => void;
  existingRooms: Room[];
}

export function AddRoomDialog({ onAddRoom, existingRooms }: AddRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: '',
      status: '',
      cleaningType: 'a_blanc',
      priority: 'medium',
      floor: '',
      isTwin: false,
      isUrgent: false,
      notUrgent: false,
      notes: '',
      linkedRooms: [],
    },
  });

  const onSubmit = (data: FormData) => {
    // Check if the room already exists
    const roomExists = existingRooms.some(room => room.number === data.number);
    if (roomExists) {
      toast({
        title: t.common.cancel,
        description: t.rooms.roomExists,
        variant: "destructive",
      });
      return;
    }

    const newRoom: Room = {
      number: data.number,
      status: data.status,
      cleaningType: data.cleaningType,
      priority: data.priority,
      floor: data.floor ? parseInt(data.floor) : undefined,
      isTwin: data.isTwin,
      isUrgent: data.isUrgent,
      notUrgent: data.notUrgent,
      notes: data.notes,
      linkedRooms: data.linkedRooms || [],
    };

    onAddRoom(newRoom);
    
    toast({
      title: t.common.save,
      description: `${t.rooms.room} ${data.number} ${t.rooms.roomAdded}`,
    });

    form.reset();
    setOpen(false);
  };

  const statusOptions = [
    { value: 'DIRTY', label: t.rooms.dirty },
    { value: 'CLEAN', label: t.rooms.clean },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'OOO', label: t.rooms.vacant },
    { value: 'DEPARTURE', label: t.rooms.departure },
    { value: 'ARRIVAL', label: t.rooms.arrival },
    { value: 'STAY', label: t.rooms.occupied },
    { value: 'VACANT', label: t.rooms.vacant },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t.rooms.addRoom}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.rooms.addRoom}</DialogTitle>
          <DialogDescription>
            {t.rooms.createRoom}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.rooms.roomNumber} *</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: 101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.rooms.floor}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="ex: 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.rooms.status} *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.rooms.selectStatus} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cleaningType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.rooms.cleaningType} *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.rooms.cleaningType} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="a_blanc">🚪 {t.rooms.fullClean} (CO)</SelectItem>
                        <SelectItem value="recouche">🛏️ {t.rooms.quickClean} (SO)</SelectItem>
                        <SelectItem value="none">{t.rooms.noCleaning}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.rooms.priority} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t.rooms.selectPriority} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="high">{t.rooms.priorityHigh}</SelectItem>
                      <SelectItem value="medium">{t.rooms.priorityMedium}</SelectItem>
                      <SelectItem value="low">{t.rooms.priorityLow}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="isTwin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t.rooms.twinRoom}</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isUrgent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t.rooms.urgent}</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notUrgent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t.rooms.notUrgent}</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.rooms.notes}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t.rooms.notesPlaceholder}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit">
                {t.rooms.addRoom}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}