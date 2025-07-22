import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitingAdvancedService {
  message(): { message: string } {
    return {
      message: 'Hello world',
    };
  }

  messageJP(): { message: string } {
    return {
      message: 'Konnichiwa!',
    };
  }
}
