import { db, verifyAdmin } from '../_lib';

export const config = {
  runtime: 'edge',
};

// 函数需要变成 'async'
export default async function handler(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response(JSON.stringify({ message: '未经授权' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method !== 'DELETE') {
    return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
  }

  const url = new URL(request.url);
  const username = url.pathname.split('/').pop()!;

  // (重要) db.deleteUser 现在需要 'await'
  const deleted = await db.deleteUser(username);

  if (deleted) {
    return new Response(null, { status: 204 }); // No Content
  } else {
    return new Response(JSON.stringify({ message: '用户未找到' }), { status: 404 });
  }
}
