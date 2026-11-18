// src/components/FAQ.jsx
import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from 'lucide-react';

const FAQ = () => {
  const faqItems = [
    {
      question: "How much does it cost to create a token on coiner.dev?",
      answer: "coiner.dev charges a flat 0.15 SOL bundled service fee. This includes SPL token creation, 100% supply minting to your wallet, decentralized IPFS logo & metadata hosting, and all 3 security revocations (Freeze Authority, Mint Authority, and Immutable Metadata) so your token qualifies for an A-grade RugCheck score. Solana on-chain rent and gas (~0.0168 SOL) are paid directly to the network. If you customize by choosing to keep any authority, a +0.05 SOL fee applies per kept authority."
    },
    {
      question: "Do you take any cut or percentage of my token supply?",
      answer: "Never. 100% of your token supply is minted directly into your connected wallet. coiner.dev takes zero supply, has zero backdoors, and is 100% non-custodial."
    },
    {
      question: "Is it safe and non-custodial?",
      answer: "Yes, 100% trustless and non-custodial. We never ask for, see, or touch your private keys. The transaction is assembled in your browser and signed securely by your own wallet (Phantom, Solflare, etc.)."
    },
    {
      question: "Why should I Revoke Freeze Authority?",
      answer: "Revoking Freeze Authority is required to create a liquidity pool on Raydium or Meteora. It proves to traders and DEX screeners that no one can freeze their tokens or blacklist their wallets, ensuring a high RugCheck score."
    },
    {
      question: "Why should I Revoke Mint Authority?",
      answer: "Revoking Mint Authority caps the token supply permanently. It guarantees that no one (not even you) can ever mint more tokens to dilute holders, preventing inflation rugs."
    },
    {
      question: "How do I create a liquidity pool (Raydium / Meteora) after launch?",
      answer: "Once your token is deployed, we provide a 1-click link to Raydium Liquidity Pool Creation. You can create a Raydium CPMM (Constant Product) pool or Meteora DLMM pool directly with your SOL and newly minted tokens in under 2 minutes."
    },
    {
      question: "Can I test on Solana Devnet first?",
      answer: "Yes! Use the network toggle in the top-right header to switch between Devnet and Mainnet. On Devnet you can test the full token creation workflow using free testnet SOL from a faucet before launching on Mainnet."
    }
  ];
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="shiny-card rounded-2xl shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-black text-white flex items-center justify-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <HelpCircle className="w-6 h-6 text-amber-400" /> Frequently Asked Questions
          </CardTitle>
          <p className="text-xs text-zinc-400">Everything you need to know about sovereign token creation</p>
        </CardHeader>
        <CardContent className="pt-4">
          <Accordion type="single" collapsible className="w-full space-y-2.5">
            {faqItems.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="shiny-pill rounded-xl px-4 border-none">
                <AccordionTrigger className="text-left font-bold text-white hover:text-amber-300 transition-colors py-3.5 text-sm">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-zinc-300 text-xs leading-relaxed pb-4">
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
