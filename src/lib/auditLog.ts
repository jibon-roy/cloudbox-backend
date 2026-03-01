import { prisma } from '../lib/prisma';
import logger from '../utils/logger/logger';

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  SHARE = 'SHARE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PAYMENT = 'PAYMENT',
}

export enum AuditEntityType {
  USER = 'USER',
  FILE = 'FILE',
  FOLDER = 'FOLDER',
  SHARE = 'SHARE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  BILLING = 'BILLING',
  AUTH = 'AUTH',
}

interface AuditLogInput {
  userId?: string;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string;
  ipAddress?: string;
  details?: Record<string, any>;
}

/**
 * Audit logging service for tracking sensitive operations
 * Useful for security audits, compliance, and debugging
 */
export class AuditLogService {
  /**
   * Create an audit log entry
   */
  static async log(input: AuditLogInput): Promise<void> {
    try {
      const { userId, actionType, entityType, entityId, ipAddress, details } = input;

      // Log to database
      await prisma.activityLog.create({
        data: {
          userId: userId || null,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId || null,
          ip_address: ipAddress || null,
        },
      });

      // Also log important actions to logger
      if (
        [
          AuditActionType.DELETE,
          AuditActionType.PAYMENT,
          AuditActionType.PASSWORD_CHANGE,
          AuditActionType.LOGIN,
        ].includes(actionType)
      ) {
        logger.warn({
          message: `Audit: ${actionType} on ${entityType}`,
          userId,
          actionType,
          entityType,
          entityId,
          ipAddress,
          details,
        });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to create audit log',
        error,
        input,
      });
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Get audit logs for a user
   */
  static async getLogsForUser(userId: string, limit: number = 100) {
    try {
      return await prisma.activityLog.findMany({
        where: { userId },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch audit logs for user',
        error,
        userId,
      });
      return [];
    }
  }

  /**
   * Get audit logs by entity (file, folder, etc.)
   */
  static async getLogsForEntity(entityType: AuditEntityType, entityId: string, limit: number = 50) {
    try {
      return await prisma.activityLog.findMany({
        where: {
          entity_type: entityType,
          entity_id: entityId,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch entity audit logs',
        error,
        entityType,
        entityId,
      });
      return [];
    }
  }

  /**
   * Get audit logs by action type
   */
  static async getLogsByAction(actionType: AuditActionType, limit: number = 100) {
    try {
      return await prisma.activityLog.findMany({
        where: { action_type: actionType },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch action audit logs',
        error,
        actionType,
      });
      return [];
    }
  }

  /**
   * Clean up old audit logs (older than specified days)
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.activityLog.deleteMany({
        where: {
          created_at: {
            lt: cutoffDate,
          },
        },
      });

      logger.info({
        message: `Cleaned up ${result.count} old audit logs`,
        daysToKeep,
      });

      return result.count;
    } catch (error) {
      logger.error({
        message: 'Failed to cleanup old audit logs',
        error,
        daysToKeep,
      });
      return 0;
    }
  }
}

export default AuditLogService;
