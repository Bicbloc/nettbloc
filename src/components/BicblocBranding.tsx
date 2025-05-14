
import React from "react";
import { AspectRatio } from "./ui/aspect-ratio";

export const BicblocLogo: React.FC = () => {
  return (
    <a href="https://bicbloc.eu" target="_blank" rel="noopener noreferrer" className="block max-w-[200px] mx-auto mb-6">
      <AspectRatio ratio={3/1}>
        <div className="flex items-center justify-center h-full w-full bg-blue-600 rounded-md text-white font-bold text-xl">
          NettoBloc
        </div>
      </AspectRatio>
    </a>
  );
};

export const BicblocFooter: React.FC = () => {
  return (
    <footer className="mt-8 py-4 border-t">
      <a 
        href="https://bicbloc.eu" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block text-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
      >
        BicBloc.eu - Optimisation de personnel hôtelier
      </a>
    </footer>
  );
};
