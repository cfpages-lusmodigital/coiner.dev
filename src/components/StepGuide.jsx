import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Pencil, Settings, Upload, Link, ShieldCheck, Rocket } from './ui/Icons';

const steps = [
  {
    icon: <Wallet className="h-8 w-8 text-primary" />,
    title: "Connect Your Wallet",
    description: "Click the 'Connect Wallet' button at the top of the page to connect your Phantom wallet. You'll need some SOL in your wallet to pay for the creation fees.",
  },
  {
    icon: <Pencil className="h-8 w-8 text-primary" />,
    title: "Fill in Your Token's Details",
    description: "Choose a memorable and unique name, symbol, and description for your token. This information will be stored on the blockchain and will be visible to everyone.",
  },
  {
    icon: <Settings className="h-8 w-8 text-primary" />,
    title: "Set the Decimals and Supply",
    description: "Solana tokens typically use 9 decimal places. The supply is the total number of tokens that will ever be created.",
  },
  {
    icon: <Upload className="h-8 w-8 text-primary" />,
    title: "Upload a Token Image",
    description: "Add a visual representation for your token. This image will be shown in wallets and on exchanges. We recommend a square image in PNG, JPG, or GIF format.",
  },
  {
    icon: <Link className="h-8 w-8 text-primary" />,
    title: "Add Social Links & Tags",
    description: "Provide links to your website, Twitter, Telegram, etc. to help build your community and provide more information about your project.",
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: "Configure Advanced Options (Optional)",
    description: "For advanced users, we offer options to customize features like minting authority or freeze authority. If you're not sure what these mean, you can safely ignore them.",
  },
  {
    icon: <Rocket className="h-8 w-8 text-primary" />,
    title: "Create Your Token",
    description: "Review all the details, then click 'Create Token'. You'll be asked to approve the transaction in your wallet. Once confirmed, your token will be created and sent to your wallet.",
  },
];

const StepGuide = () => {
  return (
    <Card className="w-full max-w-4xl mx-auto bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-center text-3xl font-bold text-white">How to Create Your Solana Token</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 bg-gray-800 rounded-lg">
              <div className="mb-4">
                {step.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center p-6 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-white">Creation Fee: 0.5 SOL (Mainnet) / 0.1 SOL (Devnet)</h3>
          <p className="text-sm text-gray-400">
            This fee covers all blockchain costs for creating your SPL Token. The process is automated and secure.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepGuide;
