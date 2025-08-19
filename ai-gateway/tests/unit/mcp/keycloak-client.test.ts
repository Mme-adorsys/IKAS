import { KeycloakMCPClient } from '../../../src/mcp/keycloak-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KeycloakMCPClient', () => {
  let client: KeycloakMCPClient;

  beforeEach(() => {
    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    client = new KeycloakMCPClient('http://localhost:8001');
    
    // Set up the mock methods on the client's httpClient
    (client as any).httpClient = mockAxiosInstance;
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        enabled: true
      };

      const mockResponse = {
        status: 200,
        data: { userId: '123e4567-e89b-12d3-a456-426614174000' }
      };

      (client as any).httpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await client.createUser(userData);

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBeDefined();
      expect((client as any).httpClient.post).toHaveBeenCalledWith('/call-tool', {
        tool: 'create-user',
        arguments: userData
      });
    });

    it('should handle creation errors', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com'
      };

      (client as any).httpClient.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.createUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('listUsers', () => {
    it('should list users successfully', async () => {
      const mockUsers = [
        {
          id: '123',
          username: 'user1',
          email: 'user1@example.com',
          enabled: true,
          createdTimestamp: Date.now()
        },
        {
          id: '456', 
          username: 'user2',
          email: 'user2@example.com',
          enabled: false,
          createdTimestamp: Date.now()
        }
      ];

      const mockResponse = {
        status: 200,
        data: mockUsers
      };

      (client as any).httpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await client.listUsers('master', { max: 100 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect((client as any).httpClient.post).toHaveBeenCalledWith('/call-tool', {
        tool: 'list-users',
        arguments: { realm: 'master', max: 100 }
      });
    });
  });

  describe('findUserByUsername', () => {
    it('should find user by username', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        enabled: true,
        createdTimestamp: Date.now()
      };

      const mockResponse = {
        status: 200,
        data: [mockUser]
      };

      (client as any).httpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await client.findUserByUsername('testuser');

      expect(result.success).toBe(true);
      expect(result.data?.username).toBe('testuser');
    });

    it('should return null for non-existent user', async () => {
      const mockResponse = {
        status: 200,
        data: [] as any[]
      };

      (client as any).httpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await client.findUserByUsername('nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy service', async () => {
      (client as any).httpClient.get.mockResolvedValueOnce({ status: 200 });

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect((client as any).httpClient.get).toHaveBeenCalledWith('/health', { timeout: 3000 });
    });

    it('should return false for unhealthy service', async () => {
      (client as any).httpClient.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });
});