/**
 * Authentication & Authorization Service
 * ======================================
 * JWT token generation, validation, role-based access control
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import express, { Request, Response, NextFunction } from 'express';

// User roles
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  VIEWER = 'viewer',
}

// Extended request with authenticated user
export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    orgId: number;
    role: UserRole;
  };
}

/**
 * Authentication Service Class
 * ===========================
 */
export class AuthService {
  private db: Pool;
  private jwtSecret: string;
  private jwtExpiresIn = '7d';

  constructor(db: Pool, jwtSecret: string) {
    this.db = db;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: {
    id: number;
    email: string;
    orgId: number;
    role: UserRole;
  }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        orgId: user.orgId,
        role: user.role,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (err) {
      throw new Error('Invalid token');
    }
  }

  /**
   * User registration
   */
  async register(
    email: string,
    password: string,
    name: string,
    orgId: number,
    role: UserRole = UserRole.VIEWER
  ): Promise<{
    id: number;
    email: string;
    token: string;
  }> {
    // Check if user exists
    const existing = await this.db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const result = await this.db.query(
      `INSERT INTO users (email, password_hash, name, org_id, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email`,
      [email, passwordHash, name, orgId, role]
    );

    const user = result.rows[0];

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      orgId,
      role,
    });

    return {
      id: user.id,
      email: user.email,
      token,
    };
  }

  /**
   * User login
   */
  async login(
    email: string,
    password: string
  ): Promise<{
    id: number;
    email: string;
    name: string;
    role: UserRole;
    token: string;
  }> {
    // Get user
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      orgId: user.org_id,
      role: user.role,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      token,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<any> {
    const result = await this.db.query(
      'SELECT id, email, name, org_id, role FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0];
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: number, role: UserRole): Promise<void> {
    await this.db.query('UPDATE users SET role = $1 WHERE id = $2', [
      role,
      userId,
    ]);
  }

  /**
   * Create API key for service-to-service authentication
   */
  async createApiKey(
    name: string,
    orgId: number,
    permissions: string[]
  ): Promise<{
    id: string;
    key: string;
  }> {
    const id = Buffer.from(`${orgId}-${Date.now()}`).toString('base64');
    const key = Buffer.from(
      `${id}-${crypto.randomUUID()}`
    ).toString('base64');

    await this.db.query(
      `INSERT INTO api_keys (id, key_hash, org_id, name, permissions)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        await this.hashPassword(key),
        orgId,
        name,
        JSON.stringify(permissions),
      ]
    );

    return { id, key };
  }

  /**
   * Verify API key
   */
  async verifyApiKey(
    id: string,
    key: string
  ): Promise<{
    orgId: number;
    permissions: string[];
  }> {
    const result = await this.db.query(
      'SELECT * FROM api_keys WHERE id = $1 AND active = true',
      [id]
    );

    const apiKey = result.rows[0];

    if (!apiKey) {
      throw new Error('Invalid API key');
    }

    // Verify key hash
    const isValid = await this.verifyPassword(key, apiKey.key_hash);

    if (!isValid) {
      throw new Error('Invalid API key');
    }

    // Update last used timestamp
    await this.db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [id]
    );

    return {
      orgId: apiKey.org_id,
      permissions: JSON.parse(apiKey.permissions),
    };
  }
}

/**
 * Express Middleware - Authentication
 * Validates JWT token from Authorization header
 */
export function authMiddleware(jwtSecret: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded as any;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

/**
 * Express Middleware - Role-based Access Control
 * Restricts endpoints to users with specific roles
 */
export function requiredRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Express Middleware - Organization isolation
 * Ensures users can only access data from their organization
 */
export function orgIsolationMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Add orgId to request for use in queries
  (req as any).orgId = req.user.orgId;

  next();
}

/**
 * Setup authentication routes
 */
export function setupAuthRoutes(
  app: express.Application,
  authService: AuthService
) {
  /**
   * POST /auth/register
   * Register new user
   */
  app.post('/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, orgId, role } = req.body;

      if (!email || !password || !name || !orgId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await authService.register(
        email,
        password,
        name,
        orgId,
        role || UserRole.VIEWER
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * POST /auth/login
   * Login user with email/password
   */
  app.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: 'Email and password required' });
      }

      const result = await authService.login(email, password);

      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  /**
   * GET /auth/me
   * Get current user info (requires auth)
   */
  app.get(
    '/auth/me',
    authMiddleware(process.env.JWT_SECRET || 'secret'),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await authService.getUserById(req.user.id);

        res.json(user);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  /**
   * POST /auth/refresh-token
   * Refresh JWT token (requires valid token)
   */
  app.post(
    '/auth/refresh-token',
    authMiddleware(process.env.JWT_SECRET || 'secret'),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authService.generateToken(req.user);

        res.json({ token });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  /**
   * POST /auth/api-key
   * Create API key for service-to-service auth (admin only)
   */
  app.post(
    '/auth/api-key',
    authMiddleware(process.env.JWT_SECRET || 'secret'),
    requiredRole(UserRole.ADMIN),
    async (req: AuthRequest, res: Response) => {
      try {
        const { name, permissions } = req.body;

        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = await authService.createApiKey(
          name,
          req.user.orgId,
          permissions || []
        );

        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );
}

export default AuthService;
