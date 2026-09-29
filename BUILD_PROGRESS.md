# Build Progress Log

## Project
`C:\Users\Shakeel\Desktop\New folder (2)` — Grade 9 Smart Study (textbook-grounded AI study engine)

## Environment facts (verified)
- Node v24.20.0, npm 11.19.0 (`npm.cmd` — PowerShell blocks `npm.ps1`), Python 3.12.10
- **git is NOT installed** on this machine
- Network to npm registry works
- `pdfjs-dist` rendering crashes the heap → OCR must use `mupdf` + `tesseract.js`

## Books (8 PDFs, 1,614 pages, all in `books/`)
| id | file | pages | conf | chapters (reliable) | topics | printed | status |
|---|---|---|---|---|---|---|---|
| biology-9 | Biology-9.pdf | 168 | 92 | 10 (9) | 115 | 4 | OK |
| chemistry-9 | Chemistry-9.pdf | 258 | 89 | 19 (14) | 176 | 80 | OK |
| english-9 | English-9.pdf | 168 | 90 | 1 (0) | 1 | 17 | OK, contents unreadable |
| mathematics-9 | Mathematics-9.pdf | 296 | 79 | 11 (11) | 72 | 67 | OK |
| physics-9 | Physics-9.pdf | 221 | 90 | 1 (0) | 252 | 0 | OK, contents unreadable |
| islamiat-9 | Islamiat-9.pdf | 116 | 44 | 1 (0) | 1 | 0 | LOW |
| urdu-9 | Urdu-9.pdf | 130 | 44 | 1 (0) | 1 | 0 | LOW |
| mutalia-quran-9 | Mutalia Quran-9.pdf | 257 | 51 | 1 (0) | 1 | 0 | LOW |

Totals: 45 chapters, 693 topics.

`RELIABILITY_THRESHOLD = 70`. Islamiat/Urdu (Nastaliq) and Mutalia Quran (Arabic)
fall below it: their contents pages are unreadable, so they are deliberately
exposed as a single un-chaptered "full book" entry with a visible warning
rather than being given fabricated structure.

### Chapter-structure integrity gate
Two integrity bugs were found and fixed after the first full ingest:

1. **Fabricated chapters.** The bare-number heading detector matched numbered
   *exercise* lines, not just chapter headings. Grade 9 Physics ended up with 17
   "chapters", 16 of them one-page fragments of exercise text, and English with 16
   similar fabrications. Every AI question was then attributed to a chapter that
   does not exist. `buildChapters` now only trusts chapters found via running
   headers, and only if they cover >=50% of the book; otherwise it returns a single
   `Full book` chapter flagged `structureReliable: false`.
2. **Sentences as chapter names.** Mis-aligned contents rows promoted body text
   into titles, e.g. Physics ch2 was named
   *"If the digits to the right are less than 5, treat them as zero."* and English
   ch1 *"Hazrat Muhammad Rasulullah ((8%):| SDG-Mil"*. `isPlausibleChapterTitle`
   now rejects sentence-like names and those are renamed; the repairs are recorded
   in the book's notes so they stay auditable.

English and Physics have clean OCR (90) but their contents pages did not survive
scanning: Physics p4 OCRs to 31 characters at 38% confidence even when re-run
(`--reocr-below`), and English p4 is a 4-column table whose numbering is mangled.
Both are reported honestly as one `Full book` chapter with an explanatory notice in
the UI. Their page text, search, Ask AI and question generation all still work.

### Harvested printed questions
`extractReviewQuestions` now requires a harvested line to look like an actual
question (interrogative/asking verb, not a banner, not symbol soup). This removed
page furniture that was previously counted as questions: total printed questions
dropped 294 -> 168, e.g. Chemistry 127 -> 80, Mathematics 125 -> 67. Harvested
items are reference-only (`correctIndex: null`) and are not served in Practice.


## Done
- Ingestion pipeline: sha256 → OCR → TOC/chapters → topics → SLOs → printed
  questions → chunk index. **Resumable**: per-page JSON is checkpointed, so a
  killed run continues instead of redoing hours of OCR.
- `--restructure` re-derives structure from cached page text with no OCR.
- Front-matter extraction reads real title/publisher/year/edition/curriculum/
  authors from each book instead of the filename (e.g. Biology resolves to
  "Model Textbook of Biology for Grade 9", Jawaid Mohsin Malik et al.).
- Grounded question engine: retrieve → generate → strict schema → dedupe →
  store, with per-item rejection reporting and `lowConfidenceSource` flags.
- Providers: OpenCode Zen, Gemini, Ollama. `pickProvider` never auto-selects
  Ollama. The app stays up and fails loudly when no key is configured.
- Backend API (Express 5) + static serving of the built frontend.
- Frontend: Library, Book/Chapter browser, source-page viewer, AI generation,
  Smart Practice, Revision Mode, Random 20, Ask AI, Progress, weak topics,
  localStorage persistence, RTL + dark mode.
- 125 tests passing across 5 files; `tsc --noEmit` clean; `vite build` clean.
- `scripts/seed-questions.ts`: resumable background pool builder. Walks
  chapters round-robin across the reliable books, skips chapters that already
  have questions, stores each batch as it lands, and defaults to skipping the
  low-confidence books. Run: `npx tsx scripts/seed-questions.ts --per-chapter 3`
- `scripts/repair-question-chapters.ts`: relabels stored questions whose chapter
  name predates the integrity gate, using the chapter number in `sourceTextId`.
- `scripts/ingest-books.ts --reocr-below <n>`: re-OCR only pages whose stored
  confidence is below `n`, instead of re-running a whole book.

## AI provider status
`.env` is configured with an OpenCode Zen key. Verified working:

- `/api/chat` "What is the function of ribosomes?" → answered from Biology
  ch3 pp37-46 with a page citation.
- `/api/generate` Biology "The Science of Biology" count 4 → 4 stored, 0 rejected.

Three provider bugs were fixed to make this work:
1. **Silent empty answers.** `space-bunny-free` is a reasoning model: it spent the
   whole 3000-token budget thinking and returned `finish_reason: length` with no
   content, which surfaced as "empty response". The provider now detects this and
   retries with a larger budget (`backend/providers/opencode-zen.ts`).
2. **Timeout too short.** It needs ~75-190s per call; raised to 300s
   (`OPENCODE_TIMEOUT_MS`).
3. **Chat scoped to the wrong chapter.** `chat.ts` defaulted to
   `book.chapters[0]` and the UI defaulted the chapter picker to chapter 1, so a
   question about a later topic was answered from the first chapter. Both now
   default to whole-book scope.

Only `space-bunny-free` is enabled for this key; every other tested model returns
HTTP 403 `Model access is disabled`. That is an account setting, not a bug.

## Verified by running the real server
- `GET /api/health` → 8 books, questions growing from the seeder, opencode-zen ready
- `GET /api/library` → 8 subjects with real titles, page counts, printed-question counts
- `GET /api/books/biology-9/pages?pages=44` → real text ("Mitochondria are double membrane organelles...")
- `POST /api/practice` smart mode for biology/chemistry/physics/english → serves real questions
- `POST /api/chat` and `POST /api/generate` → real grounded output with page citations
- Real headless Edge render of `/`, `/#/book/biology-9`, `/#/book/physics-9`,
  `/#/practice`, `/#/progress` — the "chapter list could not be read" notice shows
  for Physics and correctly does not show for Biology.

## Grounding / retrieval fixes (latest)

The chatbot used to answer confidently from pages that had nothing to do with the
question. Two root causes, both fixed and covered by `tests/grounding.test.ts`:

1. **Retrieval fell back to the book's opening pages when nothing matched.**
   `retrieve()` returned the first N chunks of the range, so a microbiology
   question was answered from Biology pages 6-9. The model then invented a
   "closest related idea" to justify them. `fallbackToRangeStart` is now opt-in:
   chat passes `false` and gets an empty result, question generation keeps the
   old behaviour because it needs *some* context.
2. **Common words counted the same as rare ones.** "law of conservation of mass"
   matched any Biology page containing the word "mass". Scoring is now weighted
   by inverse chunk frequency (IDF), so rare terms ("ribosomes") must carry the
   match and common ones cannot.

Chat also short-circuits when retrieval is empty, returning `notCovered: true`
with `sources: []` **without calling the model**. An out-of-scope question is now
instant instead of a 90+ second generation.

Pure grounding helpers (`NOT_COVERED`, `actionFor`, `citedPages`) moved to
`backend/chat/grounding.ts` so they can be unit tested without loading the
provider chain. `tests/setup.ts` now tolerates node-environment test files.

### Verified against the running server

| Question (Biology) | Result |
| --- | --- |
| "What is science?" | Answered from p. 6, cited, 4s |
| "Explain the scientific method" | 6 steps + malaria example, pp. 10-13, 13s |
| "Summarize the microbiology unit" | `notCovered`, no sources, 4s |
| "law of conservation of mass" | `notCovered`, no sources, 0s (no model call) |

Note: "microbiology" *does* match three real pages (p. 6, 16, 161 - the book
names the discipline in passing) but there is no microbiology **unit**, so the
model correctly declines. Keyword presence is not coverage; the prompt is what
resolves that case.

## Chemistry 9 curated topic map (latest)

The Chemistry syllabus topics were applied from `data/topic-maps/chemistry-9.json`
via `scripts/apply-topic-map.ts`. The book now has **19 chapters / 165 topics**,
each with an OCR-derived `pageStart`/`pageEnd`:

- The script searches the **whole chapter** and orders topics by real page.
- The first topic of a chapter may start anywhere; every later topic starts at
  least one page after the previous one, or after an explicit `after` floor.
- Book section headings win over syllabus wording, then a fuzzy OCR match.
- Chapter ids stay `chemistry-9-chN`, and stored questions still resolve.
- Index: 253 chunks, 235 topic-tagged. The 18 untagged chunks are the per-unit
  SLO pages in front of each first topic.

Retrieval treats a topic as matching a chunk when their **page ranges overlap**,
which keeps the shared-page and nested topics of units 16-19 reachable. Ranking
adds an opening-position bonus so a definition on p.6 beats a passing mention on
the unit opener.

### Question bank repaired against the map

Questions store their scope as *text*, so re-scoping the map silently orphaned
them. `scripts/repair-chem-questions.ts` re-derives `chapter` and `topic` from
`sourcePages`, the only link to the OCR that cannot drift. It fixed:

- 2 corrected chapter titles (`Stoichiometery`, `Acids, Bases, and Salts`).
- 29 topics whose names predate the map.
- 3 questions quoted from p.6 but filed under chapter `Matter` (p.15-26) - a
  real mis-attribution from the old extractor, not just a rename.
- 7 questions on a chapter's SLO page, which belongs to no topic; they take the
  chapter's first topic. `tests/chem-map.test.ts` now asserts the page/chapter
  and page/topic agree for every stored question.

### Concurrent writes could delete questions

`generateQuestions` read the bank, then spent 40-300s in a model call, then
overwrote the file. Anything the seeder added in that window was discarded - and
the reverse, which is how the three p.101 `Mole` questions were lost mid-session.
`mergeQuestions` (`backend/questions/merge.ts`) now re-reads at write time and
keeps ids it did not write. Both the server and `seed-questions.ts` go through
this path. Covered by two tests in `tests/chem-map.test.ts`.

Note: `/api/generate` returns `{ ok, report, cache }`; counts live under
`report`, not at the top level.

### Topic-scoped search was broken outside Chemistry, and ignored in chat

Two bugs that made the subtopic map look like it worked everywhere:

1. **Only Chemistry's index had topic tags.** The other 7 books had 0 tagged
   chunks despite holding 115 (Biology), 72 (Math) and 252 (Physics) topics, so
   picking a subtopic returned nothing and failed silently. `scripts/rebuild-indexes.ts`
   re-chunks already-OCR'd pages from the chapters in `books.json` - it never
   re-detects chapters, so unlike `ingest-books.ts --restructure` it cannot throw
   away the curated map. All 808 topics across the 8 books are now reachable.
2. **Chat ignored the subtopic it had just resolved.** `chat.ts` resolved
   `ctx.topic` for the prompt but passed only `chapterId` to `retrieve()`, so a
   chapter-scoped question was answered from anywhere in the unit. It also
   defaulted to `chapter.topics[0]` when no topic was chosen, labelling the reply
   with a subtopic the student never asked about.

A third, quieter one: `chunkPages` flushed at every page boundary, so a topic
spanning p.101-107 became 7 chunks instead of filling `targetChars`, and the
overlap tail was thrown away. That had silently dropped ~25k characters of
Chemistry text. The flush was also useless for its stated purpose (letting a
second subtopic on the same page own its text) - `ownerOf()` returns the first
matching topic for a page, so the second never becomes owner either way. Removed;
shared and nested topics are handled by page-overlap at retrieval time.

### What a chat reply is now labelled as

The UI derived the caption from `grounded === false`, which made "I am your study
assistant" appear as *General knowledge, not from Chemistry*. The API now returns
`mode`: `grounded` | `general` | `meta` | `social` | `not-covered`, and only
`general` gets that caption. `toRetrieved` also fills `chapter`/`topic`, which
`RetrievedChunk` declared but never populated, so citations can name the subtopic.

Chat input is normalised before intent matching (`u`->`you`, `ur`->`your`,
`r`->`are`, ...), so "what are u made for" is answered as a question about the
assistant instead of searching the textbook.

## Remaining known issues
- **Semantic duplicate questions.** Three Chemistry questions on page 5 ask for
  the same definition with the same correct answer but different wording. Dedupe
  is by question text only and needs an answer-aware key.
- **`g9ss.knownQuestions`** is read as an offline fallback but still empty.
- **English / Physics** OCR averages ~90% but their contents pages are unusable,
  so both stay a single honest `Full book` chapter. Recovery needs page-specific
  OCR at higher DPI or a different PSM, not a looser parser.
- **Urdu / Islamiat / Mutalia Quran** remain low confidence (44-51%).
- **Provider**: only `space-bunny-free` is enabled; other Zen models return HTTP
  403 `Model access is disabled`. Generations take 40-300s and are **not
  deterministic**: the same question sometimes returns a grounded answer and
  sometimes `not covered`, and 529 `Endpoint is unavailable` is common. Retry
  before treating a single reply as a regression.
- **Biology / Math / Physics topic names** are raw extracted headings, so they mix
  cases and wording ("INTRODUCTION TO BIOLOGY", "Definition of Biology"). Only
  Chemistry has a curated syllabus naming.
- **Rotate the OpenCode key** pasted into chat; it is gitignored in `.env` but
  should be treated as compromised.

## Verification state
- `tsc --noEmit` clean.
- 167 tests pass across 7 files.
- `vite build` clean, no PDFs in `dist/`.
- Server restarted on port 8787; Chemistry book reports 19 chapters / 165 topics.
- `Mole` (Stoichiometry) generation verified live: context page 101 only, 6
  questions stored, every quote traced to p.101.
- Topic-scoped Biology chat verified live (`Cell` / `Structure of cell`): sources
  are inside p.32-49 and labelled with the subtopic.
- All four reply modes verified live: grounded, general, meta, social.

## Next steps
1. Do **not** run `seed-questions.ts` and generate from the UI at the same time.
   The write race is fixed, but both still cost a model call per batch, and the
   bank will fill faster from a single writer.
2. Recover the English and Physics chapter lists. Both need a better contents-page
   read, not a looser parser: Physics p4 OCRs to 31 chars at 38% confidence even
   when re-run, and English p4 is a 4-column table whose numbering is mangled.
   A page-specific OCR pass (higher DPI, different PSM) is the honest next attempt.
3. Decide whether to improve Arabic/Nastaliq OCR (ara/urd tessdata) or accept the
   low-confidence single-chapter fallback.
4. Browser-only offline practice is still incomplete: nothing populates the
   `g9ss.knownQuestions` localStorage fallback.
5. Consider extending each chapter's first topic back over its SLO page, so the
   18 SLO pages carry the lesson's learning outcomes as retrievable text. The
   repair currently points SLO-sourced questions at the first topic instead.
6. Biology, Math and Physics now have working subtopic search, but their topic
   names are raw extracted headings. Curating them the way Chemistry was would
   make the topic picker readable and consistent across books.

## Rules the user set (must not violate)
- Never invent textbook content; mark unextractable items as unavailable with page refs
- No fake placeholder books/questions
- No "everything works" claims without real test output
- API keys never in frontend; no PDFs in published frontend
- Filter → then shuffle → then select
- Answer must be selectable (the old MCQ bug) and A/B/C/D all actually tested

## Study assistant phase (persistent, conversational, knows the student)

The assistant is no longer a book search box. It answers anything, and uses the
student's own data where the data is real.

### What was added
- `backend/memory/student.ts` - persistent profile (`data/student/profile.json`)
  and an append-only attempt log (`data/student/attempts.jsonl`). Every answer
  keeps the option the student actually chose, the correct one, the page, and the
  book explanation. Derivations (last wrong answer, weak topics, per-subject
  progress) are computed from those records - nothing is guessed.
- `backend/chat/conversations.ts` - persistent conversations
  (`data/chat/conversations/*.json`): create, list, open, rename, delete, auto
  title, and a truthful summary built from the questions actually asked. The
  summary is how context survives a day without a model call.
- `grounding.ts` - `classifyMemory` (mistake / recent / weak / progress /
  profile), `buildMemoryContext` (only the note the question asked for, so the
  record is never dumped wholesale), `asksForOutline`, `bookOutline`,
  `resolveTopicAcross`, `isFollowUp`, `looksNotCovered`.
- `chat.ts` - `bookId` is now optional. No book chosen = a general assistant
  that still grounds itself when the question clearly names a subtopic of one of
  the student's books. Outline questions ("what's in chapter 6?") are answered
  from the book's own contents instead of page excerpts. Memory is injected only
  when asked. `CHAT_TEMPERATURE` / `CHAT_MAX_TOKENS` are configurable.
- `server.ts` - conversation REST (`/api/chat/conversations...`),
  `/api/student/profile` GET+POST, `POST /api/attempts`, a small per-IP rate
  limit on the AI endpoints, security headers, and a loopback bind by default
  (`HOST=0.0.0.0` to opt into LAN access). AI keys stay server-side.
- Frontend - a persistent chat with a conversation sidebar (new, open, rename,
  delete, search), quick actions (Explain / Worked example / Quiz me / 5 MCQs /
  Why was I wrong? / My weak topics / How am I doing?), clickable page chips that
  open the book, copy and retry, and a safe markdown-lite renderer. Practice now
  records every attempt and deep-links "Ask AI why I got this wrong" to the
  assistant. The Progress page gained a student profile form.
- `.gitignore` - `data/student/` and `data/chat/` are private student records.

### Two bugs found while testing the flows
- **"give me another example" answered "not covered."** A follow-up has no
  searchable words, so it searched the whole book, matched nothing, fell back to
  chapter 1, and the model bailed. Fixed two ways: a follow-up keeps the scope of
  the last cited answer, and an unscoped question no longer falls back to a
  chapter's opening pages at all.
- **A lowercase "not covered" was stored as the answer.** Only the exact
  instructed sentence was being checked, so the student could see a one-word
  reply. `looksNotCovered` now recognises the plain phrasings too.

### Verification state (this phase)
- `tsc --noEmit` clean; **208 tests pass** across 9 files (was 167).
- `vite build` clean, no PDFs in `dist/`.
- Live, against the real provider: "why was I wrong" explained the actual
  recorded attempt (12 g of carbon, chose "12 moles", p.101) with no invention;
  "explain the mole" with no book chosen grounded itself to Chemistry p.101;
  "list the topics in chapter 6" answered from the contents with page numbers;
  "capital of Japan" answered as general knowledge in 1s with no citation;
  "according to the book, what is the capital of Japan" returned the honest
  not-covered line plus the chapter list; "give me another example" continued the
  mole example on p.101.

## Next steps
1. The chemistry question bank is still small (51 questions). Single writer only.
2. English/Physics contents pages and Arabic/Nastaliq OCR are unchanged; see above.
3. `g9ss.knownQuestions` offline practice fallback is still unpopulated.
4. SLO pages still have no topic of their own.
5. Biology/Math/Physics topic names are still raw extracted headings.
6. No multi-user story: profile, attempts and conversations are one local student.
   Anything shared with a real provider is the minimum context needed for the
   question - never the whole history.

## Mixed sets: bank first, AI fills the rest in the background

The bank was the only source of MCQs, and it is thin (51 Chemistry, 109 total).
A practice set is now served from the bank immediately and the shortfall is
written by the AI in the background, joining the running test as it lands.

- `backend/practice/topup.ts` - plans where the missing questions come from,
  runs them, and hands them out. `planTopUp` is pure and tested.
- The plan fills the chapters with the **least** material, never writes for a
  book the app cannot read reliably (a question written from unreadable text is
  an invented question), and stays inside the chapter/topic the student chose.
- `POST /api/practice` returns `topUp` when there is a shortfall;
  `GET /api/practice/topup?id=...` is polled every 5s by the practice page.
- New questions are written into the bank, so the next set of that scope starts
  instantly and a question the student got wrong is still there to revise.

### A bug worth remembering
The first version only delivered questions when `generateQuestions` *returned*.
The provider routinely outlives that expectation, so a set could sit on "AI
writing more" for hours with questions already saved and usable. Fixed by
watching the bank for new ids while the call runs, plus a hard deadline
(`TOPUP_MAX_MS`, default 8 min) so a job can never stay pending forever. The
frontend stops polling when the job finalises.

### Verified live
`Matter` (a chapter with zero questions): set served in 0.09s with an honest
shortfall, 4 questions written from pp.16-17 with quotes, delivered mid-session,
bank 51 -> 55.

## Content rendering and typography

The AI writes markdown and LaTeX, and both were reaching the screen as raw
source. Now every AI string goes through one safe renderer.

- `frontend/src/lib/render.ts` - the renderer. Text is **escaped first**, then
  markup is generated from it, so a reply can never inject HTML. Order matters
  and each step protects its output from the next:
  1. code spans and fenced blocks (left exactly as written)
  2. maths: `$$..$$`, `\[..\]`, `\(..\)`, `$..$`, plus bare `\frac` / `\sqrt`
  3. scientific notation: `H_2O`, `SO_4^{2-}`, `Na^+`, `C_6H_12O_6`, `(SO_4)_3`
     and LaTeX symbols (`\rightarrow` -> real arrow, etc.)
  4. markdown: headings, bold, italic, lists, quotes, rules, links, code
- Maths is typeset with **KaTeX** (`trust: false`, `output: 'html'`). The
  `html` output matters: the default also embeds the original TeX in a MathML
  annotation, which would have left the source in the page.
- `frontend/src/components/RichText.tsx` - the React wrapper. `inline` mode
  emits no block elements, because a `<p>` inside a `<button>` (an answer
  option) is invalid HTML and browsers reparent it.
- Used for chat replies, MCQ questions, options, explanations and source
  quotes. Question-bank logic and AI behaviour were not touched.
- Typography: a system UI font stack, 1.65 body line height, real heading
  hierarchy, visibly bolder `<strong>`, aligned sub/superscripts, and spacing
  between paragraphs, lists and equations. Maths keeps KaTeX's own serif fonts
  via `--font-math`, so it never falls back to the UI font.

### Verification
- 29 renderer tests plus a UI test that mounts a reply containing
  `\[ \mathrm{H_2 + O_2 \rightarrow H_2O} \]`, `## Explanation`, `**bold**` and
  a list, then asserts the DOM has katex/h2/li/strong/sub/sup and that no `**`,
  `\[`, `\]`, `\mathrm`, `\rightarrow`, `CO_2` or `^` survives anywhere.
- `scripts/render-preview.ts` writes a standalone page showing source beside
  result for every case. 0 raw-syntax leaks, 42 typeset equations, and a
  `<script>` in the source stayed inert text.
- Full suite 246 passing, `tsc` clean, build clean, no PDFs in `dist/`.
- Cost: KaTeX adds ~280 kB (39 font files, 557 CSS rules). Split into a lazy
  chunk if the first paint ever matters more than maths.

## Reported questions, and chapters 16-19 removed

### Chapters 16-19 removed from Chemistry
The owner asked for units 16-19 to go. They were the four chapters the curated
topic map never covered - guessed from OCR headings, not a real contents page.

- `scripts/trim-chapters.ts` does the removal, and **refuses to run** when it
  would orphan stored questions, printing exactly what would be lost. Run:
  `npx tsx scripts/trim-chapters.ts chemistry-9 16 17 18 19 --drop-questions`
- Removed: Empirical Data Collection and Analysis, Separation Techniques,
  Qualitative Analysis, Chromatography (pp. 217-258).
- 6 stored questions went with them; the chemistry bank went 55 -> 49.
- The index was rebuilt, so no chunk is tagged with a chapter that no longer
  exists. The index now ends at p.216, which is the last page of Biochemistry.
- Chemistry is now **15 chapters / 139 topics**, and the curated map is the
  *complete* structure rather than a partial one - a stronger invariant, now
  asserted by the test suite.
- The OCR text itself was not deleted; `data/extracted` is the raw source.

### Report a wrong question
An AI-written MCQ can have a wrong answer key, so the student can report one.

- `POST /api/questions/:id/flag`, `POST /api/questions/:id/unflag`,
  `GET /api/questions/flagged`. Stored in `data/student/flagged.json`.
- A reported question is **filtered out of every practice mode**, in
  `/api/practice`, before selection. It stays in the bank so the report is
  auditable rather than a silent deletion.
- The options and the answer key are copied from the **stored question**, not
  from the browser: the first version trusted the client, and the assistant
  then admitted it could not tell what was wrong because it had no key. That
  was a real gap found by testing, not a hypothetical.
- The assistant answers "this question is wrong" with the real question, its
  options and the key, and is told to say when the page does not settle it.
  Verified live: it identified option A, explained why B, C and D are wrong, and
  said it could not verify the wording word-for-word against p.5.
- `looksLikeBadQuestion()` matches both word orders ("wrong question" and
  "that answer is incorrect"); only the first was detected at first.

### Loading screen for the AI-written questions
`frontend/src/components/TopUpProgress.tsx`: while the model writes, the student
sees each question **as it is written** - chapter, topic, difficulty, page - with
a counter of how many are left, and a "Start with these N" button. The wait is
visible progress instead of a spinner.

### Verification
- 252 tests pass, `tsc` clean, build clean, no PDFs.
- Live: Energetics (0 stored questions) served in 0.07s, then 5 questions
  appeared one batch at a time and were saved. Chemistry bank 49 -> 54.

## "Take my MCQ test" hands over to the quiz

Asking for a test in the chat now *starts the test* instead of answering in
chat. The request is parsed and resolved in `backend/chat/practice-intent.ts`,
deterministically: a model call would cost 40-300s to decide something a regular
expression can decide, and a wrong guess would start the wrong test.

- Reads the size ("of 5 questions", "a 3-question quiz", "give me ten
  questions"), clamped to 1-50.
- Reads the book from the subject named, or the book already selected.
- Reads the chapter from "chapter 6" or the chapter title ("on the cell"), and
  the subtopic from its real topic titles ("on the mole" -> Stoichiometry/Mole).
- Chooses the mode: an exam/test/quiz is `random`, "weak" is `smart`, "revise"
  is `revision`.
- The reply is returned with a `practice` payload; the chat page switches to the
  practice route with that exact scope and count, and the conversation records
  what was started.

### Three bugs found by testing it live
1. With no book named it fell back to `books[0]`, so "take my mcq test" started
   a **Biology** test. It now leaves the scope open instead of guessing.
2. "chapter 6 in chemistry" resolved to chapter 1, because a Chemistry topic is
   literally titled "Chemistry" and matched the subject word. The subject is
   now stripped before matching, and a resolved chapter confines the topic
   search to itself.
3. "a 3-question quiz please" was not recognised at all - no trigger verb. Now a
   sized noun counts as a request, while "this question is wrong" is explicitly
   ruled out so it still reaches the reported-question flow.

### Verified live (all instant, no model call)
`take my mcq test of 5 questions` -> 5 random, whole library (0.1s)
`give me 5 questions on chapter 6 in chemistry` -> Chemistry > Stoichiometry
`quiz me on the mole` -> Chemistry > Stoichiometry > Mole
`give me a 3-question quiz on the cell` -> Biology > Cell, 3 questions
`give me 5 questions on matter` -> Chemistry > Matter, smart
`what is a mole`, `this question is wrong, why?` -> answered normally

272 tests pass, `tsc` clean, build clean.

### The handed-over test starts itself
Asking in chat used to drop the student on the practice page with the scope
filled in and then ask them to press Start. They had already asked for the test
in their own words, so the route now carries `auto=1` and the first question
appears on its own. Once per route key, so a later "New set" is still theirs to
press.

## Command routing: natural language to the Practice tab

The feature was built to the spec and then checked against the spec's own
wording, which found three gaps that the first pass had missed.

Fixed after live testing:
- "Ask me some MCQs" was not recognised at all - "ask" was not a trigger verb.
- "Test me with 20" gave 10 questions - the "with N" form was not read.
- "Take my MCQ test" gave 10 questions. The spec asks for the app's normal
  default test length, and the Practice page's default is **Random 20**, so a
  chat-started test is now the same length as the one started from Practice
  (20 random, 10 for smart/revision).
- "Ask me 5 MCQs" was smart practice. A request for MCQs is a test, so `mcq`
  now selects random mode; only an explicit mention of weakness asks for smart.

Verified live against the running server - all ten spec phrasings route, and
ordinary questions still do not:
`Take my MCQ test` -> 20 random (whole library) - `Ask me 5 MCQs` -> 5 random -
`Give me 10 chemistry MCQs` -> 10 random, Chemistry - `Quiz me on Chapter 4` ->
20 random - `Test me on Biology chapter 9 with 15 questions` -> 15 random,
Biology > Plant Reproduction.
"what is a mole", "this question is wrong, why?", "explain the cell" and
"how many questions are in chapter 3" are still answered in the chat.

`Quiz me on Chapter 4` with no book open stays unscoped on purpose: several
books have a chapter 4, and guessing one would start the wrong test. If the
chat has a book open, "Chapter 4" resolves inside that book.

286 tests pass, `tsc` clean, build clean.

## GitHub Pages deployment

Deployment config only. No UI or AI behaviour was changed.

- `vite.config.ts` - `base: process.env.DEPLOY_BASE ?? '/'`. Left as `/` by
  default so `npm run dev` and the local backend behave exactly as before; the
  workflow builds with `DEPLOY_BASE=/Project/`.
- `.github/workflows/deploy.yml` - official Pages flow: checkout, setup-node
  (npm cache), `npm ci`, build with `DEPLOY_BASE=/Project/`, upload artifact,
  deploy. Triggers on push to `main` and on manual dispatch. Scoped permissions
  (`contents: read`, `pages: write`, `id-token: write`) and a concurrency group
  so two deploys cannot race.
- The build step **fails the deploy** if any PDF or anything key-shaped is found
  in `dist`, because `books/` and `data/extracted/` are large copyrighted
  material that must never be published.
- `.gitignore` - added `data/topic-maps/` (the chapter/topic map is derived from
  the textbook) and `*.tmp` (OCR scratch). Previously 24 kB of textbook-derived
  data would have been published.

### Verified
- `DEPLOY_BASE=/Project/` build: every asset URL is prefixed - JS, CSS, and all
  60 KaTeX font references. Nothing points at the domain root.
- `scripts/verify-pages-build.ts` serves `dist` under `/Project/` and fetches
  what the browser would: page, JS bundle, stylesheet, a KaTeX font, and a deep
  link `/Project/#/book/chemistry-9` - all 200. A path outside the project
  correctly 404s. The app uses **hash routing**, so Pages needs no SPA rewrite
  and no `404.html`.
- Default build still emits `/assets/...`, so local dev and the local server
  are unchanged. 286 tests pass, `tsc` clean.
- `scripts/check-ignore-rules.ts` checks the .gitignore rules (git is not
  installed on this machine, so `git check-ignore` is unavailable): `.env`,
  the PDFs, `data/extracted`, `data/indexes`, `data/questions`,
  `data/topic-maps`, `data/student` and `data/chat` are all ignored, and all
  source is still tracked.

### Known limitation, stated plainly
GitHub Pages serves static files only, so the deployed site has **no API**: the
books, AI answers, question generation and progress history all come from the
Node backend, which cannot run on Pages. The deployed page will load and show
its existing offline notice, because the app already handles an unreachable API
gracefully. The study engine needs `npm start` on a machine you control.
To point the deployed site at a real API later, set `VITE_API_BASE` at build
time - no code change, it is already read by `frontend/src/api.ts`.
