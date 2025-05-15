
import React from "react";
import { AspectRatio } from "./ui/aspect-ratio";

export const BicblocLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      <a href="https://www.bicbloc.eu" target="_blank" rel="noopener noreferrer" className="block max-w-[400px] mx-auto">
        <div className="text-4xl font-bold font-['Poppins']">NettoBloc</div>
      </a>
    </div>
  );
};

export const BicblocFooter: React.FC = () => {
  return (
    <footer className="mt-4 py-6 border-t">
      <a 
        href="https://www.bicbloc.eu" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block text-center"
      >
        <div className="max-w-full w-full">
          <AspectRatio ratio={16/4} className="w-full">
            <div className="flex items-center justify-center">
              <div className="text-3xl font-bold font-['Poppins']">NettoBloc</div>
            </div>
          </AspectRatio>
        </div>
      </a>
    </footer>
  );
};
