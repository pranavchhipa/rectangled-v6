import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'

export interface ZomatoReview {
  reviewId: string
  reviewerName: string
  rating: number
  text: string
  reviewedAt: Date
  likes: number
}

@Injectable()
export class ZomatoAdapter {
  /**
   * Fetch reviews from a Zomato restaurant profile.
   * Currently a stub — will be implemented with cheerio/puppeteer scraping.
   */
  async fetchReviews(profileUrl: string): Promise<ZomatoReview[]> {
    if (!profileUrl || !profileUrl.includes('zomato.com')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid Zomato profile URL',
      })
    }

    // TODO: Implement actual Zomato scraping
    // For now, return empty array — reviews will be populated once scraping is built
    console.log(`[ZomatoAdapter] Fetching reviews from: ${profileUrl}`)
    return []
  }

  /**
   * Extract the restaurant ID from a Zomato URL
   */
  extractRestaurantId(profileUrl: string): string | null {
    // Zomato URLs: https://www.zomato.com/city/restaurant-name/reviews
    const match = profileUrl.match(/zomato\.com\/[^/]+\/([^/?]+)/)
    return match ? match[1] : null
  }
}
