import { pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['owner', 'manager', 'staff', 'viewer'])

export const connectorStatusEnum = pgEnum('connector_status', [
  'connected',
  'disconnected',
  'error',
  'pending',
])

export const bindingLevelEnum = pgEnum('binding_level', ['workspace', 'location'])

export const tonePresetEnum = pgEnum('tone_preset', [
  'professional',
  'friendly',
  'empathetic',
  'witty',
])

export const screenTypeEnum = pgEnum('screen_type', [
  'rating',
  'aspects',
  'review_redirect',
  'feedback',
  'contact_collection',
  'thank_you',
  'nps',
  'csat',
  'ces',
  'metric_question',
])

export const truformTypeEnum = pgEnum('truform_type', ['nps', 'csat', 'ces', 'custom'])
export const truformStatusEnum = pgEnum('truform_status', ['draft', 'active', 'archived'])

// NEV (Net Emotional Value) enums
export const emotionClusterEnum = pgEnum('emotion_cluster', [
  'joy',
  'comfort',
  'frustration',
  'anxiety',
])
export const emotionPolarityEnum = pgEnum('emotion_polarity', [
  'positive',
  'negative',
])
export const nevSourceEnum = pgEnum('nev_source', [
  'active_survey',
  'passive_nlp',
  'journey',
])

// Automation enums
export const automationTriggerEnum = pgEnum('automation_trigger', [
  'journey_completed_positive',
  'journey_completed_negative',
  'journey_abandoned',
  'review_posted',
  'review_posted_google',
  'customer_dormant',
  'custom',
])

export const automationActionEnum = pgEnum('automation_action', [
  'send_coupon',
  'send_message',
  'create_escalation',
  'tag_customer',
  'trigger_journey',
  'ai_reply_review',
])

export const automationQueueStatusEnum = pgEnum('automation_queue_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'flat', 'freebie'])
export const couponStatusEnum = pgEnum('coupon_status', ['issued', 'redeemed', 'expired', 'cancelled'])
export const deliveryMethodEnum = pgEnum('delivery_method', ['whatsapp', 'email', 'sms', 'in_app', 'manual'])
export const deliveryStatusEnum = pgEnum('delivery_status', ['pending', 'sent', 'delivered', 'failed'])

// CX Routing enums
export const triggerTypeEnum = pgEnum('trigger_type', [
  'rating_threshold',
  'aspect_match',
  'keyword_match',
  'sentiment',
  'manual',
])
export const escalationPriorityEnum = pgEnum('escalation_priority', ['low', 'medium', 'high', 'critical'])
export const escalationStatusEnum = pgEnum('escalation_status', ['open', 'in_progress', 'resolved', 'expired', 'closed'])

// Appointment enums
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'completed', 'cancelled', 'no_show'])

// Notification enums
export const notificationTypeEnum = pgEnum('notification_type', [
  'review_received',
  'escalation_created',
  'escalation_assigned',
  'sla_breach',
  'coupon_redeemed',
  'sync_complete',
  'sync_failed',
  'team_invite',
  'journey_response',
  'system',
])

// Report enums
export const reportTypeEnum = pgEnum('report_type', [
  'orm_overview',
  'aspect_analysis',
  'truforms_feedback',
  'journey_analytics',
  'nev_report',
  'cli_report',
])

// WapiSnap enums
export const wapisnapNumberStatusEnum = pgEnum('wapisnap_number_status', [
  'pending',
  'ready',
  'error',
])

export const wapisnapTemplateCategoryEnum = pgEnum('wapisnap_template_category', [
  'MARKETING',
  'UTILITY',
  'AUTHENTICATION',
])

export const wapisnapTemplateStatusEnum = pgEnum('wapisnap_template_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
])

export const wapisnapMessageDirectionEnum = pgEnum('wapisnap_message_direction', [
  'outbound',
  'inbound',
])

export const wapisnapMessageTypeEnum = pgEnum('wapisnap_message_type', [
  'template',
  'text',
  'interactive',
])

export const wapisnapMessageStatusEnum = pgEnum('wapisnap_message_status', [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
])

export const wapisnapSequenceStatusEnum = pgEnum('wapisnap_sequence_status', [
  'active',
  'paused',
  'completed',
  'cancelled',
])

// rAIS (AI Studio) enums
export const socialPlatformEnum = pgEnum('social_platform', [
  'instagram',
  'facebook',
  'google',
  'twitter',
  'linkedin',
])

export const contentTypeEnum = pgEnum('content_type', [
  'post',
  'story',
  'reel_caption',
  'event',
  'offer',
])

export const socialPostStatusEnum = pgEnum('social_post_status', [
  'draft',
  'scheduled',
  'published',
  'failed',
])
