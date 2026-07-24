export class AppError extends Error {
  constructor(message, statusCode) {
    if (typeof message === 'object' && message !== null) {
      super(message.en || 'Error');
      this.translations = message;
    } else {
      super(message);
    }
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
