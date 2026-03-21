import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }))

  // CORS
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ]
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://127.0.0.1:3000', 'http://localhost:3000')
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })

  app.setGlobalPrefix('api', {
    exclude: ['health', 'trpc', 'trpc/(.*)'],
  })

  const port = process.env.API_PORT || 3001
  await app.listen(port)
  console.log(`🚀 OptimizerV6 API running on http://localhost:${port}`)
  console.log(`   Health: http://localhost:${port}/health`)
  console.log(`   tRPC:   http://localhost:${port}/trpc`)
}

bootstrap()
