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
    <Card className="shiny-card w-full max-w-4xl mx-auto rounded-2xl shadow-2xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-center text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          How to Create Your Solana Token
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <div key={index} className="shiny-pill flex flex-col items-center text-center p-6 rounded-2xl hover:border-amber-400/40 transition-all duration-300">
              <div className="mb-4 p-3 rounded-full bg-zinc-900 border border-zinc-800 shadow-xs">
                {step.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center p-6 bg-gray-950/70 border border-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-1 text-white">Flat 0.15 SOL Fee (All-Inclusive Bundle)</h3>
          <p className="text-sm text-gray-400">
            Includes token creation, supply minting, IPFS metadata hosting, and all 3 security revocations. Fast, automated, and 100% non-custodial.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepGuide;
