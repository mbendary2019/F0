// src/lib/agents/errors.ts
// Phase 79: Error Recovery & Self-Correction System - Centralized Error Types

/**
 * Agent error types for different failure scenarios
 */
export enum AgentErrorType {
  PARSE_ERROR = 'PARSE_ERROR',
  PATCH_CONFLICT = 'PATCH_CONFLICT',
  INVALID_FILE = 'INVALID_FILE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  RATE_LIMIT = 'RATE_LIMIT',
  TOKEN_EXCEEDED = 'TOKEN_EXCEEDED',
  ROUTING_ERROR = 'ROUTING_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class for agent-specific errors
 */
export class AgentError extends Error {
  type: AgentErrorType;
  details?: any;
  recoverable: boolean;
  retryable: boolean;

  constructor(
    type: AgentErrorType,
    message: string,
    options?: {
      details?: any;
      recoverable?: boolean;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'AgentError';
    this.type = type;
    this.details = options?.details;
    this.recoverable = options?.recoverable ?? this.isRecoverableByDefault(type);
    this.retryable = options?.retryable ?? this.isRetryableByDefault(type);

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }

  /**
   * Determine if error type is recoverable by default
   */
  private isRecoverableByDefault(type: AgentErrorType): boolean {
    switch (type) {
      case AgentErrorType.PATCH_CONFLICT:
      case AgentErrorType.INVALID_FORMAT:
      case AgentErrorType.PARSE_ERROR:
      case AgentErrorType.EMPTY_RESPONSE:
        return true;

      case AgentErrorType.INVALID_FILE:
      case AgentErrorType.RATE_LIMIT:
      case AgentErrorType.TOKEN_EXCEEDED:
      case AgentErrorType.ROUTING_ERROR:
      case AgentErrorType.UNKNOWN:
      default:
        return false;
    }
  }

  /**
   * Determine if error type is retryable by default
   */
  private isRetryableByDefault(type: AgentErrorType): boolean {
    switch (type) {
      case AgentErrorType.PATCH_CONFLICT:
      case AgentErrorType.INVALID_FORMAT:
      case AgentErrorType.PARSE_ERROR:
      case AgentErrorType.EMPTY_RESPONSE:
      case AgentErrorType.RATE_LIMIT:
        return true;

      case AgentErrorType.INVALID_FILE:
      case AgentErrorType.TOKEN_EXCEEDED:
      case AgentErrorType.ROUTING_ERROR:
      case AgentErrorType.UNKNOWN:
      default:
        return false;
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(locale: 'ar' | 'en' = 'en'): string {
    if (locale === 'ar') {
      switch (this.type) {
        case AgentErrorType.PARSE_ERROR:
          return 'فشل تحليل الاستجابة من الذكاء الاصطناعي';
        case AgentErrorType.PATCH_CONFLICT:
          return 'تعارض في تطبيق التعديلات على الملف';
        case AgentErrorType.INVALID_FILE:
          return 'الملف المطلوب غير موجود أو غير صالح';
        case AgentErrorType.INVALID_FORMAT:
          return 'تنسيق الاستجابة غير صحيح';
        case AgentErrorType.EMPTY_RESPONSE:
          return 'استجابة فارغة من الذكاء الاصطناعي';
        case AgentErrorType.RATE_LIMIT:
          return 'تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقاً';
        case AgentErrorType.TOKEN_EXCEEDED:
          return 'تم تجاوز حد الرموز المسموح به';
        case AgentErrorType.ROUTING_ERROR:
          return 'خطأ في توجيه الطلب';
        case AgentErrorType.UNKNOWN:
        default:
          return 'حدث خطأ غير متوقع';
      }
    } else {
      switch (this.type) {
        case AgentErrorType.PARSE_ERROR:
          return 'Failed to parse AI response';
        case AgentErrorType.PATCH_CONFLICT:
          return 'Conflict applying patch to file';
        case AgentErrorType.INVALID_FILE:
          return 'Requested file does not exist or is invalid';
        case AgentErrorType.INVALID_FORMAT:
          return 'Invalid response format';
        case AgentErrorType.EMPTY_RESPONSE:
          return 'Empty response from AI';
        case AgentErrorType.RATE_LIMIT:
          return 'Rate limit exceeded, please try again later';
        case AgentErrorType.TOKEN_EXCEEDED:
          return 'Token limit exceeded';
        case AgentErrorType.ROUTING_ERROR:
          return 'Request routing error';
        case AgentErrorType.UNKNOWN:
        default:
          return 'An unexpected error occurred';
      }
    }
  }

  /**
   * Get suggested recovery action
   */
  getRecoveryAction(locale: 'ar' | 'en' = 'en'): string | null {
    if (!this.recoverable) return null;

    if (locale === 'ar') {
      switch (this.type) {
        case AgentErrorType.PATCH_CONFLICT:
          return 'سيتم إعادة المحاولة بتعديل أصغر وأكثر دقة';
        case AgentErrorType.INVALID_FORMAT:
        case AgentErrorType.PARSE_ERROR:
          return 'سيتم إعادة المحاولة مع توضيح أفضل للتنسيق المطلوب';
        case AgentErrorType.EMPTY_RESPONSE:
          return 'سيتم إعادة المحاولة مع نموذج بديل';
        default:
          return 'سيتم إعادة المحاولة تلقائياً';
      }
    } else {
      switch (this.type) {
        case AgentErrorType.PATCH_CONFLICT:
          return 'Will retry with smaller, more precise changes';
        case AgentErrorType.INVALID_FORMAT:
        case AgentErrorType.PARSE_ERROR:
          return 'Will retry with clearer format instructions';
        case AgentErrorType.EMPTY_RESPONSE:
          return 'Will retry with fallback model';
        default:
          return 'Will retry automatically';
      }
    }
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      retryable: this.retryable,
    };
  }
}

/**
 * Detect error type from patch application result
 */
export function detectErrorType(error: any): AgentErrorType {
  if (!error) return AgentErrorType.UNKNOWN;

  const errorMessage = error.message || error.error || String(error);
  const errorLower = errorMessage.toLowerCase();

  // File errors
  if (errorLower.includes('file does not exist') || errorLower.includes('enoent')) {
    return AgentErrorType.INVALID_FILE;
  }

  // Patch conflicts
  if (
    errorLower.includes('conflict') ||
    errorLower.includes('mismatch') ||
    errorLower.includes('context') ||
    errorLower.includes('hunk failed')
  ) {
    return AgentErrorType.PATCH_CONFLICT;
  }

  // Empty response
  if (errorLower.includes('empty') || errorLower.includes('no content')) {
    return AgentErrorType.EMPTY_RESPONSE;
  }

  // Format errors
  if (
    errorLower.includes('invalid format') ||
    errorLower.includes('parse') ||
    errorLower.includes('invalid diff') ||
    errorLower.includes('malformed')
  ) {
    return AgentErrorType.INVALID_FORMAT;
  }

  // Rate limits
  if (errorLower.includes('rate limit') || errorLower.includes('429')) {
    return AgentErrorType.RATE_LIMIT;
  }

  // Token limits
  if (
    errorLower.includes('token') ||
    errorLower.includes('context length') ||
    errorLower.includes('maximum')
  ) {
    return AgentErrorType.TOKEN_EXCEEDED;
  }

  return AgentErrorType.UNKNOWN;
}

/**
 * Create AgentError from unknown error
 */
export function toAgentError(error: any): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  const type = detectErrorType(error);
  const message = error.message || error.error || String(error);

  return new AgentError(type, message, {
    details: {
      originalError: error,
      stack: error.stack,
    },
  });
}
