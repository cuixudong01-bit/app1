import { db, verifyAdmin, User } from '../_lib';

export const config = {
  runtime: 'edge',
};

// 函数需要变成 'async'
export default async function handler(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response(JSON.stringify({ message: '未经授权' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'GET') {
    // (重要) db.getUsers 现在需要 'await'
    const users = await db.getUsers();
    return new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    const { username, password, role } = (await request.json()) as User;

    if (!username || !password || !role) {
      return new Response(JSON.stringify({ message: '缺少字段' }), { status: 400 });
    }

    const newUser: User = { username, password, role };

    // (重要) db.addUser 现在需要 'await'
    const createdUser = await db.addUser(newUser);

    if (!createdUser) {
      return new Response(JSON.stringify({ message: '用户已存在' }), { status: 409 });
    }

    const { password: _, ...userWithoutPassword } = createdUser;
    return new Response(JSON.stringify(userWithoutPassword), { status: 201 });
  }

  return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
}
