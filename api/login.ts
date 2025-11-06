import { db, ADMIN_TOKEN, USER_TOKEN_PREFIX } from './_lib';

export const config = {
  runtime: 'edge',
};

// 函数需要变成 'async'
export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
  }

  const { username, password } = await request.json();

  // (重要) db.findUser 现在需要 'await'
  const user = await db.findUser(username);

  if (!user) {
    return new Response(JSON.stringify({ message: '用户不存在' }), { status: 404 });
  }

  // 警告: 纯文本比较.
  if (user.password !== password) {
    return new Response(JSON.stringify({ message: '密码错误' }), { status: 401 });
  }

  let token;
  if (user.role === 'admin') {
    token = ADMIN_TOKEN;
  } else {
    token = `${USER_TOKEN_PREFIX}${user.username}`;
  }

  return new Response(JSON.stringify({ 
    token, 
    user: { username: user.username, role: user.role } 
  }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
  });
}
