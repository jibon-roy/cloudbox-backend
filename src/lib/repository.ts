import logger from '../utils/logger/logger';
import { prisma } from './prisma';
import type { PrismaClient } from '@prisma/client';

/**
 * Base Repository class for abstracting database operations
 * Provides common CRUD operations and makes testing/swapping DB easier
 */
export class BaseRepository<T> {
  protected modelName: string;
  private model: any;

  constructor(modelName: keyof typeof prisma) {
    this.modelName = String(modelName);
    this.model = (prisma as any)[modelName];

    if (!this.model) {
      throw new Error(`Model ${String(modelName)} not found in Prisma client`);
    }
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({
        message: `Error finding ${this.modelName} by ID`,
        error,
        id,
      });
      throw error;
    }
  }

  /**
   * Find a single record by condition
   */
  async findOne(where: Record<string, any>): Promise<T | null> {
    try {
      return await this.model.findFirst({
        where,
      });
    } catch (error) {
      logger.error({
        message: `Error finding ${this.modelName}`,
        error,
        where,
      });
      throw error;
    }
  }

  /**
   * Find multiple records
   */
  async find(
    where?: Record<string, any>,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Record<string, any>;
    }
  ): Promise<T[]> {
    try {
      return await this.model.findMany({
        where: where || {},
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy,
      });
    } catch (error) {
      logger.error({
        message: `Error finding ${this.modelName} records`,
        error,
        where,
      });
      throw error;
    }
  }

  /**
   * Count records matching condition
   */
  async count(where?: Record<string, any>): Promise<number> {
    try {
      return await this.model.count({
        where: where || {},
      });
    } catch (error) {
      logger.error({
        message: `Error counting ${this.modelName} records`,
        error,
        where,
      });
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      return await this.model.create({
        data,
      });
    } catch (error) {
      logger.error({
        message: `Error creating ${this.modelName}`,
        error,
        data,
      });
      throw error;
    }
  }

  /**
   * Create multiple records
   */
  async createMany(data: Partial<T>[]): Promise<any> {
    try {
      return await this.model.createMany({
        data,
      });
    } catch (error) {
      logger.error({
        message: `Error creating multiple ${this.modelName} records`,
        error,
      });
      throw error;
    }
  }

  /**
   * Update a record by ID
   */
  async updateById(id: string, data: Partial<T>): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error({
        message: `Error updating ${this.modelName}`,
        error,
        id,
        data,
      });
      throw error;
    }
  }

  /**
   * Update record by condition
   */
  async updateOne(where: Record<string, any>, data: Partial<T>): Promise<T | null> {
    try {
      return await this.model.update({
        where,
        data,
      });
    } catch (error) {
      logger.error({
        message: `Error updating ${this.modelName}`,
        error,
        where,
        data,
      });
      throw error;
    }
  }

  /**
   * Update multiple records
   */
  async updateMany(where: Record<string, any>, data: Partial<T>): Promise<any> {
    try {
      return await this.model.updateMany({
        where,
        data,
      });
    } catch (error) {
      logger.error({
        message: `Error updating multiple ${this.modelName} records`,
        error,
        where,
      });
      throw error;
    }
  }

  /**
   * Delete a record by ID (soft delete if deleted_at field exists)
   */
  async deleteById(id: string, softDelete: boolean = true): Promise<T> {
    try {
      if (softDelete) {
        return await this.model.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      }
      return await this.model.delete({
        where: { id },
      });
    } catch (error) {
      logger.error({
        message: `Error deleting ${this.modelName}`,
        error,
        id,
      });
      throw error;
    }
  }

  /**
   * Delete records by condition (soft delete if deleted_at field exists)
   */
  async deleteMany(where: Record<string, any>, softDelete: boolean = true): Promise<any> {
    try {
      if (softDelete) {
        return await this.model.updateMany({
          where,
          data: { deleted_at: new Date() },
        });
      }
      return await this.model.deleteMany({
        where,
      });
    } catch (error) {
      logger.error({
        message: `Error deleting multiple ${this.modelName} records`,
        error,
        where,
      });
      throw error;
    }
  }

  /**
   * Hard delete a record (permanently)
   */
  async hardDeleteById(id: string): Promise<T> {
    try {
      return await this.model.delete({
        where: { id },
      });
    } catch (error) {
      logger.error({
        message: `Error hard deleting ${this.modelName}`,
        error,
        id,
      });
      throw error;
    }
  }

  /**
   * Restore a soft-deleted record
   */
  async restoreById(id: string): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data: { deleted_at: null },
      });
    } catch (error) {
      logger.error({
        message: `Error restoring ${this.modelName}`,
        error,
        id,
      });
      throw error;
    }
  }

  /**
   * Execute a raw transaction
   */
  async transaction<R>(callback: (prismaClient: PrismaClient) => Promise<R>): Promise<R> {
    try {
      return await prisma.$transaction<R>(callback as any);
    } catch (error) {
      logger.error({
        message: `Error in transaction for ${this.modelName}`,
        error,
      });
      throw error;
    }
  }
}

export default BaseRepository;
