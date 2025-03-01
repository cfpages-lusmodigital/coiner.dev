// worker.js
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

async function uploadToIPFS(imageBuffer, metadata) {
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

async function createToken(request) {
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
    
    // Upload to IPFS (placeholder)
    const ipfsResult = await uploadToIPFS(imageBuffer, metadata);
    
    // In a real implementation, you would:
    // 1. Create a transaction to mint the token on Solana
    // 2. Return the transaction for the user to sign with their wallet
    // Here we'll just simulate a successful response
    
    return new Response(JSON.stringify({
      success: true,
      tokenAddress: '9xDUcWM8TSVKLqQH5aVt3NVfZs1YoEtgS6VJaKVujqNi',
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

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  const url = new URL(request.url);
  
  if (url.pathname === '/api/token/create' && request.method === 'POST') {
    return createToken(request);
  }
  
  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
