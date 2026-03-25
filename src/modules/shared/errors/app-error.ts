export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
