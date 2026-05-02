import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SurveyCrudService } from './survey-crud.service'
import { SurveyEngineService } from './survey-engine.service'
import { AdaptiveEngineService } from './adaptive-engine.service'

/**
 * Phase 3 Stage D — Surveys module.
 *
 * Three services:
 *   - SurveyCrudService     → workspace-scoped CRUD
 *   - SurveyEngineService   → public engine for quick/deep/custom
 *                             (walks the step graph)
 *   - AdaptiveEngineService → public engine for adaptive surveys
 *                             (Hotfix §2 — runs the locked v2 flow
 *                             directly from settings, ignores steps)
 *
 * SurveyEngineService delegates to AdaptiveEngineService when a survey
 * has template='adaptive'.
 */
@Module({
  imports: [DatabaseModule],
  providers: [SurveyCrudService, SurveyEngineService, AdaptiveEngineService],
  exports: [SurveyCrudService, SurveyEngineService, AdaptiveEngineService],
})
export class SurveysModule {}
