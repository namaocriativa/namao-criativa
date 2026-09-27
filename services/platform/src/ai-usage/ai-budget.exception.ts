import { HttpException, HttpStatus } from '@nestjs/common';

export class AiBudgetExceededException extends HttpException {
  constructor(scope: 'tenant' | 'user' | 'lead', remainingUsd: number) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'AI_BUDGET_EXCEEDED',
        message: 'Limite mensal de IA atingido',
        scope,
        remainingUsd,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
