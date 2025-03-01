// src/components/TokenForm.jsx
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Keypair, Transaction } from '@solana/web3.js';
import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata';
import { createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, mintTo, setAuthority, AuthorityType } from '@solana/spl-token';

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
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
      // Get Pinata API key and secret from environment variables
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
          'Authorization': `Bearer ${pinataApiKey}`, // Use Bearer token
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

      const txid = await connection.sendRawTransaction(signedTransaction.serialize());

      await connection.confirmTransaction(txid);

      console.log('Transaction ID:', txid);

      setSuccess(true);
      return mint.toBase58();

    } catch (err) {
      console.error('Error creating token:', err);
      setError('Failed to create token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="token-success">
        <h3>🎉 Token Created Successfully!</h3>
        <p>Your new token has been created on the {network} network.</p>
        <div className="token-details">
          <p><strong>Token Name:</strong> {formData.name}</p>
          <p><strong>Symbol:</strong> {formData.symbol}</p>
          <p><strong>Token Address:</strong> 9xDUcWM8TSVKLqQH5aVt3NVfZs1YoEtgS6VJaKVujqNi</p>
        </div>
        <button 
          className="primary-button"
          onClick={() => window.open(`https://explorer.solana.com/address/9xDUcWM8TSVKLqQH5aVt3NVfZs1YoEtgS6VJaKVujqNi?cluster=${network}`, '_blank')}
        >
          View on Solana Explorer
        </button>
        <button 
          className="secondary-button"
          onClick={() => setSuccess(false)}
        >
          Create Another Token
        </button>
      </div>
    );
  }

  return (
    <div className="token-form-container">
      <form onSubmit={createToken}>
        <div className="form-grid">
          <div className="form-column">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input 
                type="text" 
                id="name" 
                name="name"
                placeholder="Ex: Solana"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="symbol">Symbol</label>
              <input 
                type="text" 
                id="symbol" 
                name="symbol"
                placeholder="Ex: SOL"
                value={formData.symbol}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                placeholder="Describe your token and its purpose"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="decimals">Decimals</label>
              <select
                id="decimals"
                name="decimals"
                value={formData.decimals}
                onChange={handleInputChange}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
              </select>
            </div>
          </div>
          
          <div className="form-column">
            <div className="form-group">
              <label htmlFor="supply">Supply</label>
              <input 
                type="number" 
                id="supply" 
                name="supply"
                placeholder="Ex: 1000000"
                value={formData.supply}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="image">Image</label>
              <div className="image-upload-container">
                {formData.image ? (
                  <div className="image-preview">
                    <img src={URL.createObjectURL(formData.image)} alt="Token" />
                    <button 
                      type="button" 
                      className="remove-image"
                      onClick={() => setFormData({...formData, image: null})}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <p>Drag and drop here to upload</p>
                    <p>JPG, JPEG, PNG, or GIF</p>
                    <input
                      type="file"
                      id="image"
                      name="image"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="social-links-section">
          <h3>Add Social Links & Tags</h3>
          <div className="toggle-switch">
            <input 
              type="checkbox" 
              id="socialToggle" 
              checked={true} 
              readOnly
            />
            <label htmlFor="socialToggle"></label>
          </div>
          
          <div className="social-links">
            <div className="social-link">
              <label>
                <i className="icon-website"></i> Website
              </label>
              <input
                type="url"
                name="website"
                placeholder="Enter URL"
                value={formData.website}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="social-link">
              <label>
                <i className="icon-telegram"></i> Telegram
              </label>
              <input
                type="url"
                name="telegram"
                placeholder="Enter URL"
                value={formData.telegram}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="social-link">
              <label>
                <i className="icon-discord"></i> Discord
              </label>
              <input
                type="url"
                name="discord"
                placeholder="Enter URL"
                value={formData.discord}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="social-link">
              <label>
                <i className="icon-twitter"></i> Twitter
              </label>
              <input
                type="url"
                name="twitter"
                placeholder="Enter URL"
                value={formData.twitter}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="social-link tags-input">
              <label>Tags</label>
              <input
                type="text"
                name="tags"
                placeholder="Separate tags with commas"
                value={formData.tags}
                onChange={handleInputChange}
              />
              <div className="tags-count">0/5</div>
            </div>
          </div>
        </div>
        
        <div className="advanced-options">
          <h3>Advanced Options <i className="icon-arrow-down"></i></h3>
          
          <div className="advanced-option">
            <div className="option-info">
              <h4>Modify Creator Metadata (v1.3 SOL)</h4>
              <p>Flexibility to specify if changes to creator names or shares are permitted.</p>
            </div>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                id="modifyCreatorAllowed" 
                checked={advancedOptions.modifyCreatorAllowed} 
                onChange={(e) => handleAdvancedOptionsChange('modifyCreatorAllowed', e.target.checked)}
              />
              <label htmlFor="modifyCreatorAllowed"></label>
            </div>
          </div>
          
          <div className="advanced-option">
            <div className="option-info">
              <h4>Custom Address (Custom v1.3 SOL)</h4>
              <p>Customize the beginning prefix of the end of your token address instead of a random address.</p>
            </div>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                id="customAddress" 
                checked={advancedOptions.customAddress} 
                onChange={(e) => handleAdvancedOptionsChange('customAddress', e.target.checked)}
              />
              <label htmlFor="customAddress"></label>
            </div>
          </div>
          
          <div className="advanced-option">
            <div className="option-info">
              <h4>Multi-Wallet Supply Distribution (v1.3 SOL)</h4>
              <p>Enable multiple token drops to different wallets on deployment.</p>
            </div>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                id="whitelistSupplyDistribution" 
                checked={advancedOptions.whitelistSupplyDistribution} 
                onChange={(e) => handleAdvancedOptionsChange('whitelistSupplyDistribution', e.target.checked)}
              />
              <label htmlFor="whitelistSupplyDistribution"></label>
            </div>
          </div>
          
          <div className="advanced-option">
            <div className="option-info">
              <h4>Add MINT Authority - Bypass (v1.3 SOL)</h4>
              <p>Mint the determined amount of tokens to your wallet.</p>
            </div>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                id="addMintAuthority" 
                checked={advancedOptions.addMintAuthority} 
                onChange={(e) => handleAdvancedOptionsChange('addMintAuthority', e.target.checked)}
              />
              <label htmlFor="addMintAuthority"></label>
            </div>
          </div>
          
          <div className="advanced-option">
            <div className="option-info">
              <h4>Freeze Authorities</h4>
              <p>Choose what kind of freeze authorities you want to enable.</p>
            </div>
            
            <div className="freeze-authorities">
              <div className="freeze-authority">
                <label>
                  <input 
                    type="checkbox" 
                    checked={advancedOptions.freezeAuthority.freeze} 
                    onChange={(e) => handleFreezeAuthorityChange('freeze', e.target.checked)}
                  />
                  <span className="auth-name">Freeze</span>
                  <span className="auth-desc">You will be able to freeze transfer/trading on individual addresses</span>
                </label>
                <span className="auth-fee">+0.5 SOL</span>
              </div>
              
              <div className="freeze-authority">
                <label>
                  <input 
                    type="checkbox" 
                    checked={advancedOptions.freezeAuthority.thaw} 
                    onChange={(e) => handleFreezeAuthorityChange('thaw', e.target.checked)}
                  />
                  <span className="auth-name">Thaw</span>
                  <span className="auth-desc">You will be able to enable transfer/trading on individual addresses</span>
                </label>
                <span className="auth-fee">+0.5 SOL</span>
              </div>
              
              <div className="freeze-authority">
                <label>
                  <input 
                    type="checkbox" 
                    checked={advancedOptions.freezeAuthority.update} 
                    onChange={(e) => handleFreezeAuthorityChange('update', e.target.checked)}
                  />
                  <span className="auth-name">Update</span>
                  <span className="auth-desc">You will be able to update your token metadata</span>
                </label>
                <span className="auth-fee">+0.5 SOL</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="create-token-summary">
          <div className="estimated-fee">
            <span>Total Fees:</span>
            <span className="fee-amount">{fee} SOL</span>
          </div>
          
          <button 
            type="submit" 
            className="connect-wallet-button"
            disabled={loading}
          >
            {loading ? 'Creating Token...' : 'Connect Wallet'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
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
