import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; // I'll need to create this component as well.
import { CheckCircle2, Copy, Loader2, PartyPopper, Rocket, Twitter, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProgressStep = ({ text, status }) => (
    <div className="flex items-center gap-4">
        <div>
            {status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-gray-500" />}
            {status === 'loading' && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
            {status === 'complete' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
        </div>
        <p className={cn("text-lg", status === 'complete' && "text-gray-400 line-through")}>{text}</p>
    </div>
);

const LaunchModal = ({ open, setOpen, coinData }) => {
    const [status, setStatus] = useState('in-progress'); // 'in-progress' | 'success'
    const [progressSteps, setProgressSteps] = useState([
        { text: 'Confirming transaction on-chain', status: 'loading' },
        { text: 'Uploading image & metadata', status: 'pending' },
        { text: 'Creating SPL Token', status: 'pending' },
        { text: 'Deploying the trading market', status: 'pending' },
    ]);

    // Simulate progress for demonstration purposes
    useEffect(() => {
        if (open && status === 'in-progress') {
            const timeouts = [];
            progressSteps.forEach((_, index) => {
                const timeout = setTimeout(() => {
                    setProgressSteps(prev => {
                        const newSteps = [...prev];
                        if (newSteps[index]) newSteps[index].status = 'complete';
                        if (newSteps[index + 1]) newSteps[index + 1].status = 'loading';
                        return newSteps;
                    });
                }, (index + 1) * 2000); // 2 seconds per step
                timeouts.push(timeout);
            });

            const finalTimeout = setTimeout(() => {
                setStatus('success');
            }, (progressSteps.length + 1) * 2000);
            timeouts.push(finalTimeout);

            return () => timeouts.forEach(clearTimeout);
        }
    }, [open, status]);


    const resetAndClose = () => {
        setStatus('in-progress');
        setProgressSteps([
            { text: 'Confirming transaction on-chain', status: 'loading' },
            { text: 'Uploading image & metadata', status: 'pending' },
            { text: 'Creating SPL Token', status: 'pending' },
            { text: 'Deploying the trading market', status: 'pending' },
        ]);
        setOpen(false);
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Add a toast notification here in a future step
    }

    // Dummy data for success screen
    const tokenAddress = "8aZ2f...kL9P"; // Replace with real data later
    const tradeLink = `https://coiner.fun/coin/${tokenAddress}`;
    const solscanLink = `https://solscan.io/token/${tokenAddress}`;
    const twitterShareText = `I just launched ${coinData.name} ($${coinData.ticker}) on #Solana using @CoinerFun!\n\nCome trade it here:\n${tradeLink}\n\n#memecoin $${coinData.ticker}`;
    const telegramShareText = `🚀 Check out my new Solana coin, ${coinData.name} ($${coinData.ticker})! You can trade it instantly right here: ${tradeLink}`;


    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && resetAndClose()}>
            <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                {status === 'in-progress' && (
                    <>
                        <DialogHeader className="text-center">
                            <div className="flex justify-center mb-4">
                                <Rocket className="w-16 h-16 text-primary animate-bounce" />
                            </div>
                            <DialogTitle className="text-2xl">Launching {coinData.name}...</DialogTitle>
                            <DialogDescription>
                                Your coin is being deployed on the Solana blockchain. Please stay on this page.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {progressSteps.map((step, i) => <ProgressStep key={i} {...step} />)}
                        </div>
                        <DialogFooter className="text-center text-xs text-gray-400">
                            This can take up to 60 seconds. Thank you for your patience.
                        </DialogFooter>
                    </>
                )}

                {status === 'success' && (
                     <>
                        <DialogHeader className="text-center">
                            <div className="flex justify-center mb-4">
                                <PartyPopper className="w-16 h-16 text-yellow-400" />
                            </div>
                            <DialogTitle className="text-2xl">Congratulations! ${coinData.ticker} is Live!</DialogTitle>
                             <DialogDescription>
                                Your meme coin is now officially on the Solana blockchain.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                            <img src={coinData.image} alt={coinData.name} className="w-24 h-24 rounded-full" />
                            <h3 className="text-xl font-bold">{coinData.name} (${coinData.ticker})</h3>

                            <div className="w-full space-y-2">
                                <Label>Token Contract Address</Label>
                                <div className="flex items-center gap-2">
                                    <Input readOnly value={tokenAddress} className="bg-gray-800" />
                                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(tokenAddress)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button asChild size="lg"><a href={tradeLink} target="_blank">Trade ${coinData.ticker} Now</a></Button>
                                <Button asChild variant="outline" size="lg"><a href={solscanLink} target="_blank">View on Solscan</a></Button>
                            </div>

                            <div className="w-full space-y-2 text-center">
                                <Label>Share Your Coin!</Label>
                                <div className="flex justify-center gap-4">
                                    <Button asChild variant="ghost"><a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterShareText)}`} target="_blank"><Twitter /></a></Button>
                                    <Button asChild variant="ghost"><a href={`https://t.me/share/url?url=${encodeURIComponent(tradeLink)}&text=${encodeURIComponent(telegramShareText)}`} target="_blank"><Send /></a></Button>
                                </div>
                            </div>
                        </div>
                         <DialogFooter>
                             <Button onClick={resetAndClose} className="w-full">Done</Button>
                         </DialogFooter>
                     </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default LaunchModal;
