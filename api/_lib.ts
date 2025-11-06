export interface User {
  username: string;
  password?: string; // Password should not be sent to frontend
  role: 'user' | 'admin';
}

// WARNING: In-memory data store. Data resets on server restart.
// Replace with a real database (e.g., Vercel Postgres, KV) for production.
const users: User[] = [
  { username: 'admin', password: 'password', role: 'admin' },
  { username: 'user', password: 'password', role: 'user' },
];

export const db = {
  findUser: (username: string) => users.find(u => u.username === username),
  getUsers: () => users.map(({ password, ...user }) => user), // Exclude passwords
  addUser: (user: User) => {
    if (users.some(u => u.username === user.username)) {
      return null; // User already exists
    }
    users.push(user);
    return user;
  },
  deleteUser: (username: string) => {
    const index = users.findIndex(u => u.username === username);
    if (index > -1) {
      users.splice(index, 1);
      return true;
    }
    return false;
  },
};

// WARNING: Mock authentication. DO NOT USE IN PRODUCTION.
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
