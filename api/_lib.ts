import { createClient } from '@vercel/kv';

// 1. 创建 KV 客户端 (它会自动读取 Vercel 注入的环境变量)
const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export interface User {
  username: string;
  password?: string; // 不应发送给前端
  role: 'user' | 'admin';
}

// 2. 数据库逻辑 (现在是 'async' 异步的)
export const db = {

  findUser: async (username: string): Promise<User | null> => {
    // 从 KV 中获取 'user:[username]'
    const user = await kv.get<User>(`user:${username}`);
    return user || null;
  },

  getUsers: async (): Promise<Omit<User, 'password'>[]> => {
    // 获取所有 'user:' 开头的 key
    const usernames = await kv.keys('user:*');
    const users: Omit<User, 'password'>[] = [];

    for (const key of usernames) {
      const user = await kv.get<User>(key);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        users.push(userWithoutPassword);
      }
    }
    return users;
  },

  addUser: async (user: User): Promise<User | null> => {
    const existing = await kv.get(`user:${user.username}`);
    if (existing) {
      return null; // 用户已存在
    }

    // 使用 kv.set 创建新用户
    await kv.set(`user:${user.username}`, user);
    return user;
  },

  deleteUser: async (username: string): Promise<boolean> => {
    // 使用 kv.del 删除用户
    const result = await kv.del(`user:${username}`);
    return result > 0;
  },
};

// 3. (重要) 初始化默认管理员
// 确保 admin 账户在数据库中始终存在
async function initializeAdmin() {
  const admin = await db.findUser('admin');
  if (!admin) {
    await db.addUser({
      username: 'admin',
      password: 'password', // 真实项目中请用哈希加密！
      role: 'admin',
    });
    console.log('Default admin user created in KV.');
  }
}

initializeAdmin();

// --- 认证逻辑 (保持不变) ---
export const ADMIN_TOKEN = 'secret-admin-token';
export const USER_TOKEN_PREFIX = 'secret-user-token-';

export function verifyAdmin(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  return token === ADMIN_TOKEN;
}
