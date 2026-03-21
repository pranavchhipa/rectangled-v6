/**
 * OptimizerV6 — Comprehensive Demo Data Seed Script
 * Populates the entire ecosystem for the test@example.com account
 * with 100+ customers, reviews, coupons, forms, escalations, team members, billing, etc.
 */
import postgres from 'postgres'
import { randomUUID, createHash } from 'crypto'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://rectangled:rectangled_dev@localhost:5432/rectangled_v6'
const sql = postgres(DATABASE_URL)

// ─── Helpers ───────────────────────────────────────────────────────────────────
const uuid = () => randomUUID()
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const pickN = (arr, n) => arr.sort(() => 0.5 - Math.random()).slice(0, n)
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(2)
const days = d => new Date(Date.now() - d * 86400000)
const daysAgo = d => days(d).toISOString()
const hashPw = pw => createHash('sha256').update(pw).digest('hex')

// Known IDs
const TEST_USER_ID = '42230f03-d902-4e25-a8c7-6bd7d67b2110'
const WORKSPACE_ID = '152907b7-db92-423b-a74d-cd303bb17b25'

// ─── Indian Business Data ──────────────────────────────────────────────────────
const INDIAN_FIRST_NAMES = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan','Ananya','Diya','Myra','Sara','Aanya','Aadhya','Isha','Kavya','Riya','Priya','Rahul','Amit','Suresh','Pooja','Neha','Raj','Vikram','Deepika','Anjali','Rohit','Manish','Sneha','Kiran','Nisha','Meera','Rohan','Akash','Swati','Divya','Gaurav','Pankaj','Shweta','Varun','Jyoti','Harish','Ritika','Sanjay','Preeti','Nitin','Pallavi']
const INDIAN_LAST_NAMES = ['Sharma','Patel','Singh','Kumar','Gupta','Reddy','Nair','Joshi','Mehta','Shah','Verma','Rao','Pillai','Das','Chopra','Malhotra','Iyer','Kapoor','Banerjee','Mishra','Chauhan','Thakur','Desai','Bhatt','Srivastava','Pandey','Saxena','Agarwal','Kulkarni','Deshpande']
const INDIAN_CITIES = ['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Jaipur','Lucknow','Chandigarh','Indore','Nagpur','Bhopal','Kochi','Surat','Vadodara','Coimbatore','Thiruvananthapuram','Gurgaon']

const RESTAURANT_NAMES = ['Spice Garden','The Curry House','Tandoori Nights','Biryani Palace','Masala Junction','Chai & Chaat','Mumbai Tiffins','Delhi Darbar','South Indian Kitchen','Dhaba Express']
const ASPECTS = ['Food Quality','Service','Ambiance','Hygiene','Value for Money','Delivery Speed','Staff Behavior','Parking','Waiting Time','Menu Variety']
const ASPECT_CATEGORIES = ['product','service','environment','value','logistics']

// Google & Zomato review templates
const POSITIVE_REVIEWS = [
  'Amazing food! The biryani was absolutely delicious. Will definitely come back.',
  'Best dining experience in the city. The staff was incredibly helpful and courteous.',
  'Loved the ambiance and the food quality. The paneer tikka was out of this world!',
  'Great value for money. We ordered multiple dishes and everything was fresh and tasty.',
  'The hygiene standards here are top-notch. You can see the open kitchen which is a big plus.',
  'Perfect place for family dining. Kids loved the menu variety and the desserts were amazing.',
  'Service was prompt and the food came hot. The butter chicken is a must-try!',
  'One of the best restaurants in town. The thali is a complete meal with generous portions.',
  'Excellent South Indian food. The dosa was crispy and the sambar was authentic.',
  'The delivery was super fast and food was still hot. Packaging was also very good.',
  'Wonderful experience! The live music on weekends makes it even more special.',
  'Finally found a place with authentic Hyderabadi biryani. The raita was perfect too.',
  'Clean, well-maintained, and delicious food. What more can you ask for?',
  'The weekend brunch buffet is amazing. So many options and everything was fresh.',
  'Staff remembered our preferences from last visit. Such personalized service!',
  'The rooftop seating is beautiful. Perfect for a date night.',
  'Tried the new menu items - the fusion dishes are creative and delicious.',
  'Parking was easy, restaurant was not too crowded. Smooth dining experience.',
  'The chef came to our table to take feedback. Shows how much they care about quality.',
  'Best chai I have had outside of home. The snacks menu is also very good.',
]
const NEGATIVE_REVIEWS = [
  'Very disappointing. Waited 45 minutes for our food and it was cold when it arrived.',
  'The hygiene was terrible. Found a hair in my food. Will not come back.',
  'Overpriced for the quality. The portions were too small and food was mediocre.',
  'Rude staff. They seemed annoyed when we asked for extra napkins.',
  'Food was too oily and spicy. Not what I expected from the menu description.',
  'The AC was not working and it was extremely hot inside. Very uncomfortable.',
  'Delivery was 1 hour late and half the order was missing. No response from customer care.',
  'The restaurant was dirty. Tables were not cleaned properly and floor was sticky.',
  'Extremely noisy. Could not have a conversation at our table.',
  'The food gave me an upset stomach. Definitely not going back.',
  'Waited 20 minutes just to get the menu. Service is unacceptably slow.',
  'Found an insect in the dal. Absolutely disgusting and unhygienic.',
  'The bill had wrong charges. Had to argue to get it corrected.',
  'Parking is a nightmare. No valet service despite being a premium restaurant.',
  'The food quality has gone down drastically compared to last year.',
]
const MIXED_REVIEWS = [
  'Food was good but the service could be better. Had to wait too long for the bill.',
  'Nice ambiance but food was just average. The desserts saved the meal.',
  'Good variety on the menu but some dishes were too salty. The dal makhani was excellent though.',
  'Staff was friendly but the food took too long. The taste was decent when it finally arrived.',
  'The restaurant looks great from outside but inside it could use better maintenance.',
  'Delivery was on time but the packaging was poor. Food was lukewarm.',
  'Great location and parking but the menu prices are on the higher side for what you get.',
  'The starters were amazing but the main course was disappointing.',
  'Nice place for a quick meal. Dont expect fine dining quality but its value for money.',
  'The biryani was good but the naan was stale. Inconsistent quality across dishes.',
]

const REVIEW_RESPONSE_TEMPLATES = [
  'Thank you so much for your wonderful review, {name}! We are thrilled that you enjoyed your experience with us.',
  'Hi {name}, we appreciate your honest feedback. We will work on improving the areas you mentioned.',
  'Dear {name}, thank you for dining with us! We are glad you loved our {dish}.',
  'Hi {name}, we sincerely apologize for the inconvenience. We have taken immediate action to address your concerns.',
  '{name}, your feedback means the world to us! We look forward to serving you again soon.',
  'Thank you for your visit, {name}. We value your feedback and are constantly working to enhance our service.',
  'We are sorry to hear about your experience, {name}. Our manager will reach out to you personally.',
  'Hi {name}, we are glad you enjoyed the food! Do try our weekend special next time.',
]

const COUPON_NAMES = ['Welcome10','Loyalty20','FeedbackThank','Birthday15','FirstOrder','HappyHour','Weekend25','ReferFriend','Festive30','Comeback10']

async function seed() {
  console.log('🌱 Starting comprehensive demo seed...')
  console.log('   Workspace:', WORKSPACE_ID)
  console.log('   Test user:', TEST_USER_ID)

  // ─── 1. Clean existing data for this workspace ─────────────────────────────
  console.log('\n🧹 Cleaning existing data...')
  // Delete in reverse dependency order
  await sql`DELETE FROM automation_queue WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM automation_rules WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM nev_responses WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM cli_responses WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM notifications WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM escalations WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM escalation_rules WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM coupon_instances WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM coupon_templates WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM report_snapshots WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM social_posts WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM content_calendar WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM brand_voice WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM wapisnap_sequences WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM listing_posts WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM listing_change_log WHERE listing_id IN (SELECT id FROM business_listings WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM business_listings WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM ai_response_schedules WHERE review_id IN (SELECT id FROM reviews WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM review_responses WHERE review_id IN (SELECT id FROM reviews WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM reviews WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM truform_responses WHERE truform_id IN (SELECT id FROM truforms WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM truforms WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM journey_responses WHERE journey_id IN (SELECT id FROM journeys WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM journey_screens WHERE journey_id IN (SELECT id FROM journeys WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM journeys WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM ai_response_daily_counts WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM business_aspects WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM connector_instances WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM customers WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM invoices WHERE subscription_id IN (SELECT id FROM subscriptions WHERE workspace_id = ${WORKSPACE_ID})`
  await sql`DELETE FROM subscriptions WHERE workspace_id = ${WORKSPACE_ID}`
  await sql`DELETE FROM onboarding_state WHERE workspace_id = ${WORKSPACE_ID}`
  // Delete orphaned locations from other workspaces too
  await sql`DELETE FROM locations WHERE workspace_id = ${WORKSPACE_ID}`
  // Delete extra members but keep the owner
  await sql`DELETE FROM members WHERE workspace_id = ${WORKSPACE_ID} AND user_id != ${TEST_USER_ID}`
  // Delete extra users that we'll recreate (team members)
  await sql`DELETE FROM users WHERE id != ${TEST_USER_ID} AND email LIKE '%@rectangled-demo.com'`

  console.log('   ✓ Cleaned')

  // ─── 2. Update workspace to look like a real business ──────────────────────
  console.log('\n🏢 Setting up workspace...')
  await sql`UPDATE workspaces SET
    name = 'Spice Garden Restaurant',
    slug = 'spice-garden',
    industry = 'Restaurant & Cafe',
    tone_preset = 'friendly',
    onboarding_complete = true,
    settings = ${sql.json({
      defaultTimezone: 'Asia/Kolkata',
      aiAutoRespond: true,
      reviewResponseDelay: { min: 1, max: 3 },
      frequencyCap: { maxSurveys: 2, windowDays: 60 }
    })}
    WHERE id = ${WORKSPACE_ID}`

  // Update test user name
  await sql`UPDATE users SET name = 'Pranav Sharma', email_verified = true WHERE id = ${TEST_USER_ID}`
  // Update member role to owner
  await sql`UPDATE members SET role = 'owner' WHERE user_id = ${TEST_USER_ID} AND workspace_id = ${WORKSPACE_ID}`

  console.log('   ✓ Workspace: Spice Garden Restaurant')

  // ─── 3. Create Team Members (5 more users) ────────────────────────────────
  console.log('\n👥 Creating team members...')
  const teamMembers = [
    { name: 'Ananya Desai', email: 'ananya@rectangled-demo.com', role: 'manager' },
    { name: 'Rohan Mehta', email: 'rohan@rectangled-demo.com', role: 'manager' },
    { name: 'Priya Nair', email: 'priya@rectangled-demo.com', role: 'staff' },
    { name: 'Vikram Chauhan', email: 'vikram@rectangled-demo.com', role: 'staff' },
    { name: 'Sneha Kapoor', email: 'sneha@rectangled-demo.com', role: 'viewer' },
  ]
  const teamUserIds = []
  for (const tm of teamMembers) {
    const userId = uuid()
    teamUserIds.push(userId)
    await sql`INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
      VALUES (${userId}, ${tm.email}, ${hashPw('password123')}, ${tm.name}, true, ${daysAgo(rand(30,90))}, NOW())`
    await sql`INSERT INTO members (id, user_id, workspace_id, role, location_ids, invited_by, accepted_at, created_at)
      VALUES (${uuid()}, ${userId}, ${WORKSPACE_ID}, ${tm.role}, ${sql.array([])}, ${TEST_USER_ID}, ${daysAgo(rand(1,29))}, ${daysAgo(rand(30,60))})`
    console.log(`   ✓ ${tm.name} (${tm.role})`)
  }
  const allUserIds = [TEST_USER_ID, ...teamUserIds]

  // ─── 4. Create Locations (3 branches) ──────────────────────────────────────
  console.log('\n📍 Creating locations...')
  const locationData = [
    { name: 'Spice Garden - Koramangala', city: 'Bangalore', address: '4th Block, 80 Feet Road, Koramangala, Bangalore 560034', phone: '+919876543210', email: 'koramangala@spicegarden.in' },
    { name: 'Spice Garden - Indiranagar', city: 'Bangalore', address: '100 Feet Road, Indiranagar, Bangalore 560038', phone: '+919876543211', email: 'indiranagar@spicegarden.in' },
    { name: 'Spice Garden - HSR Layout', city: 'Bangalore', address: '27th Main Road, HSR Layout, Bangalore 560102', phone: '+919876543212', email: 'hsr@spicegarden.in' },
  ]
  const locationIds = []
  for (const loc of locationData) {
    const locId = uuid()
    locationIds.push(locId)
    await sql`INSERT INTO locations (id, workspace_id, name, address, city, state, country, phone, email, timezone, is_active, settings, created_at, updated_at)
      VALUES (${locId}, ${WORKSPACE_ID}, ${loc.name}, ${loc.address}, ${loc.city}, 'Karnataka', 'India', ${loc.phone}, ${loc.email}, 'Asia/Kolkata', true, ${sql.json({})}, ${daysAgo(180)}, NOW())`
    console.log(`   ✓ ${loc.name}`)
  }

  // ─── 5. Create Connector Instances (Google + Zomato per location) ──────────
  console.log('\n🔌 Creating connectors...')
  const connectorIds = { google: [], zomato: [] }
  for (let i = 0; i < locationIds.length; i++) {
    const gId = uuid()
    const zId = uuid()
    connectorIds.google.push(gId)
    connectorIds.zomato.push(zId)
    await sql`INSERT INTO connector_instances (id, connector_type_id, workspace_id, location_id, credentials, config, status, last_sync_at, created_at, updated_at)
      VALUES (${gId}, 'gbp', ${WORKSPACE_ID}, ${locationIds[i]}, ${sql.json({accessToken:'demo',refreshToken:'demo'})}, ${sql.json({placeId:'ChIJ'+rand(100000,999999)})}, 'connected', ${daysAgo(0)}, ${daysAgo(90)}, NOW())`
    await sql`INSERT INTO connector_instances (id, connector_type_id, workspace_id, location_id, credentials, config, status, last_sync_at, created_at, updated_at)
      VALUES (${zId}, 'zomato', ${WORKSPACE_ID}, ${locationIds[i]}, ${sql.json({apiKey:'demo_zomato_key'})}, ${sql.json({restaurantId:rand(10000,99999).toString()})}, 'connected', ${daysAgo(0)}, ${daysAgo(60)}, NOW())`
    console.log(`   ✓ Google + Zomato for ${locationData[i].name}`)
  }

  // ─── 6. Create Business Aspects ────────────────────────────────────────────
  console.log('\n📊 Creating business aspects...')
  const aspectIds = []
  for (let i = 0; i < ASPECTS.length; i++) {
    const aId = uuid()
    aspectIds.push(aId)
    await sql`INSERT INTO business_aspects (id, workspace_id, name, category, is_default, is_active, sort_order, created_at, updated_at)
      VALUES (${aId}, ${WORKSPACE_ID}, ${ASPECTS[i]}, ${ASPECT_CATEGORIES[i % ASPECT_CATEGORIES.length]}, true, true, ${i}, ${daysAgo(90)}, NOW())`
  }
  console.log(`   ✓ ${ASPECTS.length} aspects created`)

  // ─── 7. Create 120 Customers ───────────────────────────────────────────────
  console.log('\n👤 Creating 120 customers...')
  const customerIds = []
  const customerNames = []
  const customerPhones = []
  for (let i = 0; i < 120; i++) {
    const cId = uuid()
    customerIds.push(cId)
    const firstName = pick(INDIAN_FIRST_NAMES)
    const lastName = pick(INDIAN_LAST_NAMES)
    const name = `${firstName} ${lastName}`
    customerNames.push(name)
    const phone = `+9198${rand(10000000, 99999999)}`
    customerPhones.push(phone)
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(1,99)}@gmail.com`
    const totalReviews = rand(1, 5)
    const avgRating = randFloat(1, 5)
    const tags = pickN(['vip', 'repeat', 'new', 'complainant', 'promoter', 'at-risk', 'loyal', 'high-spender'], rand(1, 3))
    const statuses = ['active', 'active', 'active', 'dormant', 'new']

    await sql`INSERT INTO customers (id, workspace_id, name, email, phone, tags, metadata, total_reviews, average_rating, status, first_seen_at, last_seen_at, created_at)
      VALUES (${cId}, ${WORKSPACE_ID}, ${name}, ${email}, ${phone}, ${sql.array(tags)}, ${sql.json({source: pick(['google','zomato','journey','walk-in']), visits: rand(1,30)})}, ${totalReviews}, ${avgRating}, ${pick(statuses)}, ${daysAgo(rand(30, 365))}, ${daysAgo(rand(0, 30))}, ${daysAgo(rand(30, 365))})`
  }
  console.log(`   ✓ 120 customers created`)

  // ─── 8. Create Reviews (500+ across Google & Zomato) ───────────────────────
  console.log('\n⭐ Creating 500 reviews...')
  const reviewIds = []
  const reviewData = []
  for (let i = 0; i < 500; i++) {
    const rId = uuid()
    reviewIds.push(rId)
    const locIdx = i % locationIds.length
    const platform = i % 3 === 0 ? 'zomato' : 'google'
    const connId = platform === 'google' ? connectorIds.google[locIdx] : connectorIds.zomato[locIdx]
    const custIdx = i % customerIds.length
    const dAgo = rand(0, 180)

    // Rating distribution: 40% 5-star, 20% 4-star, 15% 3-star, 15% 2-star, 10% 1-star
    const ratingRoll = Math.random()
    let rating
    if (ratingRoll < 0.40) rating = 5
    else if (ratingRoll < 0.60) rating = 4
    else if (ratingRoll < 0.75) rating = 3
    else if (ratingRoll < 0.90) rating = 2
    else rating = 1

    let text
    if (rating >= 4) text = pick(POSITIVE_REVIEWS)
    else if (rating <= 2) text = pick(NEGATIVE_REVIEWS)
    else text = pick(MIXED_REVIEWS)

    const sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral'
    const sentimentScore = rating >= 4 ? randFloat(0.6, 1.0) : rating <= 2 ? randFloat(-1.0, -0.3) : randFloat(-0.2, 0.3)
    const aspectTags = pickN(ASPECTS, rand(1, 4))
    const themes = pickN(['food', 'service', 'ambiance', 'price', 'hygiene', 'delivery', 'staff', 'wait-time'], rand(1, 3))

    reviewData.push({ id: rId, rating, sentiment, custIdx, locIdx, dAgo, platform })

    await sql`INSERT INTO reviews (id, workspace_id, location_id, connector_instance_id, customer_id, platform, platform_review_id, reviewer_name, rating, text, reviewed_at, language, sentiment, sentiment_score, themes, metadata, source, aspect_tags, is_escalated, created_at, updated_at)
      VALUES (${rId}, ${WORKSPACE_ID}, ${locationIds[locIdx]}, ${connId}, ${customerIds[custIdx]}, ${platform}, ${`${platform}_rev_${i}_${rand(10000,99999)}`}, ${customerNames[custIdx]}, ${rating}, ${text}, ${daysAgo(dAgo)}, 'en', ${sentiment}, ${sentimentScore}, ${sql.array(themes)}, ${sql.json({platform, verified: Math.random() > 0.3})}, 'online', ${sql.array(aspectTags)}, ${rating <= 2 && Math.random() > 0.5}, ${daysAgo(dAgo)}, NOW())`
  }
  console.log(`   ✓ 500 reviews created`)

  // ─── 9. Create Review Responses (AI-generated and human) ───────────────────
  console.log('\n💬 Creating review responses...')
  let responseCount = 0
  for (let i = 0; i < reviewIds.length; i++) {
    // 70% of reviews get a response
    if (Math.random() > 0.70) continue
    const review = reviewData[i]
    const template = pick(REVIEW_RESPONSE_TEMPLATES).replace('{name}', customerNames[review.custIdx]).replace('{dish}', pick(['biryani', 'butter chicken', 'paneer tikka', 'masala dosa', 'thali']))
    const statuses = ['posted', 'posted', 'posted', 'approved', 'draft', 'rejected']
    const status = pick(statuses)
    const generatedBy = Math.random() > 0.3 ? 'ai' : 'human'
    await sql`INSERT INTO review_responses (id, review_id, content, status, generated_by, ai_model, approved_by, posted_at, created_at, updated_at)
      VALUES (${uuid()}, ${review.id}, ${template}, ${status}, ${generatedBy}, ${generatedBy === 'ai' ? 'openai/gpt-4o-mini' : null}, ${status === 'approved' || status === 'posted' ? pick(allUserIds) : null}, ${status === 'posted' ? daysAgo(review.dAgo > 0 ? review.dAgo - 1 : 0) : null}, ${daysAgo(review.dAgo)}, NOW())`
    responseCount++
  }
  console.log(`   ✓ ${responseCount} review responses created`)

  // ─── 10. Create Journeys (3 journeys with screens) ────────────────────────
  console.log('\n🗺️ Creating journeys...')
  const journeyData = [
    { name: 'Dine-In Feedback Journey', slug: 'dine-in-feedback-' + rand(1000,9999), locIdx: 0, isDefault: true },
    { name: 'Delivery Feedback Journey', slug: 'delivery-feedback-' + rand(1000,9999), locIdx: 1, isDefault: false },
    { name: 'Quick NPS Survey', slug: 'quick-nps-' + rand(1000,9999), locIdx: 2, isDefault: false },
  ]
  const journeyIds = []
  const journeyScreenIds = []
  for (const j of journeyData) {
    const jId = uuid()
    journeyIds.push(jId)
    await sql`INSERT INTO journeys (id, workspace_id, location_id, name, slug, is_default, is_active, settings, created_at, updated_at)
      VALUES (${jId}, ${WORKSPACE_ID}, ${locationIds[j.locIdx]}, ${j.name}, ${j.slug}, ${j.isDefault}, true, ${sql.json({positiveThreshold: 4, enableCoupon: true, reviewPlatform: 'google'})}, ${daysAgo(60)}, NOW())`

    // Add screens
    const screens = [
      { type: 'rating', title: 'How was your experience?', subtitle: 'Tap a star to rate', order: 0 },
      { type: 'aspects', title: 'What did you enjoy?', subtitle: 'Select all that apply', order: 1 },
      { type: 'feedback', title: 'Tell us more', subtitle: 'Your feedback helps us improve', order: 2 },
      { type: 'review_redirect', title: 'Share your experience!', subtitle: 'Help others discover us', order: 3 },
      { type: 'thank_you', title: 'Thank you!', subtitle: 'We appreciate your feedback', order: 4 },
    ]
    for (const s of screens) {
      const sId = uuid()
      journeyScreenIds.push(sId)
      await sql`INSERT INTO journey_screens (id, journey_id, "order", screen_type, title, subtitle, config, branch_conditions, created_at, updated_at)
        VALUES (${sId}, ${jId}, ${s.order}, ${s.type}, ${s.title}, ${s.subtitle}, ${sql.json({})}, ${sql.array([])}, ${daysAgo(60)}, NOW())`
    }
    console.log(`   ✓ ${j.name} (${screens.length} screens)`)
  }

  // ─── 11. Create Journey Responses (200+) ───────────────────────────────────
  console.log('\n📝 Creating journey responses...')
  const journeyResponseIds = []
  for (let i = 0; i < 200; i++) {
    const jrId = uuid()
    journeyResponseIds.push(jrId)
    const jIdx = i % journeyIds.length
    const locIdx = i % locationIds.length
    const custIdx = i % customerIds.length
    const rating = rand(1, 5)
    await sql`INSERT INTO journey_responses (id, journey_id, customer_id, location_id, session_id, response_data, created_at)
      VALUES (${jrId}, ${journeyIds[jIdx]}, ${customerIds[custIdx]}, ${locationIds[locIdx]}, ${'sess_' + uuid().slice(0,8)}, ${sql.json({
        rating,
        aspects: pickN(ASPECTS, rand(1, 4)),
        feedback: rating >= 4 ? pick(['Great food!', 'Loved the service', 'Will come again', 'Best restaurant']) : pick(['Could be better', 'Slow service', 'Food was cold', 'Too expensive']),
        nps: rand(0, 10),
        contactInfo: { name: customerNames[custIdx], phone: customerPhones[custIdx] },
      })}, ${daysAgo(rand(0, 90))})`
  }
  console.log(`   ✓ 200 journey responses created`)

  // ─── 12. Create TruForms (4 forms with responses) ─────────────────────────
  console.log('\n📋 Creating TruForms...')
  const truformData = [
    { name: 'Monthly NPS Survey', type: 'nps', status: 'active', slug: 'monthly-nps-' + rand(1000,9999) },
    { name: 'Dine-In CSAT', type: 'csat', status: 'active', slug: 'dine-in-csat-' + rand(1000,9999) },
    { name: 'Delivery CES', type: 'ces', status: 'active', slug: 'delivery-ces-' + rand(1000,9999) },
    { name: 'Custom Feedback Form', type: 'custom', status: 'active', slug: 'custom-feedback-' + rand(1000,9999) },
  ]
  const truformIds = []
  for (const tf of truformData) {
    const tfId = uuid()
    truformIds.push(tfId)
    await sql`INSERT INTO truforms (id, workspace_id, location_id, name, type, status, config, slug, created_at, updated_at)
      VALUES (${tfId}, ${WORKSPACE_ID}, ${pick(locationIds)}, ${tf.name}, ${tf.type}, ${tf.status}, ${sql.json({
        questions: [
          { id: 'q1', type: tf.type === 'nps' ? 'nps' : 'rating', text: tf.type === 'nps' ? 'How likely are you to recommend us?' : 'Rate your experience' },
          { id: 'q2', type: 'text', text: 'What could we improve?' },
          { id: 'q3', type: 'select', text: 'How did you hear about us?', options: ['Google', 'Instagram', 'Friend', 'Walk-in', 'Zomato'] },
        ],
        branding: { primaryColor: '#E65100', logo: '/logo.png' },
        thankYouMessage: 'Thank you for your valuable feedback!',
      })}, ${tf.slug}, ${daysAgo(45)}, NOW())`
    console.log(`   ✓ ${tf.name}`)
  }

  // Create 150 TruForm responses
  console.log('   Creating 150 truform responses...')
  const truformResponseIds = []
  for (let i = 0; i < 150; i++) {
    const trId = uuid()
    truformResponseIds.push(trId)
    const tfIdx = i % truformIds.length
    const custIdx = i % customerIds.length
    const score = rand(1, 10)
    await sql`INSERT INTO truform_responses (id, truform_id, customer_id, score, answers, metadata, completed_at, created_at)
      VALUES (${trId}, ${truformIds[tfIdx]}, ${customerIds[custIdx]}, ${score}, ${sql.json({
        q1: score,
        q2: score >= 7 ? pick(['Everything was great!', 'Nothing, keep it up!', 'More variety please']) : pick(['Faster service', 'Better hygiene', 'Lower prices', 'More parking']),
        q3: pick(['Google', 'Instagram', 'Friend', 'Walk-in', 'Zomato']),
      })}, ${sql.json({ source: pick(['qr', 'email', 'whatsapp', 'link']), device: pick(['mobile', 'desktop', 'tablet']) })}, ${daysAgo(rand(0, 60))}, ${daysAgo(rand(0, 60))})`
  }
  console.log(`   ✓ 150 truform responses created`)

  // ─── 13. Create Coupon Templates & Instances ───────────────────────────────
  console.log('\n🎟️ Creating coupons...')
  const couponTemplateIds = []
  const couponData = [
    { name: 'Welcome 10% Off', prefix: 'WELCOME', type: 'percentage', value: 10, desc: 'Get 10% off on your next visit', validity: 30 },
    { name: 'Loyalty 20% Off', prefix: 'LOYAL', type: 'percentage', value: 20, desc: '20% off for our loyal customers', validity: 15 },
    { name: 'Free Dessert', prefix: 'DESSERT', type: 'freebie', value: 0, desc: 'Complimentary dessert on your next visit', validity: 7 },
    { name: 'Flat ₹200 Off', prefix: 'FLAT200', type: 'flat', value: 200, desc: 'Flat ₹200 off on orders above ₹999', validity: 14 },
    { name: 'Birthday Special 25%', prefix: 'BDAY', type: 'percentage', value: 25, desc: 'Birthday special - 25% off!', validity: 7 },
    { name: 'Feedback Thank You', prefix: 'THANKS', type: 'percentage', value: 15, desc: 'Thank you for your feedback - 15% off', validity: 21 },
  ]
  for (const c of couponData) {
    const ctId = uuid()
    couponTemplateIds.push(ctId)
    await sql`INSERT INTO coupon_templates (id, workspace_id, name, code_prefix, discount_type, discount_value, description, terms_and_conditions, max_redemptions, validity_days, is_active, created_at, updated_at)
      VALUES (${ctId}, ${WORKSPACE_ID}, ${c.name}, ${c.prefix}, ${c.type}, ${c.value}, ${c.desc}, ${'Valid on dine-in and delivery orders. Cannot be combined with other offers.'}, ${rand(100, 500)}, ${c.validity}, true, ${daysAgo(60)}, NOW())`
  }
  console.log(`   ✓ ${couponData.length} coupon templates`)

  // Create 80 coupon instances
  let issuedCount = 0, redeemedCount = 0, expiredCount = 0
  for (let i = 0; i < 80; i++) {
    const templateIdx = i % couponTemplateIds.length
    const custIdx = i % customerIds.length
    const code = `${couponData[templateIdx].prefix}-${rand(100000, 999999)}`
    const statusRoll = Math.random()
    let status, redeemedAt = null
    if (statusRoll < 0.4) { status = 'redeemed'; redeemedAt = daysAgo(rand(0, 15)); redeemedCount++ }
    else if (statusRoll < 0.75) { status = 'issued'; issuedCount++ }
    else { status = 'expired'; expiredCount++ }
    const issuedDaysAgo = rand(5, 60)
    await sql`INSERT INTO coupon_instances (id, template_id, workspace_id, customer_id, location_id, unique_code, status, issued_at, expires_at, redeemed_at, delivery_method, delivery_status, created_at, updated_at)
      VALUES (${uuid()}, ${couponTemplateIds[templateIdx]}, ${WORKSPACE_ID}, ${customerIds[custIdx]}, ${pick(locationIds)}, ${code}, ${status}, ${daysAgo(issuedDaysAgo)}, ${daysAgo(issuedDaysAgo - couponData[templateIdx].validity)}, ${redeemedAt}, ${pick(['whatsapp','email','sms','in_app'])}, ${status === 'issued' ? 'delivered' : 'delivered'}, ${daysAgo(issuedDaysAgo)}, NOW())`
  }
  console.log(`   ✓ 80 coupon instances (${issuedCount} issued, ${redeemedCount} redeemed, ${expiredCount} expired)`)

  // ─── 14. Create Escalation Rules & Escalations ─────────────────────────────
  console.log('\n🚨 Creating escalation rules & escalations...')
  const escRuleIds = []
  const escRuleData = [
    { name: 'Low Rating Alert', trigger: 'rating_threshold', config: { maxRating: 2 }, priority: 'high', sla: 120 },
    { name: 'Hygiene Complaint', trigger: 'keyword_match', config: { keywords: ['hygiene', 'dirty', 'insect', 'hair', 'unclean'] }, priority: 'critical', sla: 60 },
    { name: 'Negative Sentiment', trigger: 'sentiment', config: { sentiment: 'negative', minScore: -0.7 }, priority: 'medium', sla: 240 },
    { name: 'Staff Behavior Issue', trigger: 'aspect_match', config: { aspects: ['Staff Behavior'] }, priority: 'high', sla: 180 },
    { name: 'Manual Escalation', trigger: 'manual', config: {}, priority: 'medium', sla: 480 },
  ]
  for (const er of escRuleData) {
    const erId = uuid()
    escRuleIds.push(erId)
    await sql`INSERT INTO escalation_rules (id, workspace_id, name, trigger_type, trigger_config, assign_to_user_id, priority, sla_minutes, is_active, sort_order, created_at, updated_at)
      VALUES (${erId}, ${WORKSPACE_ID}, ${er.name}, ${er.trigger}, ${sql.json(er.config)}, ${pick(allUserIds)}, ${er.priority}, ${er.sla}, true, ${escRuleIds.length}, ${daysAgo(45)}, NOW())`
  }
  console.log(`   ✓ ${escRuleData.length} escalation rules`)

  // Create 35 escalations
  const negativeReviews = reviewData.filter(r => r.rating <= 2)
  for (let i = 0; i < 35; i++) {
    const review = negativeReviews[i % negativeReviews.length]
    const ruleIdx = i % escRuleIds.length
    const statusRoll = Math.random()
    let status, resolvedAt = null, slaBreached = false
    if (statusRoll < 0.3) { status = 'resolved'; resolvedAt = daysAgo(rand(0, 10)) }
    else if (statusRoll < 0.5) { status = 'in_progress' }
    else if (statusRoll < 0.7) { status = 'open'; slaBreached = Math.random() > 0.5 }
    else { status = 'open' }

    const createdDaysAgo = rand(0, 30)
    await sql`INSERT INTO escalations (id, workspace_id, rule_id, review_id, customer_id, location_id, assigned_to_user_id, status, priority, sla_deadline, sla_breached, notes, resolved_at, resolved_by_user_id, created_at, updated_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${escRuleIds[ruleIdx]}, ${review.id}, ${customerIds[review.custIdx]}, ${locationIds[review.locIdx]}, ${pick(allUserIds)}, ${status}, ${pick(['low','medium','high','critical'])}, ${daysAgo(createdDaysAgo - 1)}, ${slaBreached}, ${status === 'resolved' ? pick(['Contacted customer and resolved.', 'Offered complimentary meal.', 'Staff reprimanded and re-trained.', 'Refund processed.']) : null}, ${resolvedAt}, ${resolvedAt ? pick(allUserIds) : null}, ${daysAgo(createdDaysAgo)}, NOW())`
  }
  console.log(`   ✓ 35 escalations created`)

  // ─── 15. NEV Responses (200) ───────────────────────────────────────────────
  console.log('\n😊 Creating NEV emotion responses...')
  const emotionPool = [
    { name: 'Joy', cluster: 'joy', polarity: 'positive' },
    { name: 'Gratitude', cluster: 'joy', polarity: 'positive' },
    { name: 'Excitement', cluster: 'joy', polarity: 'positive' },
    { name: 'Trust', cluster: 'comfort', polarity: 'positive' },
    { name: 'Satisfaction', cluster: 'comfort', polarity: 'positive' },
    { name: 'Relief', cluster: 'comfort', polarity: 'positive' },
    { name: 'Frustration', cluster: 'frustration', polarity: 'negative' },
    { name: 'Anger', cluster: 'frustration', polarity: 'negative' },
    { name: 'Disappointment', cluster: 'frustration', polarity: 'negative' },
    { name: 'Anxiety', cluster: 'anxiety', polarity: 'negative' },
    { name: 'Confusion', cluster: 'anxiety', polarity: 'negative' },
    { name: 'Disgust', cluster: 'frustration', polarity: 'negative' },
  ]

  // First ensure emotion_definitions exist
  for (let i = 0; i < emotionPool.length; i++) {
    const e = emotionPool[i]
    await sql`INSERT INTO emotion_definitions (id, name, cluster, polarity, emoji, description, sort_order)
      VALUES (${uuid()}, ${e.name}, ${e.cluster}, ${e.polarity}, ${e.polarity === 'positive' ? pick(['😊','😃','🙏','✨','💚','😌']) : pick(['😤','😡','😞','😰','😵','🤢'])}, ${`Customer feels ${e.name.toLowerCase()}`}, ${i})
      ON CONFLICT (name) DO NOTHING`
  }

  for (let i = 0; i < 200; i++) {
    const custIdx = i % customerIds.length
    const locIdx = i % locationIds.length
    const reviewIdx = i < reviewIds.length ? i : null
    const positiveEmotions = emotionPool.filter(e => e.polarity === 'positive')
    const negativeEmotions = emotionPool.filter(e => e.polarity === 'negative')
    const isPositive = Math.random() > 0.35
    const selectedEmotions = isPositive ? pickN(positiveEmotions, rand(1, 3)) : pickN(negativeEmotions, rand(1, 3))
    const emotions = selectedEmotions.map(e => ({ emotion: e.name, intensity: randFloat(0.3, 1.0) }))
    const positiveSum = emotions.filter(e => emotionPool.find(ep => ep.name === e.emotion)?.polarity === 'positive').reduce((s, e) => s + e.intensity, 0)
    const negativeSum = emotions.filter(e => emotionPool.find(ep => ep.name === e.emotion)?.polarity === 'negative').reduce((s, e) => s + e.intensity, 0)
    const total = positiveSum + negativeSum
    const nevScore = total > 0 ? +((positiveSum - negativeSum) / total * 100).toFixed(1) : 0

    await sql`INSERT INTO nev_responses (id, workspace_id, customer_id, location_id, review_id, source, emotions, nev_score, raw_text, created_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${customerIds[custIdx]}, ${locationIds[locIdx]}, ${reviewIdx !== null ? reviewIds[reviewIdx] : null}, ${pick(['active_survey', 'passive_nlp', 'journey'])}, ${sql.json(emotions)}, ${nevScore}, ${pick(POSITIVE_REVIEWS.concat(NEGATIVE_REVIEWS))}, ${daysAgo(rand(0, 90))})`
  }
  console.log(`   ✓ 200 NEV responses created`)

  // ─── 16. CLI Responses (150) ───────────────────────────────────────────────
  console.log('\n📈 Creating CLI loyalty responses...')
  for (let i = 0; i < 150; i++) {
    const custIdx = i % customerIds.length
    const locIdx = i % locationIds.length
    const trust = randFloat(1, 10)
    const satisfaction = randFloat(1, 10)
    const advocacy = randFloat(1, 10)
    const cliScore = +(trust * 3.5 + satisfaction * 4.0 + advocacy * 2.5).toFixed(1)
    let segment
    if (cliScore >= 85) segment = 'champion'
    else if (cliScore >= 70) segment = 'loyal'
    else if (cliScore >= 50) segment = 'neutral'
    else if (cliScore >= 30) segment = 'at_risk'
    else segment = 'detractor'

    await sql`INSERT INTO cli_responses (id, workspace_id, customer_id, location_id, trust_score, satisfaction_score, advocacy_score, cli_score, segment, metadata, created_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${customerIds[custIdx]}, ${locationIds[locIdx]}, ${trust}, ${satisfaction}, ${advocacy}, ${cliScore}, ${segment}, ${sql.json({source: pick(['truform', 'journey', 'review_derived'])})}, ${daysAgo(rand(0, 90))})`
  }
  console.log(`   ✓ 150 CLI responses created`)

  // ─── 17. Notifications (50) ────────────────────────────────────────────────
  console.log('\n🔔 Creating notifications...')
  const notifTypes = ['review_received', 'escalation_created', 'escalation_assigned', 'sla_breach', 'coupon_redeemed', 'sync_complete', 'journey_response', 'system']
  const notifMessages = {
    review_received: ['New 5-star review from {name} on Google!', 'New 1-star review from {name} on Zomato', 'New review from {name} - {rating} stars'],
    escalation_created: ['Escalation created for review by {name}', 'Critical escalation: Hygiene complaint from {name}'],
    escalation_assigned: ['Escalation assigned to you for {name}\'s review'],
    sla_breach: ['SLA breach! Escalation for {name} is overdue', 'Urgent: SLA deadline missed for escalation'],
    coupon_redeemed: ['{name} redeemed coupon WELCOME-123456', 'Coupon redeemed at Koramangala branch'],
    sync_complete: ['Google reviews sync complete - 15 new reviews', 'Zomato sync: 8 new reviews pulled'],
    journey_response: ['New journey response from {name} - rated 5 stars', '{name} completed the feedback journey'],
    system: ['System maintenance scheduled for Sunday 2 AM', 'New feature: AI Studio is now available!'],
  }
  for (let i = 0; i < 50; i++) {
    const type = pick(notifTypes)
    const custName = pick(customerNames)
    const msg = pick(notifMessages[type]).replace(/{name}/g, custName).replace(/{rating}/g, rand(1, 5).toString())
    await sql`INSERT INTO notifications (id, workspace_id, user_id, type, title, message, link, is_read, metadata, created_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${pick(allUserIds)}, ${type}, ${type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}, ${msg}, ${pick(['/dashboard/inbox', '/dashboard/escalations', '/dashboard/coupons', '/dashboard/analytics', null])}, ${Math.random() > 0.4}, ${sql.json({})}, ${daysAgo(rand(0, 30))})`
  }
  console.log(`   ✓ 50 notifications created`)

  // ─── 18. Automation Rules & Queue ──────────────────────────────────────────
  console.log('\n⚙️ Creating automation rules...')
  const automationData = [
    { name: 'Send coupon after positive journey', trigger: 'journey_completed_positive', action: 'send_coupon', delay: 5 },
    { name: 'Escalate negative journey', trigger: 'journey_completed_negative', action: 'create_escalation', delay: 0 },
    { name: 'Tag dormant customers', trigger: 'customer_dormant', action: 'tag_customer', delay: 0 },
    { name: 'Send WhatsApp after review', trigger: 'review_posted', action: 'send_message', delay: 60 },
    { name: 'Coupon for abandoned journey', trigger: 'journey_abandoned', action: 'send_coupon', delay: 1440 },
  ]
  const automationRuleIds = []
  for (const a of automationData) {
    const aId = uuid()
    automationRuleIds.push(aId)
    await sql`INSERT INTO automation_rules (id, workspace_id, journey_id, name, trigger_event, delay_minutes, action_type, action_config, conditions, is_active, created_at, updated_at)
      VALUES (${aId}, ${WORKSPACE_ID}, ${pick(journeyIds)}, ${a.name}, ${a.trigger}, ${a.delay}, ${a.action}, ${sql.json({ templateId: pick(couponTemplateIds), message: 'Thank you for your visit!' })}, ${null}, true, ${daysAgo(30)}, NOW())`
  }
  console.log(`   ✓ ${automationData.length} automation rules`)

  // Create 40 automation queue items
  for (let i = 0; i < 40; i++) {
    const ruleIdx = i % automationRuleIds.length
    const statusRoll = Math.random()
    let status
    if (statusRoll < 0.5) status = 'completed'
    else if (statusRoll < 0.7) status = 'pending'
    else if (statusRoll < 0.85) status = 'processing'
    else status = 'failed'
    await sql`INSERT INTO automation_queue (id, rule_id, workspace_id, customer_id, scheduled_for, status, attempts, completed_at, metadata, created_at, updated_at)
      VALUES (${uuid()}, ${automationRuleIds[ruleIdx]}, ${WORKSPACE_ID}, ${pick(customerIds)}, ${daysAgo(rand(0, 20))}, ${status}, ${status === 'completed' ? 1 : rand(0, 3)}, ${status === 'completed' ? daysAgo(rand(0, 10)) : null}, ${sql.json({})}, ${daysAgo(rand(0, 20))}, NOW())`
  }
  console.log(`   ✓ 40 automation queue items`)

  // ─── 19. Business Listings & Change Log ────────────────────────────────────
  console.log('\n🏪 Creating business listings...')
  for (let i = 0; i < locationIds.length; i++) {
    // Google listing
    const gListingId = uuid()
    await sql`INSERT INTO business_listings (id, workspace_id, location_id, connector_instance_id, platform, platform_listing_id, name, address, phone, website, categories, hours, attributes, last_synced_data, last_sync_at, created_at, updated_at)
      VALUES (${gListingId}, ${WORKSPACE_ID}, ${locationIds[i]}, ${connectorIds.google[i]}, 'google', ${'ChIJ'+rand(100000,999999)}, ${locationData[i].name}, ${locationData[i].address}, ${locationData[i].phone}, 'https://spicegarden.in', ${sql.array(['Indian Restaurant', 'North Indian', 'South Indian', 'Biryani', 'Vegetarian Friendly'])}, ${sql.json({
        monday: {open: '11:00', close: '23:00'},
        tuesday: {open: '11:00', close: '23:00'},
        wednesday: {open: '11:00', close: '23:00'},
        thursday: {open: '11:00', close: '23:00'},
        friday: {open: '11:00', close: '23:30'},
        saturday: {open: '10:00', close: '23:30'},
        sunday: {open: '10:00', close: '23:00'},
      })}, ${sql.json({wifi: true, parking: true, outdoor_seating: true, delivery: true, dine_in: true, takeout: true})}, ${sql.json({})}, ${daysAgo(0)}, ${daysAgo(90)}, NOW())`

    // Add some change log entries
    const changes = [
      { field: 'hours', prev: '11:00-22:00', newVal: '11:00-23:00', source: 'google_suggest' },
      { field: 'phone', prev: '+919876543210', newVal: '+919876543299', source: 'google_suggest' },
      { field: 'name', prev: 'Spice Garden', newVal: 'Spice Garden Restaurant', source: 'owner' },
    ]
    for (const ch of changes) {
      await sql`INSERT INTO listing_change_log (id, listing_id, field, previous_value, new_value, change_source, is_authorized, detected_at, resolved_at, resolved_by, created_at)
        VALUES (${uuid()}, ${gListingId}, ${ch.field}, ${ch.prev}, ${ch.newVal}, ${ch.source}, ${ch.source === 'owner'}, ${daysAgo(rand(1, 30))}, ${ch.source === 'owner' ? daysAgo(rand(0, 5)) : null}, ${ch.source === 'owner' ? TEST_USER_ID : null}, ${daysAgo(rand(1, 30))})`
    }

    // Zomato listing
    await sql`INSERT INTO business_listings (id, workspace_id, location_id, connector_instance_id, platform, platform_listing_id, name, address, phone, website, categories, hours, attributes, last_synced_data, last_sync_at, created_at, updated_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${locationIds[i]}, ${connectorIds.zomato[i]}, 'zomato', ${rand(10000,99999).toString()}, ${locationData[i].name}, ${locationData[i].address}, ${locationData[i].phone}, 'https://spicegarden.in', ${sql.array(['Indian', 'North Indian', 'Biryani', 'Mughlai'])}, ${sql.json({})}, ${sql.json({costForTwo: 800, averageRating: 4.2})}, ${sql.json({})}, ${daysAgo(0)}, ${daysAgo(60)}, NOW())`
  }
  console.log(`   ✓ ${locationIds.length * 2} listings + change logs`)

  // ─── 20. Listing Posts (GBP posts) ─────────────────────────────────────────
  console.log('\n📢 Creating listing posts...')
  const postTopics = [
    { title: 'Weekend Special: Hyderabadi Biryani Fest', content: 'Join us this weekend for our special Hyderabadi Biryani Festival! Authentic flavors, generous portions, and a complimentary dessert with every biryani order. Book your table now!' },
    { title: 'New Menu Launch', content: 'Exciting news! We have launched our new winter menu featuring 15 new dishes including Rogan Josh, Nihari, and Gajar Ka Halwa. Come taste the warmth!' },
    { title: 'Live Music Fridays', content: 'Start your weekend right with live Bollywood and Sufi music every Friday evening from 7 PM. No cover charge! Reserve your spot.' },
    { title: 'Happy Hours Extended!', content: 'Great news! Our happy hour is now from 4 PM to 8 PM. Enjoy 50% off on mocktails and 30% off on appetizers.' },
    { title: 'Customer Appreciation Day', content: 'To thank our amazing customers, we are offering 20% off on all orders this Saturday. Use code THANKYOU20 for online orders!' },
  ]
  for (const post of postTopics) {
    for (let i = 0; i < locationIds.length; i++) {
      await sql`INSERT INTO listing_posts (id, workspace_id, location_id, connector_instance_id, type, title, content, status, published_at, created_at, updated_at)
        VALUES (${uuid()}, ${WORKSPACE_ID}, ${locationIds[i]}, ${connectorIds.google[i]}, ${pick(['update','offer','event'])}, ${post.title}, ${post.content}, ${pick(['published','published','draft'])}, ${daysAgo(rand(0, 30))}, ${daysAgo(rand(0, 30))}, NOW())`
    }
  }
  console.log(`   ✓ ${postTopics.length * locationIds.length} listing posts`)

  // ─── 21. Billing / Subscription ────────────────────────────────────────────
  console.log('\n💳 Creating billing data...')
  const subId = uuid()
  const periodStart = new Date()
  periodStart.setDate(1) // 1st of current month
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await sql`INSERT INTO subscriptions (id, workspace_id, plan, status, razorpay_subscription_id, razorpay_customer_id, current_period_start, current_period_end, trial_ends_at, metadata, created_at, updated_at)
    VALUES (${subId}, ${WORKSPACE_ID}, 'pro', 'active', ${'sub_demo_' + rand(100000, 999999)}, ${'cust_demo_' + rand(100000, 999999)}, ${periodStart.toISOString()}, ${periodEnd.toISOString()}, null, ${sql.json({ plan_name: 'Pro Plan', amount: 299900, currency: 'INR' })}, ${daysAgo(90)}, NOW())`

  // Create 3 months of invoices
  for (let m = 0; m < 3; m++) {
    const invDate = new Date()
    invDate.setMonth(invDate.getMonth() - m)
    invDate.setDate(1)
    await sql`INSERT INTO invoices (id, subscription_id, razorpay_invoice_id, amount, currency, status, paid_at, invoice_url, created_at)
      VALUES (${uuid()}, ${subId}, ${'inv_demo_' + rand(100000, 999999)}, 299900, 'INR', ${m === 0 ? 'pending' : 'paid'}, ${m > 0 ? invDate.toISOString() : null}, ${'https://dashboard.razorpay.com/invoices/inv_demo'}, ${invDate.toISOString()})`
  }
  console.log(`   ✓ Subscription (Pro Plan) + 3 invoices`)

  // ─── 22. Reports ───────────────────────────────────────────────────────────
  console.log('\n📄 Creating report snapshots...')
  const reportTypes = ['orm_overview', 'aspect_analysis', 'truforms_feedback', 'nev_report', 'cli_report']
  for (const rt of reportTypes) {
    await sql`INSERT INTO report_snapshots (id, workspace_id, report_type, title, date_from, date_to, location_id, data, generated_by_user_id, share_token, created_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${rt}, ${rt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' - March 2026'}, ${daysAgo(30)}, ${daysAgo(0)}, null, ${sql.json({
        summary: { totalReviews: rand(100, 200), averageRating: randFloat(3.5, 4.5), responseRate: rand(60, 90), sentimentBreakdown: { positive: rand(50, 70), neutral: rand(15, 25), negative: rand(10, 20) } },
        charts: { ratingDistribution: [rand(5, 15), rand(10, 20), rand(15, 25), rand(20, 30), rand(30, 50)] },
      })}, ${TEST_USER_ID}, ${'share_' + rand(100000, 999999)}, ${daysAgo(rand(0, 7))})`
  }
  console.log(`   ✓ ${reportTypes.length} report snapshots`)

  // ─── 23. Social Posts (rAIS) ───────────────────────────────────────────────
  console.log('\n🎨 Creating social posts (rAIS)...')
  const socialPosts = [
    { platform: 'instagram', type: 'post', caption: '🍛 Fresh out of the tandoor! Our signature Butter Chicken is made with love, cream, and the perfect blend of spices. #ButterChicken #SpiceGarden #BangaloreFood', hashtags: ['ButterChicken', 'SpiceGarden', 'BangaloreFood', 'IndianFood', 'Foodie'] },
    { platform: 'instagram', type: 'reel_caption', caption: 'POV: You just took the first bite of our Hyderabadi Biryani 🤤 Tag someone who needs to try this! #BiryaniLovers #Hyderabadi #FoodReels', hashtags: ['BiryaniLovers', 'Hyderabadi', 'FoodReels', 'SpiceGarden'] },
    { platform: 'facebook', type: 'post', caption: 'Weekend plans sorted! 🎉 Join us for our Saturday Brunch Buffet. 20+ dishes, live counters, and unlimited desserts. Book your table now!', hashtags: ['WeekendBrunch', 'Buffet', 'SpiceGarden'] },
    { platform: 'google', type: 'offer', caption: 'Special Offer: Flat 20% off on all orders above ₹999. Valid till end of month! Order now from Zomato or Swiggy.', hashtags: ['Offer', 'Discount', 'OrderNow'] },
    { platform: 'instagram', type: 'story', caption: 'Behind the scenes in our kitchen 👨‍🍳 Watch our chefs prepare the perfect Naan! Swipe up to book a table.', hashtags: ['BehindTheScenes', 'ChefLife', 'NaanArt'] },
    { platform: 'facebook', type: 'event', caption: 'This Holi, celebrate with colors and flavors! 🎨🍽️ Special Holi Thali available from March 24-26. Pre-book to avoid disappointment.', hashtags: ['Holi2026', 'HoliSpecial', 'Festival'] },
    { platform: 'instagram', type: 'post', caption: 'Customer love is the best kind of love ❤️ Thank you @priya_foodie for this amazing review! We are grateful for your support.', hashtags: ['CustomerLove', 'ThankYou', 'Review'] },
    { platform: 'linkedin', type: 'post', caption: 'Proud to announce that Spice Garden has been rated as the #1 North Indian restaurant in Koramangala by Zomato for 3 consecutive quarters! 🏆', hashtags: ['Achievement', 'SpiceGarden', 'Restaurant'] },
  ]
  for (const sp of socialPosts) {
    await sql`INSERT INTO social_posts (id, workspace_id, location_id, platform, content_type, caption, hashtags, status, scheduled_for, published_at, ai_model, created_by, created_at, updated_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${pick(locationIds)}, ${sp.platform}, ${sp.type}, ${sp.caption}, ${sql.array(sp.hashtags)}, ${pick(['published','published','scheduled','draft'])}, ${daysAgo(rand(-7, 7))}, ${Math.random() > 0.3 ? daysAgo(rand(0, 30)) : null}, 'openai/gpt-4o-mini', ${TEST_USER_ID}, ${daysAgo(rand(0, 30))}, NOW())`
  }
  console.log(`   ✓ ${socialPosts.length} social posts`)

  // Content Calendar
  for (let d = 0; d < 30; d++) {
    const date = new Date(Date.now() - (15 - d) * 86400000)
    const dateStr = date.toISOString().split('T')[0]
    const numSlots = rand(0, 3)
    const slots = []
    for (let s = 0; s < numSlots; s++) {
      slots.push({ time: `${rand(9, 18)}:00`, platform: pick(['instagram', 'facebook', 'google']), type: pick(['post', 'story', 'offer']), status: d < 15 ? 'published' : 'scheduled' })
    }
    if (slots.length > 0) {
      await sql`INSERT INTO content_calendar (id, workspace_id, date, slots, created_at, updated_at)
        VALUES (${uuid()}, ${WORKSPACE_ID}, ${dateStr}, ${sql.json(slots)}, NOW(), NOW())`
    }
  }
  console.log(`   ✓ Content calendar (30 days)`)

  // Brand Voice
  await sql`INSERT INTO brand_voice (id, workspace_id, tone, keywords, avoid_words, sample_posts, industry, created_at, updated_at)
    VALUES (${uuid()}, ${WORKSPACE_ID}, 'friendly', ${sql.array(['authentic', 'homestyle', 'fresh', 'flavorful', 'welcoming', 'family', 'tradition'])}, ${sql.array(['cheap', 'discount', 'sorry', 'unfortunately', 'cannot'])}, ${sql.array(['Come taste the tradition! Our recipes have been passed down through generations.', 'Fresh ingredients, authentic flavors, and a whole lot of love in every dish.'])}, 'Restaurant & Cafe', NOW(), NOW())`
  console.log(`   ✓ Brand voice configured`)

  // ─── 24. Onboarding State ─────────────────────────────────────────────────
  await sql`INSERT INTO onboarding_state (id, workspace_id, current_step, completed_steps, is_complete, created_at, updated_at)
    VALUES (${uuid()}, ${WORKSPACE_ID}, 5, ${sql.json([0, 1, 2, 3, 4])}, true, ${daysAgo(90)}, NOW())`
  console.log('\n   ✓ Onboarding marked complete')

  // ─── 25. AI Response Schedules & Daily Counts ──────────────────────────────
  console.log('\n🤖 Creating AI schedule data...')
  // Daily counts for last 30 days per location
  for (const locId of locationIds) {
    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0]
      await sql`INSERT INTO ai_response_daily_counts (id, location_id, date, count)
        VALUES (${uuid()}, ${locId}, ${date}, ${rand(2, 12)})
        ON CONFLICT DO NOTHING`
    }
  }
  console.log(`   ✓ 30 days of AI daily counts per location`)

  // ─── Done! ────────────────────────────────────────────────────────────────
  // ─── 26. Appointments ──────────────────────────────────────────────────────
  console.log('📅 Seeding appointments...')
  await sql`DELETE FROM appointments WHERE workspace_id = ${WORKSPACE_ID}`
  const futureDay = d => new Date(Date.now() + d * 86400000)
  const appointmentData = [
    { name: 'Rahul Sharma', email: 'rahul@email.com', phone: '+91-9876543210', title: 'Birthday Party (20 guests)', status: 'completed', start: days(15), notes: 'Decorated area, special cake' },
    { name: 'Priya Patel', email: 'priya@company.com', phone: '+91-9876543211', title: 'Corporate Lunch Meeting', status: 'completed', start: days(12), notes: 'Projector needed, veg only' },
    { name: 'Amit Kumar', email: 'amit@gmail.com', phone: '+91-9876543212', title: 'Food Blogger Review Visit', status: 'completed', start: days(10), notes: 'Complimentary tasting menu' },
    { name: 'Sneha Gupta', email: 'sneha@email.com', phone: '+91-9876543213', title: 'Anniversary Dinner (2 guests)', status: 'completed', start: days(8), notes: 'Window table, candle setup' },
    { name: 'Vikram Singh', email: 'vikram@email.com', phone: '+91-9876543214', title: 'Family Brunch (8 guests)', status: 'completed', start: days(5), notes: 'Kids high chairs needed' },
    { name: 'Deepika Reddy', email: 'deepika@corp.com', phone: '+91-9876543215', title: 'Team Outing Lunch (15 guests)', status: 'completed', start: days(3), notes: 'Set menu, split billing' },
    { name: 'Rohan Mehta', email: 'rohan@email.com', phone: '+91-9876543216', title: 'Date Night Dinner', status: 'completed', start: days(1), notes: 'Quiet corner booth' },
    { name: 'Kiran Nair', email: 'kiran@email.com', phone: '+91-9876543217', title: 'Lunch Reservation', status: 'cancelled', start: days(7), notes: 'Cancelled due to travel' },
    { name: 'Gaurav Joshi', email: 'gaurav@email.com', phone: '+91-9876543218', title: 'Dinner Reservation (4 guests)', status: 'no_show', start: days(4), notes: 'No show, no answer on call' },
    { name: 'Pallavi Das', email: 'pallavi@email.com', phone: '+91-9876543219', title: 'High Tea Party', status: 'cancelled', start: days(2), notes: 'Rescheduling to next week' },
    { name: 'Sanjay Verma', email: 'sanjay@email.com', phone: '+91-9876543220', title: 'Weekend Brunch (6 guests)', status: 'scheduled', start: futureDay(1), notes: 'Outdoor seating preferred' },
    { name: 'Meera Kapoor', email: 'meera@email.com', phone: '+91-9876543221', title: 'Baby Shower Lunch (25 guests)', status: 'scheduled', start: futureDay(3), notes: 'Pink/white theme, special menu' },
    { name: 'Nitin Chopra', email: 'nitin@corp.com', phone: '+91-9876543222', title: 'Client Dinner (4 guests)', status: 'scheduled', start: futureDay(4), notes: 'Private dining room' },
    { name: 'Ritika Malhotra', email: 'ritika@email.com', phone: '+91-9876543223', title: 'Catering Consultation', status: 'scheduled', start: futureDay(5), notes: 'Wedding catering for 200 guests' },
    { name: 'Varun Iyer', email: 'varun@email.com', phone: '+91-9876543224', title: 'Dinner Reservation (2 guests)', status: 'scheduled', start: futureDay(2), notes: 'Anniversary special' },
    { name: 'Ananya Bhatt', email: 'ananya@email.com', phone: '+91-9876543225', title: 'Lunch Meeting (3 guests)', status: 'scheduled', start: futureDay(6), notes: '' },
    { name: 'Harish Pandey', email: 'harish@email.com', phone: '+91-9876543226', title: 'Family Dinner (10 guests)', status: 'scheduled', start: futureDay(7), notes: 'Birthday celebration' },
    { name: 'Swati Saxena', email: 'swati@email.com', phone: '+91-9876543227', title: 'Kitty Party Lunch (12 guests)', status: 'scheduled', start: futureDay(8), notes: 'Special cocktails needed' },
    { name: 'Pankaj Agarwal', email: 'pankaj@email.com', phone: '+91-9876543228', title: 'Engagement Party (30 guests)', status: 'scheduled', start: futureDay(10), notes: 'Full restaurant booking' },
    { name: 'Divya Kulkarni', email: 'divya@email.com', phone: '+91-9876543229', title: 'Farewell Dinner (8 guests)', status: 'scheduled', start: futureDay(12), notes: 'Surprise setup, speech mic' },
  ]
  for (const appt of appointmentData) {
    const startTime = appt.start
    const endTime = new Date(startTime.getTime() + 2 * 3600000) // 2 hours
    await sql`INSERT INTO appointments (id, workspace_id, location_id, customer_name, customer_email, customer_phone, title, status, start_time, end_time, notes, created_at, updated_at)
      VALUES (${uuid()}, ${WORKSPACE_ID}, ${locationIds[rand(0,2)]}, ${appt.name}, ${appt.email}, ${appt.phone}, ${appt.title}, ${appt.status}, ${startTime.toISOString()}, ${endTime.toISOString()}, ${appt.notes}, NOW(), NOW())`
  }
  console.log('   ✅ 20 appointments seeded')

  // ─── 27. Update connector types (email + google_calendar) ─────────────────
  console.log('🔌 Updating connector types...')
  await sql`UPDATE connector_types SET is_active = true, description = 'Connect your own SendGrid or Resend API for sending emails' WHERE id = 'email'`
  await sql`INSERT INTO connector_types (id, name, description, icon_url, auth_type, binding_level, config_schema, is_active)
    VALUES ('google_calendar', 'Google Calendar', 'Connect Google Calendar for appointment scheduling at your locations', null, 'oauth2', 'location', '{}', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true, description = EXCLUDED.description`
  console.log('   ✅ Email + Google Calendar connector types updated')

  console.log('\n' + '═'.repeat(60))
  console.log('🎉 SEED COMPLETE!')
  console.log('═'.repeat(60))
  console.log(`
📊 Summary:
   👥 Team Members:      6 (1 owner + 5 team)
   📍 Locations:         3 branches
   🔌 Connectors:        6 (Google + Zomato per location)
   👤 Customers:         120
   ⭐ Reviews:           500 (Google + Zomato)
   💬 Responses:         ${responseCount}
   🗺️ Journeys:          3 (with screens)
   📝 Journey Responses: 200
   📋 TruForms:          4 (NPS, CSAT, CES, Custom)
   📝 TruForm Responses: 150
   🎟️ Coupons:           6 templates, 80 instances
   🚨 Escalation Rules:  5
   🚨 Escalations:       35
   😊 NEV Responses:     200
   📈 CLI Responses:     150
   🔔 Notifications:     50
   ⚙️ Automations:       5 rules, 40 queue items
   🏪 Listings:          6 (Google + Zomato)
   📢 Listing Posts:     15
   💳 Billing:           Pro Plan + 3 invoices
   📄 Reports:           5 snapshots
   🎨 Social Posts:      8
   📅 Content Calendar:  30 days
   📅 Appointments:      20 (completed, upcoming, cancelled)

🔐 Login: test@example.com / password123
🌐 Dashboard: http://localhost:3000/dashboard
`)

  await sql.end()
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  sql.end()
  process.exit(1)
})
