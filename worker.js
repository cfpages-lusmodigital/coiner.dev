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
  // This is a placeholder for actual IPFS upload logic
  // In a real implementation, you would use a service like Pinata, Infura, or NFT.Storage
  
  // Simulated IPFS response for demo
  return {
    success: true,
    imageUri: 'https://ipfs.io/ipfs/QmYtApksAmXPXEpqfPbyGgGQKMeA5yPHsaLy9GZK5AHVPQ',
    metadataUri: 'https://ipfs.io/ipfs/QmZcH4YvBVVRJtdn4RdbaqgspFU8gH6P9vomDpNVgpq8Hk'
  };
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
