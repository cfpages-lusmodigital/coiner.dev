import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "1. Connect Your Wallet",
    description: "Click the 'Connect Wallet' button at the top of the page to connect your Phantom wallet. You'll need some SOL in your wallet to pay for the creation fees.",
  },
  {
    title: "2. Fill in Your Token's Details",
    description: "Choose a memorable and unique name, symbol, and description for your token. This information will be stored on the blockchain and will be visible to everyone.",
  },
  {
    title: "3. Set the Decimals and Supply",
    description: "Solana tokens typically use 9 decimal places. The supply is the total number of tokens that will ever be created.",
  },
  {
    title: "4. Upload a Token Image",
    description: "Add a visual representation for your token. This image will be shown in wallets and on exchanges. We recommend a square image in PNG, JPG, or GIF format.",
  },
  {
    title: "5. Add Social Links & Tags",
    description: "Provide links to your website, Twitter, Telegram, etc. to help build your community and provide more information about your project.",
  },
  {
    title: "6. Configure Advanced Options (Optional)",
    description: "For advanced users, we offer options to customize features like minting authority or freeze authority. If you're not sure what these mean, you can safely ignore them.",
  },
  {
    title: "7. Create Your Token",
    description: "Review all the details, then click 'Create Token'. You'll be asked to approve the transaction in your wallet. Once confirmed, your token will be created and sent to your wallet.",
  },
];

const StepGuide = () => {
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-2xl">How to Create Your Solana Token in 7 Easy Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-1/2 h-full border-l-2 border-dashed border-gray-700 -translate-x-1/2 hidden md:block"></div>
          <div className="space-y-12">
            {steps.map((step, index) => (
              <div key={index} className="relative flex items-center md:items-start">
                <div className={cn("flex items-center w-full", index % 2 === 1 && "md:flex-row-reverse")}>
                  <div className="flex-1 px-4 md:px-8">
                    <div className={cn("p-6 rounded-lg bg-gray-800", index % 2 === 1 ? "md:text-right" : "md:text-left")}>
                      <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                      <p className="text-sm text-gray-400">{step.description}</p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bg-gray-900 z-10 hidden md:flex">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                      {index + 1}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 text-center p-6 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Creation Fee: 0.5 SOL (Mainnet) / 0.1 SOL (Devnet)</h3>
          <p className="text-sm text-gray-400">
            This fee covers all blockchain costs for creating your SPL Token. The process is automated and secure.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepGuide;
