import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqItems = [
  {
    question: "What is a Solana SPL Token?",
    answer: "An SPL Token is a token on the Solana blockchain. It's similar to an ERC-20 token on Ethereum. These tokens can be used for a wide variety of purposes, including as a currency for a project, for governance, or as a collectible."
  },
  {
    question: "Is it safe to use this tool?",
    answer: "Yes, our Solana Token Creator is completely safe. We never have access to your private keys or seed phrases. All transactions are created on this page and signed directly by you in your connected wallet. The smart contract code for token creation is the official one from the Solana Program Library."
  },
  {
    question: "How long does it take to create a token?",
    answer: "Creating a token is almost instant. It usually takes less than a minute, but the exact time can vary depending on the current congestion of the Solana network. You'll see a confirmation message as soon as your token is created."
  },
  {
    question: "How much does it cost to create a token?",
    answer: "The cost to create a token is 0.5 SOL for mainnet and 0.1 SOL for devnet. This fee covers all the blockchain transaction fees required to create the token and its associated accounts, plus a small service fee to keep this tool running."
  },
  {
    question: "Which wallet can I use?",
    answer: "Currently, we support Phantom wallet, which is the most popular wallet on Solana. We are planning to add support for other wallets like Solflare and Slope in the near future."
  },
  {
    question: "Can I see the code for this tool?",
    answer: "Yes, this project is open source. You can view the source code on our GitHub repository. We believe in transparency and welcome contributions from the community."
  }
];

const FAQ = () => {
  const [openItem, setOpenItem] = useState(null);

  const handleToggle = (index) => {
    setOpenItem(openItem === index ? null : index);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-2xl">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion>
            {faqItems.map((faq, index) => (
              <AccordionItem key={index}>
                <AccordionTrigger onClick={() => handleToggle(index)} data-state={openItem === index ? 'open' : 'closed'}>
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent data-state={openItem === index ? 'open' : 'closed'}>
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Your Go-To Solana Token Maker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-400">
          <p>
            If you're looking for an easy and efficient way to create SPL tokens on the
            Solana blockchain, you've come to the right place. Our Solana Token Maker is
            an intuitive and user-friendly platform that allows users to customize and
            deploy their own tokens with ease.
          </p>
          <p>
            With our comprehensive toolkit, you don't have to be a blockchain
            expert to create and manage your own tokens. We prioritize user experience, security, and privacy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Seamless SPL Token Creation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-400">
          <p>
            Our SPL Token Creator software is perfect for both developers and non-developers. It will help you create
            tokens easily and securely, saving you time and money.
          </p>
          <p>
            Our customer support team is always available to assist you with anything. Our highly trained team is
            available 24/7 to help you resolve any issues or questions you may have.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FAQ;