// src/components/FAQ.jsx
import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from 'lucide-react';

const faqItems = [
  {
    question: "How much does it cost to create a token on coiner.dev?",
    answer: "Exactly 0.0067 to 0.015 SOL on Solana mainnet. This is 100% the raw Solana network rent for the Mint account (82B), your Associated Token Account (165B), and the Metaplex Metadata PDA (~679B). coiner.dev charges 0.00 SOL in platform service fees — saving you over 97% compared to predatory tools that charge 0.20 to 0.50+ SOL."
  },
  {
    question: "Is it safe and non-custodial?",
    answer: "Yes, 100% trustless and non-custodial. We never ask for, see, or touch your private keys. The atomic transaction is assembled entirely in your browser and signed by your connected wallet (Phantom, Solflare, etc.). 100% of the token supply is minted directly into your wallet."
  },
  {
    question: "Why should I Revoke Freeze Authority?",
    answer: "Revoking Freeze Authority proves to your community and DEX traders that no one can ever freeze their wallets or blacklist their tokens. Raydium and Meteora require this for pool creation, and RugCheck.xyz will only give an A-Grade rating if Freeze Authority is revoked."
  },
  {
    question: "Why should I Revoke Mint Authority?",
    answer: "Revoking Mint Authority guarantees that the token supply is capped permanently. Nobody (not even you) can ever mint more tokens to dilute holders or execute an inflation rug."
  },
  {
    question: "How do I create a liquidity pool (Raydium / Meteora) after creating my token?",
    answer: "Once your token is deployed, we provide a 1-click link to Raydium Liquidity Pool Creation. You can create a Raydium CPMM (Constant Product) pool or Meteora DLMM pool directly with your SOL and newly minted tokens without needing an expensive OpenBook market ID."
  },
  {
    question: "Can I test on Solana Devnet first?",
    answer: "Yes! Use the network toggle in the top-right header to switch between Devnet and Mainnet. On Devnet you can test the complete token creation workflow using free testnet SOL from a faucet before launching on Mainnet."
  }
];

const FAQ = () => {
  const [openItem, setOpenItem] = useState(null);

  const handleToggle = (index) => {
    setOpenItem(openItem === index ? null : index);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="bg-gray-900/80 border-gray-800 shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <HelpCircle className="w-6 h-6 text-emerald-400" /> Frequently Asked Questions
          </CardTitle>
          <p className="text-xs text-gray-400">Everything you need to know about sovereign token creation</p>
        </CardHeader>
        <CardContent className="pt-4">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqItems.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-gray-800 bg-gray-950/60 rounded-lg px-4">
                <AccordionTrigger className="text-left font-medium text-white hover:text-emerald-400 transition-colors py-3 text-sm">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-300 text-xs leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default FAQ;
