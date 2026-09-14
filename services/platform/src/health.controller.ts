import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Public()
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' as const };
  }
}
