// functions/api/upload-metadata.js
// Stateless IPFS Pinning & Metadata Proxy for coiner.dev
// Zero server wallets, zero private keys, zero server transaction fees.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Expected multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await request.formData();
    const name = (formData.get('name') || '').trim();
    const symbol = (formData.get('symbol') || '').trim().toUpperCase();
    const description = (formData.get('description') || '').trim();
    const decimals = parseInt(formData.get('decimals') || '6', 10);
    const supply = formData.get('supply') || '1000000000';
    const website = (formData.get('website') || '').trim();
    const twitter = (formData.get('twitter') || '').trim();
    const telegram = (formData.get('telegram') || '').trim();
    const discord = (formData.get('discord') || '').trim();
    const imageFile = formData.get('image');

    if (!name || !symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token Name and Symbol are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let imageUri = '';
    let metadataUri = '';

    // Check Pinata credentials in Pages environment
    const pinataJwt = env.PINATA_JWT;
    const pinataApiKey = env.PINATA_API_KEY || env.VITE_PINATA_API_KEY;
    const pinataSecretKey = env.PINATA_SECRET_API_KEY || env.VITE_PINATA_SECRET_API_KEY;

    const hasJwt = !!pinataJwt;
    const hasKeys = !!(pinataApiKey && pinataSecretKey);

    if (hasJwt || hasKeys) {
      // 1. Upload image to Pinata IPFS
      if (imageFile && typeof imageFile === 'object' && imageFile.size > 0) {
        const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (imageFile.type && !ALLOWED_MIMES.includes(imageFile.type)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid image format. Allowed: PNG, JPG, WebP, GIF, SVG.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (imageFile.size > 5 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ success: false, error: 'Image file size exceeds 5MB limit.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const imgFormData = new FormData();
        imgFormData.append('file', imageFile, imageFile.name || 'token_logo.png');

        const imgHeaders = hasJwt
          ? { Authorization: `Bearer ${pinataJwt}` }
          : { pinata_api_key: pinataApiKey, pinata_secret_api_key: pinataSecretKey };

        const imgRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: imgHeaders,
          body: imgFormData,
        });

        if (!imgRes.ok) {
          const errText = await imgRes.text();
          throw new Error(`Failed to pin image to IPFS: ${errText}`);
        }

        const imgData = await imgRes.json();
        imageUri = `https://gateway.pinata.cloud/ipfs/${imgData.IpfsHash}`;
      }

      // 2. Build Metaplex Token Metadata Standard JSON
      const metadataPayload = {
        name,
        symbol,
        description,
        image: imageUri,
        seller_fee_basis_points: 0,
        attributes: [],
        properties: {
          files: imageUri ? [{ uri: imageUri, type: imageFile?.type || 'image/png' }] : [],
          category: 'image',
          creators: [],
        },
        extensions: {
          ...(website ? { website } : {}),
          ...(twitter ? { twitter } : {}),
          ...(telegram ? { telegram } : {}),
          ...(discord ? { discord } : {}),
        },
      };

      // 3. Upload Metadata JSON to Pinata IPFS
      const metaFormData = new FormData();
      const metaBlob = new Blob([JSON.stringify(metadataPayload, null, 2)], {
        type: 'application/json',
      });
      metaFormData.append('file', metaBlob, 'metadata.json');

      const metaHeaders = hasJwt
        ? { Authorization: `Bearer ${pinataJwt}` }
        : { pinata_api_key: pinataApiKey, pinata_secret_api_key: pinataSecretKey };

      const metaRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: metaHeaders,
        body: metaFormData,
      });

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        throw new Error(`Failed to pin metadata to IPFS: ${errText}`);
      }

      const metaData = await metaRes.json();
      metadataUri = `https://gateway.pinata.cloud/ipfs/${metaData.IpfsHash}`;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Pinata IPFS credentials (PINATA_API_KEY and PINATA_SECRET_KEY, or PINATA_JWT) are not configured. Cannot pin immutable token metadata to IPFS.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUri,
        metadataUri,
        token: {
          name,
          symbol,
          decimals,
          supply,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal server error while processing metadata',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
