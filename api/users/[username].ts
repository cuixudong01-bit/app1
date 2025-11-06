import { db, verifyAdmin } from '../_lib';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response(JSON.stringify({ message: '未经授权。' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);
  const username = url.pathname.split('/').pop();

  if (request.method === 'DELETE') {
    if (!username) {
        return new Response(JSON.stringify({ message: '未提供用户名。'}), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (username === 'admin') {
        return new Response(JSON.stringify({ message: '不能删除管理员账户。'}), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const success = db.deleteUser(username);
    if (success) {
      return new Response(JSON.stringify({ message: `用户 "${username}" 已被删除。` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({ message: '未找到用户。' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
  } else {
    return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
  }
}
