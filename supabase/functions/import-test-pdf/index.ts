// supabase/functions/import-test-pdf/index.ts
//
// Lets a teacher upload a PDF (a reading passage + its questions, or a
// listening section's questions) and have it turned into the JSON shape
// the test builder already understands, instead of typing every question
// by hand. The browser sends the PDF here as base64; this function asks
// Claude to read it and return structured JSON; the browser then inserts
// that JSON as real passages/sections/questions via the normal (RLS
// protected) client calls — this function never touches the database.
//
// DEPLOY:
//   supabase functions deploy import-test-pdf
// SET THE SECRET (once):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SCHEMA_PROMPT = `
You turn a scanned or typed IELTS test page (a reading passage with its
questions, or a listening section's questions) into JSON for an online test
builder.

Return ONLY valid JSON — no markdown code fences, no commentary before or
after — matching exactly this shape:

{
  "containers": [
    {
      "title": "string - e.g. 'Reading Passage 1' or 'Section 2'",
      "passage_text": "string - the FULL reading passage body text if this is a reading passage. Empty string for listening.",
      "questions": [
        {
          "question_type": "multiple_choice" | "true_false_not_given" | "fill_blank" | "short_answer" | "matching" | "layout_blank",
          "question_text": "string - the question wording. Use an EMPTY STRING for layout_blank questions (their wording lives in the layout below instead).",
          "options": ["string", "..."],
          "correct_answer": "string"
        }
      ],
      "layout": null_or_object
    }
  ]
}

Notes on "options": only fill this in for "multiple_choice" (the answer
choices) or "matching" (the shared drag-and-drop word bank shared by all
matching questions in this container). Leave it an empty array for every
other question type.

Notes on "correct_answer": the correct choice, word, TRUE/FALSE/NOT GIVEN,
or number. If you cannot confidently tell the correct answer from the page
(most exam PDFs do not print an answer key), use an empty string — never
guess.

Notes on "layout" (use null if the container has no table/note-completion
task at all):

{
  "type": "note" | "table",
  "intro": "string - the instruction line shown above it, e.g. 'Complete the notes below. Write NO MORE THAN TWO WORDS...'. Use **bold**, *italic*, and \\n for line breaks if the source uses them.",
  "parts": [ {"type":"text","value":"string"} | {"type":"blank","ref":0} ],
  "columns": ["string", "..."],
  "rows": [ [ [ {"type":"text","value":"..."} | {"type":"blank","ref":0} ], "...one array per column..." ], "...one array per row..." ]
}

Use "parts" only when type is "note" (the flowing paragraph, as an ordered
list of text/blank pieces — a blank can sit in the middle of a sentence).
Use "columns" and "rows" only when type is "table" — each row is an array
with one cell per column, and each cell is itself an array of text/blank
pieces (so a cell like "Positioned (12) ___ the lap" is
[{"type":"text","value":"Positioned "}, {"type":"blank","ref":11}, {"type":"text","value":" the lap"}]).

"ref" in a blank part is the 0-based INDEX of that question inside THIS
container's "questions" array — NOT the printed question number.

Rules:
- Use "layout_blank" as the question_type for every numbered blank that
  appears inside a table or a flowing note/sentence-completion paragraph.
  Every other question type is a standalone question and must never be
  referenced by a layout blank.
- Every "layout_blank" question must be referenced by exactly one blank
  somewhere in that container's layout, and every blank must reference a
  real question in "questions".
- List "questions" in the same ascending order as the printed question
  numbers — the builder numbers them 1, 2, 3... automatically in that
  order, so the order you return them in matters.
- If the page contains more than one passage/section (e.g. "Reading
  Passage 1" and "Reading Passage 2", or Sections 1-4), return one object
  per passage/section, in order, inside "containers".
- Never invent content that is not visibly present in the PDF.
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { pdf_base64 } = await req.json();
    if (!pdf_base64) throw new Error('Missing pdf_base64');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server (run: supabase secrets set ANTHROPIC_API_KEY=...)');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SCHEMA_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
            { type: 'text', text: 'Extract this PDF into the JSON shape described in the system prompt. Return only the JSON.' },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic API error (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find((b: any) => b.type === 'text');
    if (!textBlock) throw new Error('No text returned by Claude');

    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
