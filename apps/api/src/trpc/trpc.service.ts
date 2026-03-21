import { Injectable } from '@nestjs/common'
import { router, publicProcedure, protectedProcedure } from './middleware'

@Injectable()
export class TrpcService {
  router = router
  publicProcedure = publicProcedure
  protectedProcedure = protectedProcedure
}
