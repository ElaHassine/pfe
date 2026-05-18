const doctors = [
  { id: 'd1', name: 'Dr. Amina Ben Ali', specialty: 'Dermatology & Skin Oncology', rating: 4.9, reviews: 247, distance: '0.8 mi', available: true, nextSlot: 'Today, 3:00 PM', consultFee: '$120' },
  { id: 'd2', name: 'Dr. Walid Trabelsi', specialty: 'Clinical Dermatology', rating: 4.7, reviews: 189, distance: '1.2 mi', available: true, nextSlot: 'Tomorrow, 10:00 AM', consultFee: '$95' },
  { id: 'd3', name: 'Dr. Leila Hammami', specialty: 'Dermatopathology', rating: 4.8, reviews: 312, distance: '2.1 mi', available: false, nextSlot: 'Thu, 2:30 PM', consultFee: '$140' },
];

const articles = [
  {
    id: 'a1',
    title: 'Understanding the ABCDE Rule',
    category: 'Detection',
    readTime: '4 min',
    color: '#00C2B2',
    summary: 'Spot early warning signs of melanoma using the ABCDE method.',
    keyTakeaways: [
      'A for Asymmetry: one half of the lesion does not match the other.',
      'B for Border: irregular, notched, or blurred edges may be concerning.',
      'C for Color: multiple shades in one lesion can indicate risk.',
      'D for Diameter: lesions larger than 6mm should be checked, but smaller ones can still be serious.',
      'E for Evolution: any recent change in size, shape, color, or symptoms matters most.',
    ],
    preventionPlan:
      'Take monthly skin photos under similar lighting, compare changes over time, and schedule a dermatologist visit when an ABCDE sign appears or progresses.',
  content: `
# Understanding the ABCDE Rule

The ABCDE rule is the gold standard for early melanoma detection. This framework helps you identify concerning lesions before they become dangerous.

## A – Asymmetry

If you draw an imaginary line through the middle of your mole, both halves should look identical. Asymmetrical moles are a red flag.

- Benign moles are symmetric and uniform
- Asymmetry suggests abnormal cell growth
- Check all sides, not just top and bottom

## B – Border

The edges of healthy moles are clean and well-defined. Irregular, scalloped, notched, or blurred borders are warning signs.

- Smooth borders indicate stability
- Jagged edges may suggest melanoma
- Look for loss of definition at the edges

## C – Color

A single, uniform color is reassuring. Multiple colors within one lesion are concerning.

- Benign: single brown or tan
- Watch out for: black, dark brown, red, white, or blue
- Rainbow pattern is especially concerning

## D – Diameter

Lesions larger than a pencil eraser (about 6mm) need professional review. However, size alone isn't the determining factor.

- Monitor growth over time with photos
- Smaller lesions can still be melanoma
- Compare to baseline photos from previous months

## E – Evolution

This is perhaps the most important factor. Any recent change is worth investigating immediately.

- Changes in size, shape, or color
- Appearance of itching or tenderness
- Bleeding or oozing
- Redness or swelling around the lesion

## What To Do Next

When you spot concerning signs, don't panic—act promptly:

1. **Document**: Take clear, dated photos
2. **Monitor**: Watch for progression
3. **Contact**: Schedule a dermatology appointment
4. **Trust**: Your instincts and professional expertise

Early detection saves lives. The five-year survival rate for Stage I melanoma exceeds 97%.
   `
  },
  {
    id: 'a2',
    title: 'Types of Skin Cancer',
    category: 'Education',
    readTime: '6 min',
    color: '#6366F1',
    summary: 'Guide to melanoma, basal cell, and squamous cell carcinoma.',
    keyTakeaways: [
      'Melanoma is less common but more aggressive and should be evaluated quickly.',
      'Basal cell carcinoma often grows slowly and may appear pearly or ulcerated.',
      'Squamous cell carcinoma can look scaly, crusted, or persistently inflamed.',
      'Early diagnosis significantly improves treatment outcomes across all types.',
      'Biopsy is the standard method to confirm diagnosis and guide treatment.',
    ],
    preventionPlan:
      'Protect high-exposure areas daily, avoid tanning beds, and arrange routine skin checks if you have fair skin, many moles, family history, or previous skin cancer.',
  content: `
# Types of Skin Cancer: What You Need to Know

Skin cancer is the most common cancer in the United States. Understanding the three main types helps you identify them early and seek appropriate care.

## Melanoma: The Aggressive Type

**What It Is:**
Melanoma develops in melanocytes—the cells that produce skin pigment. Though it represents only 1% of skin cancers, it accounts for most skin cancer deaths.

**Early Signs:**
- **Asymmetry**: One half doesn't match the other
- **Irregular border**: Jagged or notched edges
- **Multiple colors**: Brown, black, red, white, or blue
- **Larger diameter**: Greater than 6mm (pencil eraser)
- **Evolution**: Recent rapid changes

**Risk Factors:**
- Fair skin and light eyes
- Many or unusual moles (>50)
- Family or personal history of melanoma
- Severe sunburns, especially in childhood
- Excessive sun exposure or tanning bed use
- Weakened immune system

**Treatment Options:**
- Surgical excision for early-stage
- Lymph node biopsy if deeper involvement
- Immunotherapy or targeted therapy for advanced disease
- Excellent prognosis if caught early (>97% five-year survival for Stage I)

## Basal Cell Carcinoma: The Common One

**What It Is:**
Basal cell carcinoma (BCC) originates in the basal cells at the base of the epidermis. It's the most common skin cancer but rarely spreads beyond the skin.

**Appearance:**
- Waxy, translucent bump (often with blood vessels visible)
- Pearly appearance with rolled edges
- Ulceration or central depression ("rodent ulcer")
- Sometimes appears as a scaly, flat patch
- Slow growth; may bleed with minor trauma

**Risk Factors:**
- Cumulative sun exposure
- Fair skin
- Advanced age
- Previous skin cancer
- Chronic sun exposure in occupations (construction, farming)

**Treatment Options:**
- Surgical excision: gold standard
- Mohs micrographic surgery: tissue-sparing precision
- Cryotherapy: freezing with liquid nitrogen
- Topical treatments: 5-FU or imiquimod for small lesions
- Cure rates: 95–99% with appropriate treatment

## Squamous Cell Carcinoma: The Scaly One

**What It Is:**
Squamous cell carcinoma (SCC) arises from squamous cells in the outer epidermis. It grows faster than BCC but still has excellent prognosis if caught early.

**Appearance:**
- Scaly, crusted bump or patch
- Red, inflamed, or tender area
- Wart-like growth
- Ulceration with bleeding
- Often appears on sun-exposed areas (face, ears, neck, hands)

**Risk Factors:**
- Cumulative sun exposure (strongest predictor)
- Fair skin
- Immunosuppression
- Chronic wounds or scars
- History of actinic keratosis (precancerous lesions)

**Treatment Options:**
- Surgical excision: standard approach
- Mohs surgery: for high-risk areas or large lesions
- Cryotherapy: for thin lesions
- Radiation: for elderly or medically frail patients
- Cure rates: 90–95% with appropriate treatment

## Non-Melanoma Skin Cancers (NMSC)

Together, BCC and SCC are called non-melanoma skin cancers. They share these characteristics:

- **Very common**: Over 5 million diagnosed annually in the U.S.
- **Slow growth**: Develop over months to years
- **Excellent prognosis**: 95%+ five-year survival with early treatment
- **Rarely fatal**: Spread is uncommon
- **Preventable**: Sun protection significantly reduces risk

## When To See A Dermatologist

Seek professional evaluation immediately for:

- Any lesion changing in size, shape, or color
- Bleeding, itching, or painful lesion
- Lesion not healing after 3 weeks
- New lesion appearing after age 25
- Unusual or concerning mole
- Multiple or atypical lesions

Early detection is key to excellent outcomes across all skin cancer types.
   `
  },
  {
    id: 'a3',
    title: 'Sun Protection Guide',
    category: 'Prevention',
    readTime: '3 min',
    color: '#F59E0B',
    summary: 'Evidence-based strategies to protect your skin year-round.',
    keyTakeaways: [
      'Use broad-spectrum SPF 30+ every day, not only on sunny days.',
      'Reapply sunscreen every 2 hours and after sweating or swimming.',
      'Wear UV-protective clothing, hats, and sunglasses for added defense.',
      'Seek shade between 10 a.m. and 4 p.m. when UV radiation peaks.',
      'Children and sensitive skin types need stricter UV protection routines.',
    ],
    preventionPlan:
      'Build a daily routine: apply sunscreen in the morning, carry a travel-size reapplication option, and combine SPF with shade and protective clothing.',
   content: `
# Sun Protection Guide: Your Year-Round Shield

Sun protection is the most effective strategy to prevent skin cancer, photoaging, and sun damage. Here's your evidence-based guide to protecting your skin every single day.

## Understanding UV Rays

**UVA Rays** (Aging Rays)
- Penetrate deep into skin
- Present year-round, all day long
- Primary cause of wrinkles and age spots
- Partially blocked by window glass

**UVB Rays** (Burning Rays)
- Cause sunburn and inflammation
- Vary by season and time of day
- Blocked by window glass
- Primary driver of skin cancer risk

Both types cause DNA damage and increase melanoma risk.

## Daily Sunscreen Protocol

**Choose the Right Sunscreen:**
- **Broad-spectrum**: Protects against both UVA and UVB
- **SPF 30 minimum**: Blocks 97% of UVB rays
- **SPF 50**: Blocks 98% (marginal improvement, but adds margin for human error)
- **Water-resistant**: If swimming or sweating

**Application Amount:**
- Face and neck: ¼ teaspoon (about a marble-sized dollop)
- Full body: About 1 ounce (shot glass full)
- Most people apply half the recommended amount—use more

**Timing:**
- Apply 15 minutes before sun exposure (chemical sunscreen)
- Reapply every 2 hours
- Reapply immediately after swimming or heavy sweating

## Physical Barriers: Your Multi-Layer Defense

**Protective Clothing:**
- UPF (Ultraviolet Protection Factor) 50+ rated
- Lightweight, breathable fabrics
- Long sleeves and pants for extended outdoor time
- Swim shirts for water activities

**Hats:**
- Wide-brimmed (minimum 3-inch brim all around)
- Protects face, ears, and back of neck
- Baseball caps offer minimal protection

**Sunglasses:**
- Block 99–100% of UVA and UVB
- Protect eyes and delicate skin around eyes
- Look for UV 400 rating or 100% UV protection

**Shade:**
- Most effective barrier when available
- Umbrellas reduce sun exposure by 50–75%
- Trees provide partial but significant protection

## Peak Sun Hours Strategy

**10 a.m. to 4 p.m. = Peak UV**
- UV index is strongest
- Plan outdoor activities outside these hours
- If you must be out, combine all barriers:
  - SPF 50+ reapplied every 2 hours
  - Protective clothing and hat
  - Sunglasses
  - Seek shade whenever possible

## Special Populations

**Children (Under 6 months):**
- Avoid direct sun exposure
- Keep in shade or use protective clothing
- Sunscreen not recommended; consult pediatrician

**Children (6 months to 18 years):**
- SPF 30+ daily, 365 days
- Protective clothing encouraged
- Sunscreen as "last line" after clothing and shade
- Childhood sun exposure sets lifetime risk

**Pregnant Women:**
- Avoid oxybenzone and octinoxate
- Choose mineral sunscreen (zinc oxide, titanium dioxide)
- Stay extra cautious; melasma (dark patches) risks increase

**People with Dark Skin:**
- Still vulnerable to sun damage and skin cancer
- UV protection remains essential
- Higher rates of SCC on hands and feet

## Antioxidant Reinforcement

Even with perfect sunscreen use, some UV exposure occurs. Boost your defense:

- **Vitamin C serum**: Neutralizes free radicals
- **Vitamin E**: In sunscreens and moisturizers
- **Green tea extract**: Polyphenols reduce inflammation
- **Ferulic acid**: Enhances vitamin C efficacy

## Common Misconceptions

**"I only need sunscreen on sunny days"** 
→ UVA penetrates clouds. Use SPF daily.

**"SPF 50 lasts twice as long as SPF 30"** 
→ SPF measures protection level, not duration. Reapply every 2 hours regardless.

**"Tanning beds are safer than the sun"** 
→ No. Tanning beds emit concentrated UVA, increasing melanoma risk by 15–20%.

**"I'll get vitamin D deficiency without sun"** 
→ Diet, supplements, and minimal incidental sun provide adequate vitamin D. Prioritize skin health.

## Year-Round Schedule

**Spring & Summer (March–August):**
- SPF 50+ daily
- Reapply every 2 hours outdoors
- Protective clothing for extended exposure
- Peak hours: strictly limit time 10 a.m.–4 p.m.

**Fall & Winter (September–February):**
- SPF 30+ daily (UVA still present)
- Indoor near windows: SPF 30+ moisturizer
- Outdoor recreation: treat like spring/summer
- Shorter days ≠ less protection needed

## Benefits of Consistent Sun Protection

People with rigorous SPF practices show:

- **40–50% reduction** in squamous cell carcinoma
- **50–73% reduction** in melanoma
- **Dramatically fewer** wrinkles and age spots
- **More youthful skin** in their 60s and beyond

Start today. Your future skin depends on it.
    `
  },
  {
    id: 'a4',
    title: 'Common Benign Lesions',
    category: 'Reference',
    readTime: '5 min',
    color: '#00C48C',
    summary: 'Identifying moles, keratosis, and non-cancerous growths.',
    keyTakeaways: [
      'Many lesions are benign, including seborrheic keratoses and skin tags.',
      'Benign moles are often symmetric, uniform in color, and stable over time.',
      'Inflamed benign lesions can temporarily mimic warning signs.',
      'Persistent change, bleeding, or itching should still be assessed clinically.',
      'When uncertain, dermoscopy and professional review provide safer clarification.',
    ],
    preventionPlan:
      'Track baseline lesions with photos and note any persistent changes over several weeks; seek medical review rather than self-diagnosing uncertain lesions.',
  content: `
# Common Benign Lesions: What's Normal and What's Not

Not every skin lesion is cancer. In fact, most are completely benign. Learning to distinguish common benign growths helps you focus on truly concerning changes.

## Common Benign Moles (Nevi)

**Intradermal Nevi (Most Common)**
- Raised, flesh-colored to brown bumps
- Symmetric, uniform color
- Stable size over years
- Often found on face, trunk, extremities
- No cancer risk if unchanged

**Junctional Nevi**
- Flat to slightly raised
- Usually brown or tan
- Found at dermis-epidermis junction
- Typically appear in youth
- May darken slightly with sun exposure

**Compound Nevi**
- Raised bumps with darker center
- Transitional between intradermal and junctional
- Stable growth pattern
- Very low malignancy risk

**Key Characteristics of Benign Moles:**
✓ Symmetric (even if slightly different shades)
✓ Uniform color (typically single shade)
✓ Stable size over months/years
✓ Well-defined border
✓ Smooth texture

## Seborrheic Keratosis: The Common Bump

**What It Is:**
A very common, benign skin growth that appears with age. More than 80% of older adults have at least one.

**Appearance:**
- Waxy, scaly, slightly raised bump
- Brown, black, or tan
- "Stuck on" appearance
- Easily distinguished by rough texture
- Vary in size from 2mm to 2cm

**Key Features:**
- Symmetric and stable
- Well-demarcated borders
- No color variation beyond uniform brown/black
- Smooth or slightly waxy texture

**When to Treat:**
- Cosmetic concerns
- Irritation from clothing
- Bleeding or infection
- Usually removed for confidence

**Removal Options:**
- Cryotherapy (freezing)
- Curettage (scraping)
- Laser therapy
- Chemical peel for multiple lesions

## Skin Tags (Acrochordons)

**What They Are:**
Small, soft, flesh-colored growths hanging from the skin. Very common, especially in skin folds.

**Typical Locations:**
- Neck
- Armpits
- Groin
- Eyelids
- Under breasts

**Characteristics:**
- Pedunculated (hanging from stalk)
- Flesh-colored or slightly darker
- Soft and moveable
- Entirely benign; zero cancer risk

**Associated With:**
- Obesity
- Insulin resistance
- Pregnancy (hormonal changes)
- Friction in skin folds
- Hereditary tendency

**Removal:**
- Ligation (tying off blood supply)
- Cryotherapy
- Scissors removal
- Cauterization
- Cosmetic choice only

## Hemangiomas: Red Spots

**What They Are:**
Benign collections of blood vessels forming red or purple spots.

**Common Types:**
- **Campbell de Morgan spots**: Small red dots on trunk
- **Cherry hemangiomas**: Bright red, 2–5mm bumps
- **Cavernous hemangiomas**: Larger, deeper purple areas
- All are benign

**When They Appear:**
- Increase with age
- May appear suddenly
- Influenced by genetics
- Not related to sun exposure

**Should You Worry:**
No. These are completely benign. Remove if they bleed frequently or you dislike them cosmetically.

## Lentigines: Harmless Spots

**What They Are:**
Flat, brown spots caused by concentrated melanin. Two types:

**Solar Lentigines (Age Spots):**
- Result from sun exposure
- More common on face, hands, arms
- Flat, brown, 1–3cm
- Benign but cosmetically bothersome
- Can be lightened with hydroquinone or laser

**Junctional Lentigines:**
- Genetic or drug-related
- Uniform brown color
- Benign, don't require treatment

## Dermatofibromas: Firm Nodules

**What They Are:**
Small, firm bumps in the dermis layer. Extremely common and benign.

**Characteristics:**
- Firm, raised bump (3–15mm)
- Brown, red, or skin-colored
- Indented center ("dimple" sign)
- Slow or no growth
- May itch or be slightly tender

**Cause:**
- Likely reaction to minor trauma or insect bite
- Not cancerous; won't progress

**Treatment:**
- None needed (benign)
- Can be surgically removed if cosmetically bothersome

## When To Distinguish From Melanoma

A benign lesion typically shows:

✓ **No change** over months/years (except lentigines which change slowly with sun exposure)
✓ **Symmetric appearance**
✓ **Uniform color** (single shade or gradual gradient)
✓ **Well-defined border**
✓ **Consistent texture**
✓ **No bleeding, itching, or tenderness**

A concerning lesion shows:

⚠ **Recent rapid change**
⚠ **Asymmetry**
⚠ **Multiple colors** (especially red, white, or blue in a melanoma)
⚠ **Irregular, blurred border**
⚠ **Bleeding, oozing, itching,** or **pain**

## Professional Assessment

When in doubt, **always seek dermatologic evaluation**. Dermoscopy (specialized magnification) can definitively distinguish benign from concerning lesions.

Most lesions are benign, but professional confirmation offers peace of mind and ensures nothing is missed.
   `
  }
];

module.exports = { doctors, articles };
