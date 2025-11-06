import { db, ADMIN_TOKEN, USER_TOKEN_PREFIX } from './_lib';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
  }

  try {
    const { username, password } = await request.json();
    const user = db.findUser(username);

    if (!user || user.password !== password) {
      return new Response(JSON.stringify({ message: '用户名或密码无效。' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { password: _, ...userToSend } = user;
    const token = user.role === 'admin' ? ADMIN_TOKEN : `${USER_TOKEN_PREFIX}${user.username}`;

    return new Response(JSON.stringify({ user: userToSend, token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: '服务器内部错误。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
