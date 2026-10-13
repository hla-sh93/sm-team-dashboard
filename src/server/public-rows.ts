/**
 * صفوف «منطقة الموظفين» — شو مسموح يوصل لمتصفّح بلا دخول.
 *
 * صفحات الموظفين (`/` · `/tasks` · `/today` · `/publishing`) مفتوحة بلا دخول بقرار
 * القائدة، وكل prop بينعطى لمكوّن `"use client"` بيتسلسل كلّه بمصدر الصفحة — حتى لو
 * الشاشة ما بتعرضه. كانت المحمّلات تجيب صفوف `Employee` و`Company` كاملة، فرواتب
 * الفريق وقيم عقود الزبائن كانت بمصدر الصفحة لأي زائر (فحص ١٢/١٠، SA-01).
 *
 * لهيك **قائمة مسموحات** لا قائمة ممنوعات: أي حقل بينضاف للـschema بكرا ما بيوصل
 * للمتصفّح إلا إذا انضاف هون صراحةً. المالية (`salary` · `costPerReel` ·
 * `contractValue`) وهوية تلغرام الرقمية (`telegramUserId` · `telegramAliases`)
 * بتضل بالأدمن.
 */
import type { Prisma } from "@prisma/client";

export const publicEmployeeSelect = {
  id: true,
  name: true,
  role: true,
  hoursPerDay: true,
  workDays: true,
  isScheduled: true,
  isPhotographer: true,
  telegramUsername: true,
  color: true,
  rates: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmployeeSelect;

export const publicCompanySelect = {
  id: true,
  name: true,
  managed: true,
  posts: true,
  reels: true,
  stories: true,
  aiReels: true,
  contractStartDate: true,
  publishStartDate: true,
  instagramHandle: true,
  renewals: true,
  contractEndedAt: true,
  preferredShootDay: true,
  contentSupplied: true,
  lateExemptReason: true,
  slug: true,
  telegramChatId: true,
  offPlanKeywords: true,
  color: true,
  priority: true,
  status: true,
  postOwnerId: true,
  storyOwnerId: true,
  aiReelOwnerId: true,
  defaultOwnerId: true,
  photographerId: true,
  accountOwnerId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

/** رسائل تلغرام بـ«متابعة اليوم»: بلا `senderId` (هوية تلغرام الرقمية) ولا `fileId`. */
export const publicDeliverySelect = {
  id: true,
  chatId: true,
  threadId: true,
  messageId: true,
  sentAt: true,
  senderName: true,
  kind: true,
  fileName: true,
  caption: true,
  companyId: true,
  taskId: true,
  matchedBy: true,
  confirmed: true,
} satisfies Prisma.TelegramMessageSelect;
