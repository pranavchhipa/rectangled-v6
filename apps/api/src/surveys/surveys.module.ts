import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SurveyCrudService } from './survey-crud.service'
import { SurveyEngineService } from './survey-engine.service'

/**
 * Phase 3 Stage D — Surveys module.
 *
 * Two services:
 *   - SurveyCrudService    → workspace-scoped CRUD
 *   - SurveyEngineService  → public engine (slug → step graph walk)
 *
 * Both share the DATABASE provider from DatabaseModule.
 */
@Module({
  imports: [DatabaseModule],
  providers: [SurveyCrudService, SurveyEngineService],
  exports: [SurveyCrudService, SurveyEngineService],
})
export class SurveysModule {}
