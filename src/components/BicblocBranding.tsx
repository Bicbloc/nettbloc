
import React from "react";
import { AspectRatio } from "./ui/aspect-ratio";

export const BicblocLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      <a href="https://www.bicbloc.eu" target="_blank" rel="noopener noreferrer" className="block max-w-[400px] mx-auto">
        <img 
          src="/lovable-uploads/fab4ce53-a146-478a-a585-fab338cb0095.png"
          alt="BicBloc Logo"
          className="object-contain h-full w-full"
        />
      </a>
    </div>
  );
};

export const BicblocFooter: React.FC = () => {
  return (
    <footer className="py-8 w-full">
      <a 
        href="https://www.bicbloc.eu" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block"
      >
        <div className="w-full">
          <img 
            src="/lovable-uploads/d6290f4a-190e-4ad8-99a9-51307a4cbcc8.png"
            alt="BicBloc Banner"
            className="w-full object-contain max-h-[180px]"
          />
        </div>
      </a>
    </footer>
  );
};
