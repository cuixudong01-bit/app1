import { db, verifyAdmin, User } from '../_lib';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response(JSON.stringify({ message: '未经授权。' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  switch (request.method) {
    case 'GET':
      return new Response(JSON.stringify(db.getUsers()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    case 'POST':
      try {
        const { username, password, role } = await request.json();
        if (!username || !password) {
            return new Response(JSON.stringify({ message: '用户名和密码不能为空。'}), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const newUser: User = { username, password, role: role || 'user' };
        const addedUser = db.addUser(newUser);

        if (!addedUser) {
          return new Response(JSON.stringify({ message: '用户已存在。' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }
        
        const { password: _, ...userToSend } = addedUser;
        return new Response(JSON.stringify(userToSend), { status: 201, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ message: '请求无效。' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

    default:
      return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
  }
}
