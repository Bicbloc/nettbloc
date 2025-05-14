
import React, { useEffect, useState } from "react";
import { AspectRatio } from "./ui/aspect-ratio";

export const BicblocLogo: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState("");
  
  useEffect(() => {
    // Ensure we have the correct base URL when the component mounts
    setBaseUrl(window.location.origin);
  }, []);
  
  return (
    <div className="flex flex-col items-center">
      <a href="https://www.bicbloc.eu" target="_blank" rel="noopener noreferrer" className="block max-w-[400px] mx-auto">
        <img 
          src={`${baseUrl}/lovable-uploads/fab4ce53-a146-478a-a585-fab338cb0095.png`}
          alt="BicBloc Logo"
          className="object-contain h-full w-full"
        />
      </a>
    </div>
  );
};

export const BicblocFooter: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState("");
  
  useEffect(() => {
    // Ensure we have the correct base URL when the component mounts
    setBaseUrl(window.location.origin);
  }, []);
  
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
            <img 
              src={`${baseUrl}/lovable-uploads/c8c4ab5d-01f9-48ea-970c-2ba1488f614d.png`}
              alt="BicBloc Banner"
              className="w-full h-full object-contain"
            />
          </AspectRatio>
        </div>
      </a>
    </footer>
  );
};
