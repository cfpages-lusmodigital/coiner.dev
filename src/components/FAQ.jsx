// src/components/FAQ.jsx
import React, { useState } from 'react';

const FAQ = () => {
  const [openQuestion, setOpenQuestion] = useState(null);
  
  const toggleQuestion = (index) => {
    if (openQuestion === index) {
      setOpenQuestion(null);
    } else {
      setOpenQuestion(index);
    }
  };
  
  const faqItems = [
    {
      question: "What is Solana Token Creator?",
      answer: "Solana Token Creator is a tool that allows you to create SPL tokens on the Solana blockchain without any coding knowledge. It simplifies the process of token creation, making it accessible to everyone."
    },
    {
      question: "Is it Safe to use Solana Token Creator here?",
      answer: "Yes, our Solana Token Creator is completely safe. We don't store your private keys or seed phrases. All transactions are signed directly through your connected wallet. The code is open-source and audited for security."
    },
    {
      question: "How much time will Solana Token Creator Take?",
      answer: "Creating a token usually takes less than a minute, depending on network congestion. Once you submit the transaction, you'll need to wait for it to be confirmed on the Solana blockchain."
    },
    {
      question: "How much does the Solana Token Creator Cost?",
      answer: "The cost to create a token is 0.5 SOL for mainnet and 0.1 SOL for devnet. This includes all the blockchain fees and the service fee."
    },
    {
      question: "Which wallet can I use?",
      answer: "Currently, we support Phantom wallet. We plan to add support for more wallets in the future including Solflare, Slope, and others."
    }
  ];
  
  return (
    <div className="faq-container">
      <h2>FREQUENTLY ASKED QUESTIONS</h2>
      
      <div className="faq-list">
        {faqItems.map((faq, index) => (
          <div 
            key={index} 
            className={`faq-item ${openQuestion === index ? 'open' : ''}`}
            onClick={() => toggleQuestion(index)}
          >
            <div className="faq-question">
              <h3>{faq.question}</h3>
              <div className="arrow-icon">
                {openQuestion === index ? '−' : '+'}
              </div>
            </div>
            
            {openQuestion === index && (
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="solana-maker-info">
        <h2>SOLANA TOKEN MAKER</h2>
        <p>
          If you're looking for an easy and efficient way to create SPL tokens on the
          Solana blockchain, you've come to the right place. Our Solana Token Maker is
          an intuitive and user-friendly platform that allows users to customize and
          deploy their own tokens with ease.
        </p>
        <p>
          With our comprehensive toolkit, you don't have to be a blockchain
          technology to create and manage your own tokens.
        </p>
        <p>
          At Coiner.dev, we prioritize user experience with high security and privacy. All
          transactions are conducted directly through your wallet, ensuring your private
          keys or seed phrases are secure. You can be sure that your assets are secured during the process and after
          it finishes.
        </p>
        <p>
          Whether you want a smooth and efficient experience when creating SPL
          tokens on the Solana blockchain, With our online creator, you can customize
          your tokens however you like. From token name, symbol, and supply to more
          advanced features like freeze authority and custom metadata.
        </p>
      </div>
      
      <div className="spl-token-creator-info">
        <h2>SPL TOKEN CREATOR</h2>
        <p>
          Whether you have development knowledge, our SPL Token Creator software is perfect. It will help you create
          tokens easily and securely, saving you time and money.
        </p>
        <p>
          Our customer support team is always available to assist you with anything. Our highly trained team is
          available 24/7 to help you resolve any issues or questions you may have.
        </p>
        <p>
          Start creating your tokens today on SPL Token on Solana today with our reliable and secure online maker. We
          make it simple for you to enter the world of cryptocurrency.
        </p>
      </div>
    </div>
  );
};

export default FAQ;
