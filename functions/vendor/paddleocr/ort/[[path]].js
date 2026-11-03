const TYPES = {
  '.wasm': 'application/wasm',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript'
};

export async function onRequest({ env, params }) {
  const parts = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  if (!parts.length) return new Response('Not found', { status: 404 });

  const key = 'vendor/paddleocr/ort/' + parts.join('/');
  const obj = await env.MODELS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  const ext = key.slice(key.lastIndexOf('.'));
  if (TYPES[ext]) headers.set('Content-Type', TYPES[ext]);

  return new Response(obj.body, { headers });
}
