import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')!;
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')!;
    const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

    const { action, phone, message, imageUrl, audioUrl, caption } = await req.json();

    // log minimal context only
    console.log(`[Z-API Send] action=${action} user=${claimsData.claims.sub}`);

    let endpoint = '';
    let method: 'GET' | 'POST' = 'POST';
    let body: any = {};
    let query = '';

    switch (action) {
      case 'send-text':
        endpoint = '/send-text';
        body = {
          phone,
          message,
        };
        break;

      case 'send-image':
        endpoint = '/send-image';
        body = {
          phone,
          image: imageUrl,
          caption: caption || '',
        };
        break;

      case 'send-audio':
        endpoint = '/send-audio';
        body = {
          phone,
          audio: audioUrl,
        };
        break;

      case 'get-profile-picture':
        endpoint = '/profile-picture';
        method = 'GET';
        // Z-API expects phone without '+'
        query = phone ? `?phone=${encodeURIComponent(String(phone).replace('+', ''))}` : '';
        break;

      case 'get-status':
        endpoint = '/status';
        method = 'GET';
        break;

      case 'get-qrcode':
        endpoint = '/qr-code/image';
        method = 'GET';
        break;

      case 'disconnect':
        endpoint = '/disconnect';
        break;

      case 'restart':
        endpoint = '/restart';
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch(`${ZAPI_BASE_URL}${endpoint}${query}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': Deno.env.get('ZAPI_SECURITY_TOKEN') || '',
      },
      body: method === 'POST' && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Send Error]', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
