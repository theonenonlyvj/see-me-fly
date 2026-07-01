# The see-me-fly Data-Visualization Lens

*A durable design philosophy for turning a personal flight log into a beautiful, truthful object.*
*Distilled from a council of data-viz lenses (Tufte, Lupi, Bremer, Cairo, Stefaner, and the r/dataisbeautiful populist read), 2026-06-30.*

## What this app actually is

see-me-fly is not a dashboard of totals. It is a **portrait of years of a life in motion**, built from
~1,000+ individual, tz-resolved, home-anchored events. The data's soul is **continuous time** (every
flight has an absolute instant and a home-of-that-date) and **relation** (airports are nodes, routes are
edges, trips are journeys away from a moving home). Our current vocabulary — ~ten near-identical ranked
bar lists, three copies of the per-year stacked column, two flat hour histograms — answers only *"which is
biggest?"* It almost never answers *"what shape did this life take, and how did it drift?"* That is the
whole opportunity.

## What "beautiful data" means here

Beauty in this app is **emergent structure made legible, in service of a true insight a table could not
carry.** We chase r/dataisbeautiful front-page grade — the "wait, this is ONE person's real life?"
reaction — without ever earning it through a misleading encoding.

Five principles govern every new card:

1. **Draw the flights, not the totals.** Before you aggregate into a bar, ask whether one-mark-per-flight
   (or per-trip) would reveal rhythm, drift, or texture that the bucket destroys. Density *is* the graphic.
   The richest, most-unused dimension is the absolute instant crossed with distance, duration, and the
   era-correct home. Spend it.

2. **One showstopper, many small multiples.** The gallery needs exactly one arresting hero image
   (radial/spiral/globe) that reads in a thumbnail and rewards a five-minute stare — plus dense, repeated
   small-multiple glyphs (Tufte's contact-sheet) that let the eye compare years effortlessly. Avoid a deck
   of interchangeable single-message cards.

3. **Truth is the aesthetic.** Cairo's rule: form must fit the question and never lie. Honest baselines,
   log/sqrt scales *stated in a caption*, count-honest marks (never let radial circumference or area imply
   density the data lacks), and a visible "reconstructed / estimated" flag on anything derived from trip
   inference. RouteMapV2 is our exemplar: log-scaled arcs so a dominant home hub doesn't blow out, bounded
   ~100-mile districts so Moscow lights Moscow and not all of Russia. Copy that discipline everywhere.

4. **Humanist framing over audit.** The owner is a long-haul frequent traveler with a full life on the
   ground. The most valuable cards answer questions the traveler actually lives with — *how much am I home?
   is it getting worse? how did my map of the world grow?* Negative space (time at home) does as much
   narrative work as the marks. Name real places, not counts. Let the traveler say "that is my life."

5. **Typography leads; color is vivid but restrained.** Fraunces carries titles and big numbers with real
   weight (the Odometer is the template). Inter does the honest small work. The Pop accents encode meaning —
   coral for friction/delay, indigo for the red-eye dark, lime for domestic, continent hues that stay
   consistent card-to-card — never decoration. The 6-stop hero gradient is reserved for continuous encodings
   and one hero centerpiece, not sprinkled as chrome.

## The beauty rubric (judge any new card against all five)

- **Insight-per-glance:** does the *form* reveal a real, non-obvious pattern (a trajectory, a rhythm, a
  relationship) — not just restate one number?
- **Macro + micro:** does it read from across the room AND reward zooming to a single true event?
- **Honest encoding:** every scale labeled; no area/radius lie; derived data flagged; baseline at zero
  (or an explicit ThemeRiver center).
- **One killer annotation:** exactly one leader-line that lands the punchline ("11 flights, Mar 2019";
  "42 days away, Jul–Aug 2019"). Not ten labels; one.
- **Unmistakably theirs:** could this only be *this* person's data? If it would look identical for any
  traveler, it's inventory, not a portrait.

## Anti-patterns to retire or never build

- **The horoscope.** Flight Personality's canned archetype + word-pills is maximal decoration for one
  string. Either make it data-dense or kill it.
- **The re-skinned bar.** A new topic drawn as yet another BarList / StackedColumns / ProportionBar adds a
  card, not a view. We have ten; that *is* the flatness. Consolidate.
- **The fence for a clock.** Cyclic variables (hour-of-day, day-of-year, weekday) drawn on a straight
  left-to-right axis deny their wrap-around structure. Draw them round.
- **The fake primitive.** Billing a 12-month grid as a "calendar heatmap." If we name a beloved form,
  render the real one (the 365-day day-mosaic).
- **The bucket that erases the person.** Distance bands, aircraft-class proportion bars — arbitrary bins
  that dissolve individual flights into five gray rectangles.
- **Spectacle over truth.** No 3D-for-3D's-sake, no radius-encoded-as-area, no smoothing window that hides
  a real spike. Beauty that obscures insight is a defect, full stop.

## The direction, in one sentence

Keep the honest engine and the handsome surface; take the ambition currently locked inside the two maps
and the Odometer and spend it on **continuous-time flow, polar/generative geometry, and
per-flight/per-trip small multiples** — so the deck stops *counting* this life and starts *portraying* it.
