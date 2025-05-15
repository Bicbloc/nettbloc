
import React from "react";
import { AspectRatio } from "./ui/aspect-ratio";

export const BicblocLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      <div className="block max-w-[400px] mx-auto">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="100" 
          height="100" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/>
          <path d="M12 3v16"/>
          <path d="m9 7 3-3 3 3"/>
          <path d="M4 15h16"/>
        </svg>
      </div>
    </div>
  );
};

export const BicblocFooter: React.FC = () => {
  return (
    <footer className="mt-4 py-6 border-t">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">BicBloc Housekeeping Report</p>
      </div>
    </footer>
  );
};
