import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './express-api.js';

describe('Express API with ZeroThrow', () => {
  const app = createApp();

  describe('GET /users/:id', () => {
    it('should return user when found', async () => {
      const response = await request(app)
        .get('/users/valid-id')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'valid-id',
          name: expect.any(String),
          email: expect.any(String)
        })
      });
    });

    it('should return 404 when user not found', async () => {
      const response = await request(app)
        .get('/users/invalid-id')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: expect.stringContaining('User with id invalid-id not found'),
          context: { userId: 'invalid-id' }
        }
      });
    });
  });

  describe('POST /users', () => {
    it('should create user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          name: userData.name,
          email: userData.email
        })
      });
    });

    it('should return validation error for invalid name', async () => {
      const userData = {
        name: 'A', // Too short
        email: 'john@example.com'
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name must be at least 2 characters long',
          context: expect.objectContaining({
            field: 'name'
          })
        }
      });
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          context: expect.objectContaining({
            field: 'email'
          })
        }
      });
    });
  });

  describe('PUT /users/:id', () => {
    it('should update existing user', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put('/users/existing-id')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'existing-id',
          name: updateData.name,
          email: updateData.email
        })
      });
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete existing user', async () => {
      const response = await request(app)
        .delete('/users/existing-id')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'User deleted successfully'
        }
      });
    });

    it('should return 404 when trying to delete non-existent user', async () => {
      const response = await request(app)
        .delete('/users/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: expect.stringContaining('User with id non-existent not found'),
          context: { userId: 'non-existent' }
        }
      });
    });
  });
});