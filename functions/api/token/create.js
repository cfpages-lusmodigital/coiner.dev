// worker.js
import {
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  Connection,
  PublicKey,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  mintTo,
  setAuthority,
  AuthorityType,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  createCreateMetadataAccountV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders
  });
}

async function uploadToIPFS(imageBuffer, metadata, env) {
  // Use Pinata API to upload image and metadata
  const pinataApiKey = env.PINATA_API_KEY; // Access via environment variable
  const pinataSecretApiKey = env.PINATA_SECRET_API_KEY; // Access via environment variable

  if (!pinataApiKey || !pinataSecretApiKey) {
    throw new Error('Pinata API key and secret must be set as environment variables.');
  }

  try {
    // Upload image
    const formDataImage = new FormData();
    formDataImage.append('file', new Blob([imageBuffer]), 'image');

    const imageResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataApiKey}`,
      },
      body: formDataImage,
    });

    if (!imageResponse.ok) {
      const errorData = await imageResponse.json();
      console.error('IPFS image upload failed:', errorData);
      throw new Error(`IPFS image upload failed: ${errorData.error}`);
    }

    const imageData = await imageResponse.json();
    const imageUri = `https://ipfs.io/ipfs/${imageData.IpfsHash}`;

    // Upload metadata
    const metadataWithImage = { ...metadata, image: imageUri };
    const formDataMetadata = new FormData();
    formDataMetadata.append('file', new Blob([JSON.stringify(metadataWithImage)], { type: 'application/json' }), 'metadata.json');

    const metadataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataApiKey}`,
      },
      body: formDataMetadata,
    });

    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.json();
      console.error('IPFS metadata upload failed:', errorData);
      throw new Error(`IPFS metadata upload failed: ${errorData.error}`);
    }

    const metadataData = await metadataResponse.json();
    const metadataUri = `https://ipfs.io/ipfs/${metadataData.IpfsHash}`;

    return {
      success: true,
      imageUri: imageUri,
      metadataUri: metadataUri
    };

  } catch (error) {
    console.error('IPFS upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to find Metadata PDA
const findMetadataPda = (mint) => {
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

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: corsHeaders
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const name = formData.get('name');
    const symbol = formData.get('symbol');
    const description = formData.get('description');
    const supply = formData.get('supply');
    const decimals = formData.get('decimals');
    const image = formData.get('image');
    const website = formData.get('website');
    const telegram = formData.get('telegram');
    const discord = formData.get('discord');
    const twitter = formData.get('twitter');
    const tags = formData.get('tags');
    
    // Advanced options
    const modifyCreatorAllowed = formData.get('modifyCreatorAllowed') === 'true';
    const customAddress = formData.get('customAddress') === 'true';
    const whitelistSupplyDistribution = formData.get('whitelistSupplyDistribution') === 'true';
    const addMintAuthority = formData.get('addMintAuthority') === 'true';
    const freezeAuthorities = JSON.parse(formData.get('freezeAuthorities') || '{}');
    
    // Create metadata
    const metadata = {
      name,
      symbol,
      description,
      decimals: parseInt(decimals),
      supply: parseInt(supply),
      social: {
        website,
        telegram,
        discord,
        twitter
      },
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };
    
    // Convert image to buffer
    const imageBuffer = await image.arrayBuffer();
    
    // Upload to IPFS
    const ipfsResult = await uploadToIPFS(imageBuffer, metadata, env);

    if (!ipfsResult.success) {
      throw new Error(`IPFS upload failed: ${ipfsResult.error}`);
    }
    
    // Solana token creation logic
    const network = 'devnet'; // You might want to get this from the request
    const connection = new Connection(clusterApiUrl(network), 'confirmed');

    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    // Get payer private key from environment variable
    const payerPrivateKey = env.PAYER_PRIVATE_KEY;
    if (!payerPrivateKey) {
      throw new Error('Payer private key must be set in environment variables');
    }

    // Convert private key string to Uint8Array
    const payerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(payerPrivateKey))
    );

    // Use payerKeypair instead of generating new one
    const feePayer = payerKeypair.publicKey;

    const lamportsForMint = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    const createMintAccountIx = SystemProgram.createAccount({
      newAccountPubkey: mint,
      lamports: lamportsForMint,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
      fromPubkey: feePayer,
    });

    const initMintIx = createInitializeMintInstruction(
      mint,
      parseInt(decimals),
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
      parseInt(supply) * (10 ** parseInt(decimals)),
      [],
      TOKEN_PROGRAM_ID
    );

    // Metadata logic
    const metadataPDA = findMetadataPda(mint);

    const createMetadataIx = createCreateMetadataAccountV3Instruction({
      metadata: metadataPDA,
      mint: mint,
      mintAuthority: feePayer,
      payer: feePayer,
      updateAuthority: feePayer,
    }, {
      createArgsV3: {
        data: {
          name: name,
          symbol: symbol,
          uri: ipfsResult.metadataUri,
          sellerFeeBasisPoints: 0,
          creators: null,
        },
        isMutable: true,
        collectionDetails: null
      }
    });

    let freezeAuthority = null;
    if (freezeAuthorities.freeze || freezeAuthorities.thaw || freezeAuthorities.update) {
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

    tx.sign(mintKeypair, payerKeypair);

    const txid = await connection.sendTransaction(tx, [mintKeypair, payerKeypair]);

    await connection.confirmTransaction(txid);

    console.log('Transaction ID:', txid);

    return new Response(JSON.stringify({
      success: true,
      tokenAddress: mint.toBase58(),
      metadata: {
        ...metadata,
        image: ipfsResult.imageUri,
        metadataUri: ipfsResult.metadataUri
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  const url = new URL(request.url);
  
  if (url.pathname === '/api/token/create' && request.method === 'POST') {
    return createToken(request, env);
  }
  
  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

