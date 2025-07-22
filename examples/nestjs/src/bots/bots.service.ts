import { Injectable } from '@nestjs/common';

@Injectable()
export class BotsService {
  message(): { message: string } {
    return {
      message: 'Hello world',
    };
  }
}
