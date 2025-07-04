import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from './fastify-api.js';
import type { FastifyInstance } from 'fastify';

describe.skip('Fastify API with ZeroThrow', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /tasks', () => {
    it('should return empty tasks list initially', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/tasks'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: []
      });
    });
  });

  describe('POST /tasks', () => {
    it('should create task with valid data', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: taskData
      });

      expect(response.statusCode).toBe(201);
      
      const responseBody = response.json();
      expect(responseBody).toEqual({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          title: taskData.title,
          description: taskData.description,
          completed: false,
          createdAt: expect.any(String)
        })
      });
    });

    it('should return validation error for missing title', async () => {
      const taskData = {
        description: 'Test Description'
        // title missing
      };

      const response = await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: taskData
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task title is required',
          context: { field: 'title' }
        }
      });
    });

    it('should handle empty title', async () => {
      const taskData = {
        title: '   ', // Empty/whitespace title
        description: 'Test Description'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: taskData
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task title is required',
          context: { field: 'title' }
        }
      });
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/tasks/non-existent'
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task with id non-existent not found',
          context: { taskId: 'non-existent' }
        }
      });
    });

    it('should return task after creation', async () => {
      // First create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          description: 'Test Description'
        }
      });

      const createdTask = createResponse.json().data;

      // Then fetch it
      const getResponse = await server.inject({
        method: 'GET',
        url: `/tasks/${createdTask.id}`
      });

      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json()).toEqual({
        success: true,
        data: createdTask
      });
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update existing task', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Original Task',
          description: 'Original Description'
        }
      });

      const taskId = createResponse.json().data.id;

      // Update the task
      const updateResponse = await server.inject({
        method: 'PUT',
        url: `/tasks/${taskId}`,
        payload: {
          title: 'Updated Task',
          completed: true
        }
      });

      expect(updateResponse.statusCode).toBe(200);
      
      const updatedTask = updateResponse.json().data;
      expect(updatedTask).toEqual(expect.objectContaining({
        id: taskId,
        title: 'Updated Task',
        description: 'Original Description', // Should remain unchanged
        completed: true
      }));
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete existing task', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Task to Delete'
        }
      });

      const taskId = createResponse.json().data.id;

      // Delete the task
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/tasks/${taskId}`
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json()).toEqual({
        success: true,
        data: { success: true }
      });

      // Verify task is deleted
      const getResponse = await server.inject({
        method: 'GET',
        url: `/tasks/${taskId}`
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('GET /tasks/search', () => {
    it('should return validation error when query is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/tasks/search'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required',
          context: { field: 'q' }
        }
      });
    });

    it('should search tasks by title', async () => {
      // Create some tasks
      await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: { title: 'Important Task', description: 'Very important' }
      });

      await server.inject({
        method: 'POST',
        url: '/tasks',
        payload: { title: 'Regular Task', description: 'Not so important' }
      });

      // Search for "important"
      const response = await server.inject({
        method: 'GET',
        url: '/tasks/search?q=important'
      });

      expect(response.statusCode).toBe(200);
      
      const results = response.json().data;
      expect(results).toHaveLength(2); // Both tasks contain "important"
      expect(results.every((task: any) => 
        task.title.toLowerCase().includes('important') || 
        task.description.toLowerCase().includes('important')
      )).toBe(true);
    });
  });
});