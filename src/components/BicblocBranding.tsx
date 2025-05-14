
import React from "react";
import { AspectRatio } from "./ui/aspect-ratio";

export const BicblocLogo: React.FC = () => {
  return (
    <a href="https://www.bicbloc.eu" target="_blank" rel="noopener noreferrer" className="block max-w-[300px] mx-auto mb-3">
      <img 
        src="/lovable-uploads/fab4ce53-a146-478a-a585-fab338cb0095.png"
        alt="BicBloc Logo"
        className="object-contain h-full w-full"
      />
    </a>
  );
};

export const BicblocFooter: React.FC = () => {
  return (
    <footer className="mt-4 py-4 border-t">
      <a 
        href="https://www.bicbloc.eu" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block text-center"
      >
        <img 
          src="/lovable-uploads/c8c4ab5d-01f9-48ea-970c-2ba1488f614d.png"
          alt="BicBloc Banner"
          className="w-full max-h-40 mx-auto"
        />
      </a>
    </footer>
  );
};
