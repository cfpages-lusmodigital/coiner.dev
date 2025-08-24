import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageIcon } from 'lucide-react';

const LivePreview = ({ formData }) => {
  const { name, ticker, description, image } = formData;

  return (
    <Card className="w-full sticky top-24">
      <CardHeader>
        <h3 className="text-lg font-semibold text-center">Live Preview</h3>
      </CardHeader>
      <CardContent className="flex flex-col items-center text-center space-y-4">
        <Avatar className="w-32 h-32">
          <AvatarImage src={image} alt={name || "Token Preview"} />
          <AvatarFallback className="bg-gray-800">
            <ImageIcon className="w-16 h-16 text-gray-500" />
          </AvatarFallback>
        </Avatar>

        <div>
          <h2 className="text-2xl font-bold">{name || "Coin Name"}</h2>
          <p className="text-lg text-gray-400">{ticker ? `$${ticker.toUpperCase()}` : "$TICKER"}</p>
        </div>

        <p className="text-sm text-gray-300 min-h-[60px]">
          {description || "Your coin's description will appear here."}
        </p>
      </CardContent>
    </Card>
  );
};

export default LivePreview;
