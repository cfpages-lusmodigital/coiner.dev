import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Keypair, Transaction } from '@solana/web3.js';
import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata';
import { createInitializeMintInstruction, MINT_SIZE, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TokenForm = ({ network, fee }) => {
  const { publicKey, signTransaction } = useWallet();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    supply: '1000000',
    decimals: '9',
    image: null,
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
    tags: '',
  });

  const [advancedOptions, setAdvancedOptions] = useState({
    modifyCreatorAllowed: false,
    customAddress: false,
    whitelistSupplyDistribution: false,
    addMintAuthority: false,
    freezeAuthority: {
      freeze: false,
      thaw: false,
      update: false
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        image: file
      });
    }
  };

  const handleAdvancedOptionsChange = (option, value) => {
    setAdvancedOptions({
      ...advancedOptions,
      [option]: value
    });
  };

  const handleFreezeAuthorityChange = (option, value) => {
    setAdvancedOptions({
      ...advancedOptions,
      freezeAuthority: {
        ...advancedOptions.freezeAuthority,
        [option]: value
      }
    });
  };

  const createToken = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Upload metadata to IPFS
      // TODO: Set PINATA_API_KEY and PINATA_SECRET_API_KEY in Cloudflare Pages environment variables
      const pinataApiKey = import.meta.env.VITE_PINATA_API_KEY;
      const pinataSecretApiKey = import.meta.env.VITE_PINATA_SECRET_API_KEY;

      if (!pinataApiKey || !pinataSecretApiKey) {
        throw new Error('Pinata API key and secret must be set in Cloudflare Pages environment variables.');
      }

      const metadata = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        decimals: parseInt(formData.decimals),
        supply: parseInt(formData.supply),
        image: formData.image ? URL.createObjectURL(formData.image) : null, // Use a placeholder if no image
        website: formData.website,
        twitter: formData.twitter,
        telegram: formData.telegram,
        discord: formData.discord,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
      };

      const formDataIPFS = new FormData();
      formDataIPFS.append('file', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');

      const ipfsResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pinataApiKey}`,
        },
        body: formDataIPFS,
      });

      if (!ipfsResponse.ok) {
        const errorData = await ipfsResponse.json();
        console.error('IPFS upload failed:', errorData);
        throw new Error(`IPFS upload failed: ${errorData.error}`);
      }

      const ipfsData = await ipfsResponse.json();
      const metadataUri = `https://ipfs.io/ipfs/${ipfsData.IpfsHash}`;
      console.log('Metadata URI:', metadataUri);

      // 2. Create a new token mint
      const connection = new Connection(clusterApiUrl(network), 'confirmed');
      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey;

      const feePayer = publicKey;

      const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);

      const createMintAccountIx = SystemProgram.createAccount({
        newAccountPubkey: mint,
        lamports: lamportsForMint,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        fromPubkey: feePayer,
      });

      const decimals = parseInt(formData.decimals);

      const initMintIx = createInitializeMintInstruction(
        mint,
        decimals,
        feePayer,
        feePayer,
        TOKEN_PROGRAM_ID
      );

      const mintAta = await getAssociatedTokenAddress(mint, feePayer);

      const createMintAtaIx = createAssociatedTokenAccountInstruction(
        feePayer,
        mintAta,
        feePayer,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const mintToIx = mintTo(
        connection,
        feePayer,
        mint,
        mintAta,
        feePayer,
        parseInt(formData.supply) * (10 ** decimals),
        [],
        TOKEN_PROGRAM_ID
      );

      // 3. Initialize the token with metadata
      const metadataPDA = await findMetadataPda(mint);

      const createMetadataIx = createCreateMetadataAccountV3Instruction({
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: feePayer,
        payer: feePayer,
        updateAuthority: feePayer,
      }, {
        createArgsV3: {
          data: {
            name: formData.name,
            symbol: formData.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            creators: null,
          },
          isMutable: true,
          collectionDetails: null
        }
      });

      // 4. Set up authorities based on advancedOptions
      let freezeAuthority = null;
      if (advancedOptions.freezeAuthority.freeze || advancedOptions.freezeAuthority.thaw || advancedOptions.freezeAuthority.update) {
        freezeAuthority = Keypair.generate().publicKey;

        const setFreezeAuthorityIx = setAuthority(
          mint,
          feePayer,
          freezeAuthority,
          AuthorityType.FreezeAccount,
          feePayer,
          []
        );
      }

      const blockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer,
      }).add(
        createMintAccountIx,
        initMintIx,
        createMintAtaIx,
        mintToIx,
        createMetadataIx
      );

      if (freezeAuthority) {
        const setFreezeAuthorityIx = setAuthority(
          mint,
          feePayer,
          freezeAuthority,
          AuthorityType.FreezeAccount,
          feePayer,
          []
        );
        tx.add(setFreezeAuthorityIx);
      }

      tx.sign(mintKeypair);

      const signedTransaction = await signTransaction(tx);
      const serializedTransaction = signedTransaction.serialize();

      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });
      formDataToSend.append('freezeAuthorities', JSON.stringify(advancedOptions.freezeAuthority));
      formDataToSend.append('serializedTransaction',  String.fromCharCode(...serializedTransaction));
      formDataToSend.append('mintKey', mint.toBase58());

      const response = await fetch('https://coiner-dev.lusmodigital.workers.dev/api/token/create', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create token');
      }

      setTokenAddress(result.tokenAddress);
      setSuccess(true);

    } catch (err) {
      console.error('Error creating token:', err);
      setError('Failed to create token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-green-500">🎉 Token Created Successfully!</CardTitle>
          <CardDescription>Your new token has been created on the {network} network.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Token Name:</strong> {formData.name}</p>
            <p><strong>Symbol:</strong> {formData.symbol}</p>
            <p><strong>Token Address:</strong> <a href={`https://explorer.solana.com/address/${tokenAddress}?cluster=${network}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{tokenAddress}</a></p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={() => window.open(`https://explorer.solana.com/address/${tokenAddress}?cluster=${network}`, '_blank')}>View on Explorer</Button>
          <Button variant="outline" onClick={() => setSuccess(false)}>Create Another Token</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="w-full max-w-4xl mx-auto">
        <form onSubmit={createToken}>
          <CardHeader>
            <CardTitle>Create your Solana Token</CardTitle>
            <CardDescription>Fill in the details below to create your new SPL token. Hover over the <span className="text-primary font-bold">?</span> icons for more information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Token Name</Label>
                  <Input id="name" name="name" placeholder="e.g. My Awesome Token" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">Token Symbol</Label>
                  <Input id="symbol" name="symbol" placeholder="e.g. MAT" value={formData.symbol} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="A short and sweet description of your token." value={formData.description} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="decimals">Decimal Places</Label>
                  <Select name="decimals" value={formData.decimals} onValueChange={(value) => handleSelectChange('decimals', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select decimals" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(10).keys()].map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supply">Total Supply</Label>
                  <Input id="supply" name="supply" type="number" placeholder="e.g. 1000000" value={formData.supply} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Token Image</Label>
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="image" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-800">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {formData.image ? (
                          <>
                            <img src={URL.createObjectURL(formData.image)} alt="Token" className="w-32 h-32 object-cover rounded-full" />
                            <p className="text-sm text-gray-400 mt-2">{formData.image.name}</p>
                          </>
                        ) : (
                          <>
                            <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                            </svg>
                            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                          </>
                        )}
                      </div>
                      <Input id="image" type="file" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <Tabs defaultValue="social">
              <TabsList>
                <TabsTrigger value="social">Social Links & Tags</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
              </TabsList>
              <TabsContent value="social" className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" name="website" placeholder="https://..." value={formData.website} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input id="twitter" name="twitter" placeholder="https://twitter.com/..." value={formData.twitter} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram">Telegram</Label>
                    <Input id="telegram" name="telegram" placeholder="https://t.me/..." value={formData.telegram} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord">Discord</Label>
                    <Input id="discord" name="discord" placeholder="https://discord.gg/..." value={formData.discord} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input id="tags" name="tags" placeholder="e.g. defi, nft, gaming" value={formData.tags} onChange={handleInputChange} />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="advanced" className="pt-6 space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="modifyCreatorAllowed" className="font-semibold">Allow Creator Metadata Modification</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-pointer text-primary font-bold">?</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This allows you to change the creator information (names, shares) after the token has been created. This is useful for adding or removing creators later.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch id="modifyCreatorAllowed" checked={advancedOptions.modifyCreatorAllowed} onCheckedChange={(value) => handleAdvancedOptionsChange('modifyCreatorAllowed', value)} />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="customAddress" className="font-semibold">Custom Token Address</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-pointer text-primary font-bold">?</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This feature is not yet implemented. It will allow you to choose a custom prefix for your token's address.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch id="customAddress" checked={advancedOptions.customAddress} onCheckedChange={(value) => handleAdvancedOptionsChange('customAddress', value)} disabled />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="whitelistSupplyDistribution" className="font-semibold">Multi-wallet Supply Distribution</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-pointer text-primary font-bold">?</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This feature is not yet implemented. It will allow you to distribute the initial supply to multiple wallets upon creation.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch id="whitelistSupplyDistribution" checked={advancedOptions.whitelistSupplyDistribution} onCheckedChange={(value) => handleAdvancedOptionsChange('whitelistSupplyDistribution', value)} disabled />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="addMintAuthority" className="font-semibold">Enable Minting More Tokens</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-pointer text-primary font-bold">?</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>By default, the mint authority is revoked after creation. Enable this to retain the ability to mint more tokens in the future.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch id="addMintAuthority" checked={advancedOptions.addMintAuthority} onCheckedChange={(value) => handleAdvancedOptionsChange('addMintAuthority', value)} />
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Label className="font-semibold">Freeze Authorities</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-pointer text-primary font-bold">?</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Freeze authorities allow you to freeze and unfreeze token accounts, effectively controlling who can transact with the token. This is an advanced feature and should be used with caution.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="freeze" checked={advancedOptions.freezeAuthority.freeze} onCheckedChange={(value) => handleFreezeAuthorityChange('freeze', value)} />
                      <label htmlFor="freeze" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Enable Freeze Authority (+0.5 SOL)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="thaw" checked={advancedOptions.freezeAuthority.thaw} onCheckedChange={(value) => handleFreezeAuthorityChange('thaw', value)} />
                      <label htmlFor="thaw" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Enable Thaw Authority (+0.5 SOL)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="update" checked={advancedOptions.freezeAuthority.update} onCheckedChange={(value) => handleFreezeAuthorityChange('update', value)} />
                      <label htmlFor="update" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Enable Update Authority (+0.5 SOL)
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <div>
              <p className="text-lg font-semibold">Total Fee: {fee} SOL</p>
            </div>
            <Button type="submit" disabled={loading || !publicKey}>
              {loading ? 'Creating Token...' : (publicKey ? 'Create Token' : 'Connect Wallet to Create')}
            </Button>
          </CardFooter>
          {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </form>
      </Card>
    </TooltipProvider>
  );
};

// Helper function to find Metadata PDA
const findMetadataPda = async (mint) => {
  const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdqcvzi28cj1uypaqc6ucpywnyp3gc");
  return PublicKey.findProgramAddressSync(
      [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          new PublicKey(mint).toBuffer(),
      ],
      METADATA_PROGRAM_ID
  )[0];
};

export default TokenForm;
